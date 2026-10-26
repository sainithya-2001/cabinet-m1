export type GamePlayer = { id: string; name: string; seat: number; isBot: boolean; ministry: string; isMole: boolean; ready: boolean };
export type PublishedClue = { playerId: string; name: string; ministry: string; value: number; year: number; at: number };

export type PublicGamePlayer = Omit<GamePlayer, 'isMole'>;
export type PublicPublishedClue = Omit<PublishedClue, 'value'>;

export type PublicGameState = Omit<LiteGameState, 'privateByPlayer' | 'readyByPlayer' | 'lastActionAt' | 'chat' | 'players' | 'publishedClues'> & {
  players: PublicGamePlayer[];
  publishedClues: PublicPublishedClue[];
};

type LiteGameState = {
  version: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  phase: string;
  phaseStartedAt: number;
  phaseDeadline: number | null;
  year: number;
  players: GamePlayer[];
  privateByPlayer: Record<string, { ministry: string; isMole: boolean; clue: string; trueValue: number }>;
  publishedClues: PublishedClue[];
  readyByPlayer: Record<string, boolean>;
  budgetDraft: Record<string, number> | null;
  votes: Record<string, boolean>;
  result: unknown;
  lastActionAt: Record<string, number>;
  chat?: unknown;
  country: unknown;
  lastPassedBudget: unknown;
  failedVotes: 0 | 1;
  pendingBudget: unknown;
  voteChoices: Record<string, boolean>;
  crisisId: string | null;
  yearResolution: unknown;
  primeMinisterId: string | null;
  guesses: Record<string, string>;
  botPlan: Record<string, unknown>;
};

/** Build a browser-safe snapshot with an explicit public type. */
export function toPublicGameState(state: LiteGameState): PublicGameState {
  const {
    privateByPlayer: _private,
    readyByPlayer: _ready,
    lastActionAt: _rateLimit,
    chat: _chat,
    ...visible
  } = state;
  return {
    ...visible,
    players: visible.players.map(({ isMole: _mole, ...player }) => player),
    publishedClues: visible.publishedClues.map(({ value: _trueValue, ...clue }) => clue),
  };
}
