
import { mulberry32 } from './random.ts';

export type GameMode = 'standard' | 'crisis';
export type GameLength = 'full' | 'quick';

export type Ministry =
  | 'finance'
  | 'health'
  | 'defense'
  | 'environment'
  | 'education'
  | 'infrastructure'
  | 'trade'
  | 'intelligence';

export type AgendaId =
  | 'finance-debt'
  | 'finance-no-borrowing'
  | 'health-spending'
  | 'health-happiness'
  | 'defense-stability'
  | 'defense-security'
  | 'environment-target'
  | 'environment-spending'
  | 'education-spending'
  | 'education-economy'
  | 'infrastructure-spending'
  | 'infrastructure-economy'
  | 'trade-industry'
  | 'trade-economy'
  | 'intelligence-expulsion'
  | 'intelligence-stability';

export type CrisisGoal =
  | 'green-transition'
  | 'prosperity'
  | 'social-contract'
  | 'fiscal-discipline';

export interface GamePlayer {
  id: string;
  name: string;
  seat: number;
  ministry: Ministry;
  agenda: AgendaId;
  isMole: boolean;
  connected: boolean;
  expelled: boolean;
  powerUsed: boolean;
}

export interface GameSetup {
  seed: number;
  mode: GameMode;
  length: GameLength;
  totalYears: number;
  year: number;
  players: GamePlayer[];
  molePlayerId: string | null;
  crisisGoal: CrisisGoal | null;
  noConfidenceUsed: boolean;
}

export const MINISTRY_ORDER: readonly Ministry[] = [
  'finance',
  'health',
  'defense',
  'environment',
  'education',
  'infrastructure',
  'trade',
  'intelligence',
];

export const AGENDAS: Record<Ministry, readonly [AgendaId, AgendaId]> = {
  finance: ['finance-debt', 'finance-no-borrowing'],
  health: ['health-spending', 'health-happiness'],
  defense: ['defense-stability', 'defense-security'],
  environment: ['environment-target', 'environment-spending'],
  education: ['education-spending', 'education-economy'],
  infrastructure: ['infrastructure-spending', 'infrastructure-economy'],
  trade: ['trade-industry', 'trade-economy'],
  intelligence: ['intelligence-expulsion', 'intelligence-stability'],
};

export const CRISIS_GOALS: readonly CrisisGoal[] = [
  'green-transition',
  'prosperity',
  'social-contract',
  'fiscal-discipline',
];

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}

export function createGameSetup(
  seed: number,
  playerNames: string[],
  mode: GameMode,
  length: GameLength,
): GameSetup {
  if (mode !== 'standard' && mode !== 'crisis') {
    throw new Error('Invalid game mode.');
  }

  if (length !== 'full' && length !== 'quick') {
    throw new Error('Invalid game length.');
  }
    if (typeof seed !== 'number' || !Number.isSafeInteger(seed)) {
    throw new Error('Seed must be a safe integer.');
  }

  if (
    !Array.isArray(playerNames) ||
    !playerNames.every((name) => typeof name === 'string')
  ) {
    throw new Error('Player names must be an array of strings.');
  }

  if (playerNames.some((name) => !name.trim() || name.length > 16)) {
    throw new Error('Player names must contain 1–16 characters.');
  }

  if (new Set(playerNames.map((name) => name.trim().toLowerCase())).size
      !== playerNames.length) {
    throw new Error('Player names must be unique, ignoring case.');
  }

  if (playerNames.length > 8) {
    throw new Error('A game supports at most 8 players.');
  }

  if (mode === 'standard' && playerNames.length < 4) {
    throw new Error('Standard mode requires 4–8 players.');
  }

  if (mode === 'crisis' && playerNames.length < 3) {
    throw new Error('Crisis mode requires 3–8 players.');
  }

  if (length === 'quick' && playerNames.length > 5) {
    throw new Error('Quick games support at most 5 players.');
  }

  const rng = mulberry32(seed);
  const seatedPlayers = shuffle(
    playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim(),
    })),
    rng,
  );

  const ministries = MINISTRY_ORDER.slice(0, playerNames.length);
  const moleIndex = mode === 'standard'
    ? Math.floor(rng() * seatedPlayers.length)
    : -1;

  const players: GamePlayer[] = seatedPlayers.map((player, seat) => {
    const ministry = ministries[seat]!;
    const ministryAgendas = AGENDAS[ministry];
    const agenda = ministryAgendas[Math.floor(rng() * 2)]!;

    return {
      ...player,
      seat,
      ministry,
      agenda,
      isMole: seat === moleIndex,
      connected: true,
      expelled: false,
      powerUsed: false,
    };
  });

  const crisisGoal = mode === 'crisis'
    ? CRISIS_GOALS[Math.floor(rng() * CRISIS_GOALS.length)]!
    : null;

  return {
    seed,
    mode,
    length,
    totalYears: length === 'full' ? 8 : 5,
    year: 0,
    players,
    molePlayerId: moleIndex < 0
      ? null
      : players[moleIndex]!.id,
    crisisGoal,
    noConfidenceUsed: false,
  };
}

/**
 * Finds the next eligible PM in seat order.
 * Disconnected and expelled players are skipped.
 */
export function nextPrimeMinister(
  game: GameSetup,
  previousSeat: number,
): GamePlayer | null {
  const count = game.players.length;

  for (let offset = 1; offset <= count; offset++) {
    const seat = (previousSeat + offset + count) % count;
    const player = game.players.find((candidate) => candidate.seat === seat);

    if (player && player.connected && !player.expelled) {
      return player;
    }
  }

  return null;
}
