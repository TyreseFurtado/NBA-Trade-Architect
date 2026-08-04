import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import teamsData from './teams.json';
import { analyzeTrade } from '../lib/tradeApi';
import { useState, useEffect } from 'react';
import { validateTrade } from '../../logic/cbaEngine';
import type { Player, Team, TradeVerdict } from '../types/trade';



export type { Position, Player, Team, TradeVerdict } from '../types/trade';

// ─── Hydration Helper ─────────────────────────────────────────────────────────
export function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHasHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);
  return hasHydrated;
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Basket stores player IDs only — never Immer draft proxies.
// Players are resolved from the live roster at execution time.
type TradeBasket = Record<string, string[]>;

interface TradeState {
  teams: Team[];
  basket: TradeBasket;
  verdict: TradeVerdict | null;
  loading: boolean;
  analysisError: string | null;

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
        // structuredClone prevents Immer from freezing the module-level
        // reference — without this, resetTeams hands back a frozen object
        // and every subsequent mutation silently fails in production.
        teams: structuredClone(initialTeams),
        basket: emptyBasket(initialTeams),
        verdict: null,
        loading: false,
        analysisError: null,

        // ── Selectors ──────────────────────────────────────────────────────
        getTeam: (teamId) =>
          get().teams.find((t) => t.id === teamId),

        // Resolves full Player objects from the live roster using staged IDs.
        // This is safe because we never store draft proxies in the basket.
        getOutgoing: (teamId) => {
          const stagedIds = get().basket[teamId] ?? [];
          const team = get().teams.find((t) => t.id === teamId);
          if (!team) return [];
          return stagedIds
            .map((id) => team.players.find((p) => p.id === id))
            .filter((p): p is Player => p !== undefined);
        },

        getSalaryDelta: (teamId) => {
          const out = get().getOutgoing(teamId).reduce((s, p) => s + p.salary, 0);
          const inc = Object.keys(get().basket)
            .filter((id) => id !== teamId)
            .flatMap((id) => get().getOutgoing(id))
            .reduce((s, p) => s + p.salary, 0);
          return inc - out;
        },

        isTradeValid: () => {
          const { basket, teams, getOutgoing } = get();
          const teamsInvolved = teams.filter((t) => getOutgoing(t.id).length > 0);

          if (teamsInvolved.length < 2) {
            return { isValid: false, reason: 'Select players from at least two teams.' };
          }

          // Build the exact TeamTradePayload array expected by cbaEngine.ts
          const payload = teamsInvolved.map((team) => {

            const stagedIds = basket[team.id] ?? [];
            const sending = getOutgoing(team.id);

            // Receiving = players coming in from all other active trade baskets
            const receiving = Object.entries(basket)
              .filter(([id]) => id !== team.id && basket[id].length > 0)
              .flatMap(([otherId]) => getOutgoing(otherId));

            // Compute total active payroll for this team
            const currentPayroll = team.players.reduce((sum, p) => sum + p.salary, 0);

            return {
              id: team.id,
              name: team.name,
              abbreviation: team.abbreviation,
              sending,
              receiving,
              currentPayroll,

              remainingRoster: team.players.filter(
                (p) => !stagedIds.includes(p.id)
              )
            };
          })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          // Run validation through your central cbaEngine logic
          const validationResult = validateTrade(payload);

          if (!validationResult.isValid) {
            // Extract the first explicit rule violation message to display in the UI banner
            const firstViolation = validationResult.teamValidations
              .flatMap((t) => t.violations)[0] ?? 'Trade violates CBA rules.';
            return { isValid: false, reason: firstViolation };
          }

          return { isValid: true };
        },

        // ── Actions ────────────────────────────────────────────────────────
        stagePlayer: (teamId, playerId) =>
          set((state) => {
            // Verify the player actually exists on this team before staging
            const exists = state.teams
              .find((t) => t.id === teamId)
              ?.players.some((p) => p.id === playerId);
            if (!exists) return;

            if (!state.basket[teamId]) state.basket[teamId] = [];
            if (!state.basket[teamId].includes(playerId)) {
              state.basket[teamId].push(playerId);
            }
          }),

        unstagePlayer: (teamId, playerId) =>
          set((state) => {
            state.basket[teamId] = (state.basket[teamId] ?? [])
              .filter((id) => id !== playerId);
          }),

        clearBasket: () =>
          set((state) => {
            state.basket = emptyBasket(state.teams);
            state.verdict = null;
          }),

        executeTrade: () =>
          set((state) => {
            const { isValid } = get().isTradeValid();
            if (!isValid) return;

            const { basket, teams } = state;

            const teamIds = Object.keys(basket).filter((id) => basket[id] && basket[id].length > 0);


            const movements: { player: Player; toTeamId: string }[] = [];

            for (const fromId of teamIds) {
              const stagedIds = basket[fromId] ?? [];
              if (stagedIds.length === 0) continue;

              const fromTeam = state.teams.find((t) => t.id === fromId);
              const otherIds = teamIds.filter((id) => id !== fromId);
              if (!fromTeam || otherIds.length === 0) continue;

              // Resolve players from the live roster — never from the basket
              for (let i = 0; i < stagedIds.length; i++) {
                const player = fromTeam.players.find((p) => p.id === stagedIds[i]);
                if (player) {
                  movements.push({ player, toTeamId: otherIds[i % otherIds.length] });
                }
              }
            }

            // Remove staged players from their current teams
            state.teams = teams.map((team) => {
              const stagedIds = new Set(basket[team.id] ?? []);
              const remainingPlayers = team.players.filter((p) => !stagedIds.has(p.id));
              return { ...team, players: [...remainingPlayers] };
            })

            // Add players to destination teams
            for (const { player, toTeamId } of movements) {
              const targetTeam = state.teams.find((t) => t.id === toTeamId);
              if (targetTeam) {
                targetTeam.players.push(player);
              }

            }

            state.basket = emptyBasket(state.teams);
            state.verdict = null;
          }),

        resetTeams: () =>
          set((state) => {
            // structuredClone breaks the frozen module-level reference so
            // Immer can mutate the new teams freely after reset
            state.teams = structuredClone(initialTeams);
            state.basket = emptyBasket(state.teams);
            state.verdict = null;
            state.analysisError = null;
          }),

        // ── AI Analysis ────────────────────────────────────────────────────
        fetchAIAnalysis: async () => {
          const { isValid, reason } = get().isTradeValid();
          if (!isValid) {
            set((state) => { state.analysisError = reason ?? 'Trade is not valid.'; });
            return;
          }

          set((state) => {
            state.loading = true;
            state.analysisError = null;
            state.verdict = null;
          });

          const { basket, teams } = get();

          const payload = Object.entries(basket)
            .filter(([, ids]) => ids.length > 0)
            .map(([teamId, stagedIds]) => {
              const team = teams.find((t) => t.id === teamId);
              if (!team) return null;

              const sending = stagedIds
                .map((id) => team.players.find((p) => p.id === id))
                .filter((p): p is Player => p !== undefined);

              // Each team's receiving list = every other team's outgoing players
              const receiving = Object.entries(basket)
                .filter(([id]) => id !== teamId)
                .flatMap(([otherId, otherIds]) => {
                  const otherTeam = teams.find((t) => t.id === otherId);
                  return otherIds
                    .map((id) => otherTeam?.players.find((p) => p.id === id))
                    .filter((p): p is Player => p !== undefined);
                });

              return {
                name: team.name,
                abbreviation: team.abbreviation,
                sending,
                receiving,
                remainingRoster: team.players.filter(
                  (p) => !stagedIds.includes(p.id)
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
            set((state) => {
              state.loading = false;
              state.analysisError = 'Analysis failed. Please try again.';
            });
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