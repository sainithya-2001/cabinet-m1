import type { CountryState, Indicator, DelayedEffect } from './types.js';

export type GamePlayer = { id: string; name: string; seat: number; isBot: boolean; ministry: string; isMole: boolean; ready: boolean };
export type PublishedClue = { playerId: string; name: string; ministry: string; value: number; year: number; at: number };
export type PublicGamePlayer = Pick<GamePlayer, 'id' | 'name' | 'seat' | 'isBot' | 'ministry' | 'ready'>;
export type PublicPublishedClue = Pick<PublishedClue, 'playerId' | 'name' | 'ministry' | 'value' | 'year' | 'at'>;
export type PublicCountryState = Pick<CountryState, 'year' | 'economy' | 'happiness' | 'stability' | 'environment' | 'debt' | 'collapsed'> & {
  delayedEffects: Array<Pick<DelayedEffect, 'dueYear' | 'indicator' | 'amount' | 'cause'>>;
  collapseReasons: Indicator[];
};

type LiteGameState = {
  version: number; status: 'waiting' | 'playing' | 'finished'; createdAt: number;
  phase: string; phaseStartedAt: number; phaseDeadline: number | null; year: number;
  players: GamePlayer[];
  privateByPlayer: Record<string, { ministry: string; isMole: boolean; clue: string; trueValue: number }>;
  publishedClues: PublishedClue[];
  readyByPlayer: Record<string, boolean>;
  budgetDraft: Record<string, number> | null; votes: Record<string, boolean>; result: unknown;
  lastActionAt: Record<string, number>; chat?: unknown; country: CountryState | null;
  lastPassedBudget: unknown; failedVotes: 0 | 1; pendingBudget: unknown;
  voteChoices: Record<string, boolean>; crisisId: string | null; yearResolution: unknown;
  primeMinisterId: string | null; guesses: Record<string, string>; botPlan: Record<string, unknown>;
};

export type PublicGameState = {
  version: number; status: 'waiting' | 'playing' | 'finished'; createdAt: number;
  phase: string; phaseStartedAt: number; phaseDeadline: number | null; year: number;
  players: PublicGamePlayer[]; publishedClues: PublicPublishedClue[];
  budgetDraft: Record<string, number> | null; votes: Record<string, boolean>; result: unknown;
  country: PublicCountryState | null; lastPassedBudget: unknown; failedVotes: 0 | 1;
  voteChoices: Record<string, boolean>; crisisId: string | null; yearResolution: unknown;
  primeMinisterId: string | null; guesses: Record<string, string>;
};

function publicCountry(country: CountryState | null): PublicCountryState | null {
  if (!country) return null;
  return {
    year: country.year, economy: country.economy, happiness: country.happiness,
    stability: country.stability, environment: country.environment, debt: country.debt,
    collapsed: country.collapsed,
    collapseReasons: [...country.collapseReasons],
    delayedEffects: country.delayedEffects.map(({ dueYear, indicator, amount, cause }) => ({ dueYear, indicator, amount, cause })),
  };
}

/** Build a browser-safe snapshot by allowlisting every exposed field. */
export function toPublicGameState(state: LiteGameState): PublicGameState {
  return {
    version: state.version,
    status: state.status,
    createdAt: state.createdAt,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseDeadline: state.phaseDeadline,
    year: state.year,
    players: state.players.map(({ id, name, seat, isBot, ministry, ready }) => ({ id, name, seat, isBot, ministry, ready })),
    publishedClues: state.publishedClues.map(({ playerId, name, ministry, value, year, at }) => ({ playerId, name, ministry, value, year, at })),
    budgetDraft: state.budgetDraft ? { ...state.budgetDraft } : null,
    votes: { ...state.votes },
    result: state.result,
    country: publicCountry(state.country),
    lastPassedBudget: state.lastPassedBudget,
    failedVotes: state.failedVotes,
    voteChoices: { ...state.voteChoices },
    crisisId: state.crisisId,
    yearResolution: state.yearResolution,
    primeMinisterId: state.primeMinisterId,
    guesses: { ...state.guesses },
  };
}
