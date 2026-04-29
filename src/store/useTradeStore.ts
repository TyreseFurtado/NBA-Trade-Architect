import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import teamsData from './teams.json';
import type { Player, Team } from '../types/trade';
import { useState, useEffect } from 'react';
import { analyzeTrade } from '../lib/tradeApi';

export type { Position, Player, Team } from '../types/trade';

// ─── CBA Constants ────────────────────────────────────────────────────────────
const SALARY_CAP = 165_000_000;
const SECOND_APRON = 222_000_000;

// ─── AI Verdict ───────────────────────────────────────────────────────────────
export type TradeVerdictLabel = 'smart' | 'risky' | 'questionable' | 'bad';

export interface TradeVerdict {
  verdict: TradeVerdictLabel;
  summary: string;
  teamBreakdown: Array<{
    teamName: string;
    assessment: string;
    positionImpact: string;
  }>;
  label: TradeVerdictLabel;
  risks: string[];
  benefits: string[];
  confidence: number;   // 0–1
  reasoning: string;
}

export function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // This runs after the first client-side render
    setHasHydrated(true);
  }, []);

  return hasHydrated;
}

type TradeBasket = Record<string, Player[]>;

interface TradeState {
  teams: Team[];
  basket: TradeBasket;
  // ↓ NEW
  verdict: TradeVerdict | null;
  loading: boolean;

  // ----- Selectors -----
  getTeam: (teamId: string) => Team | undefined;
  getOutgoing: (teamId: string) => Player[];
  getSalaryDelta: (teamId: string) => number;
  // ↓ CHANGED: now returns { isValid, reason? } instead of boolean
  isTradeValid: () => { isValid: boolean; reason?: string };

  // ----- Actions -----
  stagePlayer: (teamId: string, playerId: string) => void;
  unstagePlayer: (teamId: string, playerId: string) => void;
  clearBasket: () => void;
  executeTrade: () => void;
  resetTeams: () => void;
  // ↓ NEW
  fetchAIAnalysis: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initialTeams = (teamsData as { teams: Team[] }).teams;

const emptyBasket = (teams: Team[]): TradeBasket =>
  teams.reduce<TradeBasket>((acc, t) => {
    acc[t.id] = [];
    return acc;
  }, {});

// ─── Store ────────────────────────────────────────────────────────────────────
export const useTradeStore = create<TradeState>()(
  devtools(
    persist(
      immer((set, get) => ({
        teams: initialTeams,
        basket: emptyBasket(initialTeams),
        verdict: null,    // ← NEW
        loading: false,   // ← NEW

        // ----- Selectors (unchanged) -----
        getTeam: (teamId) => get().teams.find((t) => t.id === teamId),
        getOutgoing: (teamId) => get().basket[teamId] ?? [],

        getSalaryDelta: (teamId) => {
          const { basket } = get();
          const outgoing = basket[teamId] ?? [];
          const incoming = Object.entries(basket)
            .filter(([id]) => id !== teamId)
            .flatMap(([, players]) => players);
          const out = outgoing.reduce((sum, p) => sum + p.salary, 0);
          const inc = incoming.reduce((sum, p) => sum + p.salary, 0);
          return inc - out;
        },

        // ----- CHANGED: CBA-aware validation -----
        isTradeValid: () => {
          const { basket, teams, getOutgoing, getSalaryDelta } = get();

          const teamsInvolved = Object.keys(basket).filter(
            (id) => basket[id].length > 0,
          );

          if (teamsInvolved.length < 2) {
            return { isValid: false, reason: 'Select players from at least two teams.' };
          }

          for (const teamId of teamsInvolved) {
            const team = teams.find((t) => t.id === teamId);
            if (!team) continue;

            const currentSalary = team.players.reduce((s, p) => s + p.salary, 0);
            const outgoing = getOutgoing(teamId);
            const delta = getSalaryDelta(teamId);

            if (currentSalary > SECOND_APRON) {
              // Hard block: cannot take on any additional salary
              if (delta > 0) {
                return {
                  isValid: false,
                  reason: `${team.name} is in the 2nd Apron and cannot take on additional salary.`,
                };
              }
              // Hard block: cannot aggregate (send 2+ players out to receive 1)
              // "Aggregation" = trading multiple players as a package
              if (outgoing.length >= 2) {
                return {
                  isValid: false,
                  reason: `${team.name} is in the 2nd Apron and cannot aggregate players (2-for-1s are banned).`,
                };
              }
            } else if (currentSalary > SALARY_CAP) {
              // 125% + $250k matching rule
              const outSum = outgoing.reduce((s, p) => s + p.salary, 0);
              const inSum = outSum + delta;   // delta = inc - out, so inc = out + delta
              const limit = outSum * 1.25 + 250_000;
              if (inSum > limit) {
                return {
                  isValid: false,
                  reason: `${team.name} exceeds the 125% + $250k salary matching limit.`,
                };
              }
            }
          }

          return { isValid: true };
        },

        // ----- Actions (unchanged) -----
        stagePlayer: (teamId, playerId) =>
          set((state) => {
            const team = state.teams.find((t) => t.id === teamId);
            if (!team) return;
            const player = team.players.find((p) => p.id === playerId);
            if (!player) return;
            const alreadyStaged = state.basket[teamId]?.some((p) => p.id === playerId);
            if (alreadyStaged) return;
            if (!state.basket[teamId]) state.basket[teamId] = [];
            state.basket[teamId].push(player);
          }),

        unstagePlayer: (teamId, playerId) =>
          set((state) => {
            const list = state.basket[teamId];
            if (!list) return;
            state.basket[teamId] = list.filter((p) => p.id !== playerId);
          }),

        clearBasket: () =>
          set((state) => { state.basket = emptyBasket(state.teams); }),

        executeTrade: () =>
          set((state) => {
            // ↓ CHANGED: destructure isValid from the new return shape
            const { isValid } = get().isTradeValid();
            if (!isValid) return;

            const { basket, teams } = state;
            const teamIds = teams.map((t) => t.id);
            const movements: { player: Player; toTeamId: string }[] = [];

            for (const fromId of teamIds) {
              const outgoing = basket[fromId] ?? [];
              const otherIds = teamIds.filter((id) => id !== fromId);
              if (otherIds.length === 0) continue;
              outgoing.forEach((player, i) => {
                movements.push({ player, toTeamId: otherIds[i % otherIds.length] });
              });
            }

            for (const team of state.teams) {
              const stagedIds = new Set((basket[team.id] ?? []).map((p) => p.id));
              team.players = team.players.filter((p) => !stagedIds.has(p.id));
            }

            for (const { player, toTeamId } of movements) {
              state.teams.find((t) => t.id === toTeamId)?.players.push(player);
            }

            state.basket = emptyBasket(state.teams);
            state.verdict = null;   // clear stale verdict after execution
          }),

        resetTeams: () =>
          set((state) => {
            state.teams = initialTeams;
            state.basket = emptyBasket(initialTeams);
            state.verdict = null;
          }),

        // ----- NEW: AI Analysis -----
        fetchAIAnalysis: async () => {
          console.log("Button clicked! Checking validity..."); // DEBUG
          const { basket, teams, isTradeValid } = get();
          const validation = isTradeValid();
          if (!validation.isValid) {
            console.log("Trade is invalid because:", validation.reason); // DEBUG
            return;
          }

          console.log("Trade is valid. Calling API..."); // DEBUG
          if (!isTradeValid().isValid) return;

          set((state) => { state.loading = true; });

          const allIncomingPlayers = Object.entries(basket).flatMap(([, players]) => players);

          // Build a serialisable summary of the trade for the API
          const payload = Object.entries(basket)
            .filter(([, players]) => players.length > 0)
            .map(([teamId, sendingPlayers]) => {
              const team = teams.find((t) => t.id === teamId);

              if (!team) return null;
              return {
                name: team.name,
                abbreviation: team.abbreviation, // Added
                sending: sendingPlayers,
                receiving: allIncomingPlayers.filter(p => !sendingPlayers.some(s => s.id === p.id)),
                // Added: This helps Gemini see the "Post-Trade" roster
                remainingRoster: team.players.filter(p => !allIncomingPlayers.some(a => a.id === p.id)),
              };
            })
            .filter((item): item is any => item !== null);
          try {
            const responseVerdict = await analyzeTrade(payload);
            console.log("🏀 AI RESPONSE DATA:", responseVerdict); // CHECK THIS IN F12 CONSOLE
            set((state) => {
              state.verdict = responseVerdict as TradeVerdict;
              state.loading = false;
            });
          } catch (err) {
            console.error('[fetchAIAnalysis]', err);
            set((state) => { state.loading = false; });
          }
        },
      })),
      {
        name: 'trade-store',
        partialize: (state) => ({ teams: state.teams, basket: state.basket }),
        // verdict and loading are intentionally excluded from persistence —
        // a stale AI opinion from a previous session is misleading
      },
    ),
    { name: 'TradeStore' },
  ),
);