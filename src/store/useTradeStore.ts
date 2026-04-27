import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import teamsData from './teams.json';

// ---------- Types ----------

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Player {
  id: string;
  name: string;
  position: Position;
  age: number;
  salary: number;
  contractYearsRemaining: number;
  rating: number;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  conference: 'East' | 'West';
  salaryCap: number;
  players: Player[];
}

// A "trade basket" holds players each team is sending out.
// Keyed by team ID for O(1) lookup.
type TradeBasket = Record<string, Player[]>;

interface TradeState {
  teams: Team[];
  // Players staged for trade, grouped by the team that currently owns them
  basket: TradeBasket;

  // ----- Selectors (call as functions) -----
  getTeam: (teamId: string) => Team | undefined;
  getOutgoing: (teamId: string) => Player[];
  // Salary leaving team A + salary coming in from team B - (B is receiving from A)
  getSalaryDelta: (teamId: string) => number;
  isTradeValid: () => boolean;

  // ----- Actions -----
  stagePlayer: (teamId: string, playerId: string) => void;
  unstagePlayer: (teamId: string, playerId: string) => void;
  clearBasket: () => void;
  executeTrade: () => void;
  resetTeams: () => void;
}

// ---------- Helpers ----------

const initialTeams = (teamsData as { teams: Team[] }).teams;

const emptyBasket = (teams: Team[]): TradeBasket =>
  teams.reduce<TradeBasket>((acc, t) => {
    acc[t.id] = [];
    return acc;
  }, {});

// ---------- Store ----------

export const useTradeStore = create<TradeState>()(
  devtools(
    persist(
      immer((set, get) => ({
        teams: initialTeams,
        basket: emptyBasket(initialTeams),

        // ----- Selectors -----
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
          return inc - out; // positive = team takes on more salary
        },

        isTradeValid: () => {
          const { basket } = get();
          const teamsInvolved = Object.values(basket).filter(
            (players) => players.length > 0,
          );
          // A real trade needs at least two teams sending players
          return teamsInvolved.length >= 2;
        },

        // ----- Actions -----
        stagePlayer: (teamId, playerId) =>
          set((state) => {
            const team = state.teams.find((t) => t.id === teamId);
            if (!team) return;

            const player = team.players.find((p) => p.id === playerId);
            if (!player) return;

            // Avoid double-staging
            const alreadyStaged = state.basket[teamId]?.some(
              (p) => p.id === playerId,
            );
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
          set((state) => {
            state.basket = emptyBasket(state.teams);
          }),

        executeTrade: () =>
          set((state) => {
            if (!get().isTradeValid()) return;

            const { basket, teams } = state;

            // 1. Snapshot every staged player and where they're going.
            //    Players in team A's basket go to "the other team(s)".
            //    For a 2-team trade this is unambiguous; for multi-team we
            //    distribute round-robin (simple but extendable).
            const teamIds = teams.map((t) => t.id);
            const movements: { player: Player; toTeamId: string }[] = [];

            for (const fromId of teamIds) {
              const outgoing = basket[fromId] ?? [];
              const otherIds = teamIds.filter((id) => id !== fromId);
              if (otherIds.length === 0) continue;

              outgoing.forEach((player, i) => {
                const toTeamId = otherIds[i % otherIds.length];
                movements.push({ player, toTeamId });
              });
            }

            // 2. Remove all staged players from their current teams.
            for (const team of state.teams) {
              const stagedIds = new Set(
                (basket[team.id] ?? []).map((p) => p.id),
              );
              team.players = team.players.filter((p) => !stagedIds.has(p.id));
            }

            // 3. Add them to their destination teams.
            for (const { player, toTeamId } of movements) {
              const dest = state.teams.find((t) => t.id === toTeamId);
              if (dest) dest.players.push(player);
            }

            // 4. Clear the basket.
            state.basket = emptyBasket(state.teams);
          }),

        resetTeams: () =>
          set((state) => {
            state.teams = initialTeams;
            state.basket = emptyBasket(initialTeams);
          }),
      })),
      {
        name: 'trade-store', // localStorage key
        // Only persist the data, not the function references
        partialize: (state) => ({ teams: state.teams, basket: state.basket }),
      },
    ),
    { name: 'TradeStore' },
  ),
);
