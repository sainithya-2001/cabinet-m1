
import type { GamePlayer, GameSetup } from './game.ts';

export type GamePhase =
  | 'news'
  | 'intel'
  | 'debate'
  | 'draft'
  | 'vote'
  | 'resolve'
  | 'finished';

export interface GameFlow {
  setup: GameSetup;
  phase: GamePhase;
  primeMinisterId: string | null;
  previousPrimeMinisterSeat: number;
}

const PHASE_ORDER: readonly GamePhase[] = [
  'news',
  'intel',
  'debate',
  'draft',
  'vote',
  'resolve',
];

export function createGameFlow(setup: GameSetup): GameFlow {
  if (setup.year !== 0) {
    throw new Error('A new game must start before Year 1.');
  }

  const firstPrimeMinister = setup.players
    .filter((player) => player.connected && !player.expelled)
    .sort((a, b) => a.seat - b.seat)[0];

  if (!firstPrimeMinister) {
    throw new Error('Cannot start a game without an eligible player.');
  }

  return {
    setup,
    phase: 'news',
    primeMinisterId: firstPrimeMinister.id,
    previousPrimeMinisterSeat: firstPrimeMinister.seat,
  };
}

export function getCurrentPrimeMinister(
  flow: GameFlow,
): GamePlayer | null {
  if (!flow.primeMinisterId) {
    return null;
  }

  return flow.setup.players.find(
    (player) =>
      player.id === flow.primeMinisterId &&
      player.connected &&
      !player.expelled,
  ) ?? null;
}

export function advancePhase(flow: GameFlow): GameFlow {
  if (flow.phase === 'finished') {
    throw new Error('The game has already finished.');
  }

  if (flow.phase !== 'resolve') {
    const currentIndex = PHASE_ORDER.indexOf(flow.phase);
    const nextPhase = PHASE_ORDER[currentIndex + 1];

    if (!nextPhase) {
      throw new Error(`Cannot advance from phase "${flow.phase}".`);
    }

    return { ...flow, phase: nextPhase };
  }

  const nextYear = flow.setup.year + 1;

  if (nextYear >= flow.setup.totalYears) {
    return {
      ...flow,
      phase: 'finished',
      setup: { ...flow.setup, year: nextYear },
    };
  }

  const eligiblePlayers = flow.setup.players.filter(
    (player) => player.connected && !player.expelled,
  );

  if (eligiblePlayers.length === 0) {
    throw new Error('Cannot start another year without an eligible player.');
  }

  const count = flow.setup.players.length;
  let nextPrimeMinister: GamePlayer | undefined;

  for (let offset = 1; offset <= count; offset++) {
    const seat =
      (flow.previousPrimeMinisterSeat + offset + count) % count;

    nextPrimeMinister = eligiblePlayers.find(
      (player) => player.seat === seat,
    );

    if (nextPrimeMinister) {
      break;
    }
  }

  if (!nextPrimeMinister) {
    throw new Error('Could not find the next Prime Minister.');
  }

  const players = flow.setup.players.map((player) => ({
  ...player,
}));

  return {
    setup: {
      ...flow.setup,
      year: nextYear,
      players,
    },
    phase: 'news',
    primeMinisterId: nextPrimeMinister.id,
    previousPrimeMinisterSeat: nextPrimeMinister.seat,
  };
}

/**
 * Ends the game immediately when the country collapses.
 * The caller supplies the authoritative country state.
 */
export function finishGameOnCollapse(
  flow: GameFlow,
  collapsed: boolean,
): GameFlow {
  if (!collapsed) {
    return flow;
  }

  return {
    ...flow,
    phase: 'finished',
  };
}
