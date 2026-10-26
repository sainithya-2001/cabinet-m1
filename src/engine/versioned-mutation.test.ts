import { describe, expect, it } from 'vitest';
import { mutateVersionedState, type VersionedStateAdapter } from './versioned-mutation.ts';
import { toPublicGameState, type GamePlayer } from './public-game-state.ts';

type State = { version: number; status: string; votes: Record<string, boolean>; budget: string | null; privateByPlayer?: Record<string, { clue: string; trueValue: number; isMole: boolean }>; players?: Array<{ id: string; isMole?: boolean }>; publishedClues?: Array<Record<string, unknown>> };
type PrivatePlayerData = { ministry: string; isMole: boolean; clue: string; trueValue: number };
function makePlayer(id: string, isMole = false): GamePlayer {
  return { id, name: id, seat: id === 'alice' ? 0 : 1, isBot: false, ministry: 'Health', isMole, ready: false };
}
function makePrivate(overrides: Partial<PrivatePlayerData> = {}): PrivatePlayerData {
  return { ministry: 'Health', isMole: false, clue: 'A private clue', trueValue: 42, ...overrides };
}
function store(initial: State, synchronizeReads = false) {
  let current = initial;
  let reads = 0;
  let release: (() => void) | undefined;
  const gate = synchronizeReads ? new Promise<void>(resolve => { release = resolve; }) : null;
  const adapter: VersionedStateAdapter<State> = {
    async read() {
      reads++;
      if (gate && reads <= 2) {
        if (reads === 2) release?.();
        await gate;
      }
      return { state: structuredClone(current), status: current.status };
    },
    async compareAndSwap(expectedVersion, next, status) {
      if (current.version !== (expectedVersion ?? 0)) return false;
      current = { ...structuredClone(next), status };
      return true;
    },
  };
  return { adapter, get: () => structuredClone(current) };
}
describe('mutateVersionedState', () => {
  it('keeps two concurrent votes', async () => {
    const db = store({ version: 1, status: 'playing', votes: {}, budget: null }, true);
    await Promise.all([
      mutateVersionedState(db.adapter, s => ({ state: { ...s!, votes: { ...s!.votes, alice: true } } })),
      mutateVersionedState(db.adapter, s => ({ state: { ...s!, votes: { ...s!.votes, bob: false } } })),
    ]);
    expect(db.get().votes).toEqual({ alice: true, bob: false });
    expect(db.get().version).toBe(3);
  });
  it('keeps a budget submission and a concurrent vote', async () => {
    const db = store({ version: 1, status: 'playing', votes: {}, budget: null }, true);
    await Promise.all([
      mutateVersionedState(db.adapter, s => ({ state: { ...s!, budget: 'submitted-budget' } })),
      mutateVersionedState(db.adapter, s => ({ state: { ...s!, votes: { ...s!.votes, bob: true } } })),
    ]);
    expect(db.get().budget).toBe('submitted-budget');
    expect(db.get().votes).toEqual({ bob: true });
    expect(db.get().version).toBe(3);
  });
  it('returns the retry error after five failed compare-and-swap attempts', async () => {
    let reads = 0, writes = 0;
    const adapter: VersionedStateAdapter<State> = {
      async read() { reads++; return { state: { version: reads, status: 'playing', votes: {}, budget: null }, status: 'playing' }; },
      async compareAndSwap() { writes++; return false; },
    };
    await expect(mutateVersionedState(adapter, s => ({ state: { ...s!, votes: { a: true } } }))).rejects.toThrow('Please try again');
    expect(reads).toBe(5);
    expect(writes).toBe(5);
  });
});
describe('public state privacy', () => {
  it('never exposes private clues, true clue values, or the Mole flag', () => {
    const validState = {
      version: 3,
      status: 'playing' as const,
      createdAt: 1,
      phase: 'discussion',
      phaseStartedAt: 1,
      phaseDeadline: null,
      year: 1,
      players: [makePlayer('alice', true), makePlayer('bob')],
      privateByPlayer: { alice: makePrivate({ isMole: true, clue: 'PRIVATE-CLUE-TEST', trueValue: 117 }) },
      publishedClues: [{ playerId: 'alice', name: 'alice', ministry: 'Health', value: 110, year: 1, at: 1 }],
      readyByPlayer: {},
      budgetDraft: null,
      votes: {},
      result: null,
      lastActionAt: {},
      chat: [],
      country: null,
      lastPassedBudget: null,
      failedVotes: 0 as const,
      pendingBudget: null,
      voteChoices: {},
      crisisId: null,
      yearResolution: null,
      primeMinisterId: 'alice',
      guesses: {},
      botPlan: {},
    };
    // Deliberately malformed test-only input plants private fields in a published clue
    // to verify that the public projection strips them even if bad state reaches it.
    const deliberatelyBadState = {
      ...validState,
      publishedClues: [{
        ...validState.publishedClues[0],
        trueValue: 117,
        isMole: true,
        clue: 'PRIVATE-CLUE-TEST',
      }],
    } as unknown as Parameters<typeof toPublicGameState>[0];
    const visible = toPublicGameState(deliberatelyBadState);
    const serialized = JSON.stringify(visible);
    expect(serialized).not.toContain('PRIVATE-CLUE-TEST');
    expect(serialized).not.toContain('trueValue');
    expect(serialized).not.toContain('"isMole"');
    expect(visible.publishedClues).toEqual([{ playerId: 'alice', name: 'alice', ministry: 'Health', value: 110, year: 1, at: 1 }]);
  });
});
