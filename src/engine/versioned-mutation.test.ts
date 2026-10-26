import { describe, expect, it } from 'vitest';
import { mutateVersionedState, type VersionedStateAdapter } from './versioned-mutation.js';
import { toPublicGameState } from './public-game-state.js';

type State = { version: number; status: string; votes: Record<string, boolean>; budget: string | null; privateByPlayer?: Record<string, { clue: string; trueValue: number; isMole: boolean }>; players?: Array<{ id: string; isMole?: boolean }>; publishedClues?: Array<Record<string, unknown>> };
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
    const visible = toPublicGameState({
      version: 3, status: 'playing',
      privateByPlayer: { alice: { clue: 'PRIVATE-CLUE-TEST', trueValue: 117, isMole: true } },
      players: [{ id: 'alice', isMole: true }, { id: 'bob', isMole: false }],
      publishedClues: [{ playerId: 'alice', value: 110, trueValue: 117, clue: 'PRIVATE-CLUE-TEST', isMole: true }],
    });
    const serialized = JSON.stringify(visible);
    expect(serialized).not.toContain('PRIVATE-CLUE-TEST');
    expect(serialized).not.toContain('trueValue');
    expect(serialized).not.toContain('"isMole"');
    expect(visible.publishedClues).toEqual([{ playerId: 'alice', value: 110 }]);
  });
});
