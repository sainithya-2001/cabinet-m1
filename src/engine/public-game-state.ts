type PublicPlayer = { isMole?: boolean; [key: string]: unknown };
type PublicGameLike = {
  privateByPlayer?: unknown;
  readyByPlayer?: unknown;
  lastActionAt?: unknown;
  chat?: unknown;
  players?: PublicPlayer[];
  publishedClues?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

/** Build a browser-safe snapshot. Secrets are never copied into the public projection. */
export function toPublicGameState<T extends PublicGameLike>(state: T) {
  const {
    privateByPlayer: _private,
    readyByPlayer: _ready,
    lastActionAt: _rateLimit,
    chat: _chat,
    ...visible
  } = state;
  return {
    ...visible,
    players: (visible.players ?? []).map(({ isMole: _mole, ...player }) => player),
    publishedClues: (visible.publishedClues ?? []).map((clue) => {
      const { trueValue: _trueValue, isMole: _mole, clue: _privateClue, ...publicClue } = clue;
      return publicClue;
    }),
  };
}
