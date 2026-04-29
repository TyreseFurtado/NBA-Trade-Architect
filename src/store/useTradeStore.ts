import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import teamsData from './teams.json';
import { analyzeTrade } from '../lib/tradeApi';
import { useState, useEffect } from 'react';
import type { Player, Team, TradeVerdict } from '../types/trade'; // ← single source

export type { Position, Player, Team, TradeVerdict } from '../types/trade';

// ─── CBA Constants ────────────────────────────────────────────────────────────
const SALARY_CAP = 165_000_000;
const SECOND_APRON = 222_000_000;

// ─── Hydration Helper ─────────────────────────────────────────────────────────
export function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => { setHasHydrated(true); }, []);
  return hasHydrated;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type TradeBasket = Record<string, Player[]>;

interface TradeState {
  teams: Team[];
  basket: TradeBasket;
  verdict: TradeVerdict | null;
  loading: boolean;

  getTeam: (teamId: string) => Team | undefined;
  getOutgoing: (teamId: string) => Player[];
  getSalaryDelta: (teamId: string) => number;
  isTradeValid: () => { isValid: boolean; reason?: string };

  stagePlayer: (teamId: string, playerId: string) => void;
  unstagePlayer: (teamId: string, playerId: string) => void;
  clearBasket: () => void;
  executeTrade: () => void;
  resetTeams: () => void;
  fetchAIAnalysis: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initialTeams = (teamsData as { teams: Team[] }).teams;

const emptyBasket = (teams: Team[]): TradeBasket =>
  teams.reduce<TradeBasket>((acc, t) => { acc[t.id] = []; return acc; }, {});

// ─── Store ────────────────────────────────────────────────────────────────────
export const useTradeStore = create<TradeState>()(
  devtools(
    persist(
      immer((set, get) => ({
        teams: initialTeams,
        basket: emptyBasket(initialTeams),
        verdict: null,
        loading: false,

        // ── Selectors ──────────────────────────────────────────────────────
        getTeam: (teamId) => get().teams.find((t) => t.id === teamId),
        getOutgoing: (teamId) => get().basket[teamId] ?? [],

        getSalaryDelta: (teamId) => {
          const { basket } = get();
          const out = (basket[teamId] ?? []).reduce((s, p) => s + p.salary, 0);
          const inc = Object.entries(basket)
            .filter(([id]) => id !== teamId)
            .flatMap(([, players]) => players)
            .reduce((s, p) => s + p.salary, 0);
          return inc - out;
        },

        isTradeValid: () => {
          const { basket, teams, getOutgoing, getSalaryDelta } = get();
          const teamsInvolved = Object.keys(basket).filter((id) => basket[id].length > 0);

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
              if (delta > 0) {
                return { isValid: false, reason: `${team.name} is in the 2nd Apron and cannot take on additional salary.` };
              }
              if (outgoing.length >= 2) {
                return { isValid: false, reason: `${team.name} is in the 2nd Apron and cannot aggregate players (2-for-1s are banned).` };
              }
            } else if (currentSalary > SALARY_CAP) {
              const outSum = outgoing.reduce((s, p) => s + p.salary, 0);
              if (outSum + delta > outSum * 1.25 + 250_000) {
                return { isValid: false, reason: `${team.name} exceeds the 125% + $250k salary matching limit.` };
              }
            }
          }

          return { isValid: true };
        },

        // ── Actions ────────────────────────────────────────────────────────
        stagePlayer: (teamId, playerId) =>
          set((state) => {
            const player = state.teams.find((t) => t.id === teamId)
              ?.players.find((p) => p.id === playerId);
            if (!player) return;
            if (state.basket[teamId]?.some((p) => p.id === playerId)) return;
            if (!state.basket[teamId]) state.basket[teamId] = [];
            state.basket[teamId].push(player);
          }),

        unstagePlayer: (teamId, playerId) =>
          set((state) => {
            state.basket[teamId] = (state.basket[teamId] ?? [])
              .filter((p) => p.id !== playerId);
          }),

        clearBasket: () =>
          set((state) => { state.basket = emptyBasket(state.teams); }),

        executeTrade: () =>
          set((state) => {
            const { isValid } = get().isTradeValid();
            if (!isValid) return;

            const { basket, teams } = state;
            const teamIds = teams.map((t) => t.id);
            const movements: { player: Player; toTeamId: string }[] = [];

            // ✅ Single loop — no duplicate
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
              const dest = state.teams.find((t) => t.id === toTeamId);
              if (dest) dest.players.push(player); // ✅ No player.teamId — the array IS the truth
            }

            state.basket = emptyBasket(state.teams);
            state.verdict = null;
          }),

        resetTeams: () =>
          set((state) => {
            state.teams = initialTeams;
            state.basket = emptyBasket(initialTeams);
            state.verdict = null;
          }),

        // ── AI Analysis ────────────────────────────────────────────────────
        fetchAIAnalysis: async () => {
          const { basket, teams, isTradeValid } = get();
          const { isValid, reason } = isTradeValid(); // ✅ Single call
          if (!isValid) {
            console.warn('[fetchAIAnalysis] Invalid trade:', reason);
            return;
          }

          set((state) => { state.loading = true; });

          // ✅ Each team's receiving list comes directly from the basket,
          // not from a flat allIncomingPlayers array (which breaks on 3-team trades)
          const payload = Object.entries(basket)
            .filter(([, players]) => players.length > 0)
            .map(([teamId, sending]) => {
              const team = teams.find((t) => t.id === teamId);
              if (!team) return null;
              return {
                name: team.name,
                abbreviation: team.abbreviation,
                sending,
                receiving: Object.entries(basket)
                  .filter(([id]) => id !== teamId)
                  .flatMap(([, players]) => players),
                remainingRoster: team.players.filter(
                  (p) => !sending.some((s) => s.id === p.id)
                ),
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          try {
            const responseVerdict = await analyzeTrade(payload);
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
      },
    ),
    { name: 'TradeStore' },
  ),
);