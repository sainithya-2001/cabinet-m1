
import { describe, expect, it } from 'vitest';
import { createGameSetup } from '../src/engine/game.ts';
import {
  advancePhase,
  createGameFlow,
  finishGameOnCollapse,
  getCurrentPrimeMinister,
} from '../src/engine/game-flow.ts';

function makeFlow() {
  const setup = createGameSetup(
    12345,
    ['Alex', 'Blair', 'Casey', 'Devon'],
    'crisis',
    'full',
  );

  return createGameFlow(setup);
}

describe('game flow', () => {
  it('starts in News with an eligible Prime Minister', () => {
    const flow = makeFlow();

    expect(flow.phase).toBe('news');
    expect(getCurrentPrimeMinister(flow)).not.toBeNull();
  });

  it('advances through the six phases in order', () => {
    let flow = makeFlow();

    for (const phase of [
      'intel',
      'debate',
      'draft',
      'vote',
      'resolve',
    ] as const) {
      flow = advancePhase(flow);
      expect(flow.phase).toBe(phase);
    }
  });

  it('starts the next year in News and rotates the PM', () => {
    let flow = makeFlow();
    const firstPmId = flow.primeMinisterId;

    for (let i = 0; i < 6; i++) {
      flow = advancePhase(flow);
    }

    expect(flow.setup.year).toBe(1);
    expect(flow.phase).toBe('news');
    expect(flow.primeMinisterId).not.toBe(firstPmId);
  });

  it('preserves ministry power usage when a new year starts', () => {
  let flow = makeFlow();

  flow.setup.players[0]!.powerUsed = true;

  for (let i = 0; i < 6; i++) {
    flow = advancePhase(flow);
  }

  expect(flow.setup.year).toBe(1);
  expect(flow.setup.players[0]!.powerUsed).toBe(true);
});

  it('finishes after the configured number of years', () => {
    let flow = createGameFlow(
      createGameSetup(
        12345,
        ['Alex', 'Blair', 'Casey'],
        'crisis',
        'quick',
      ),
    );

    for (let i = 0; i < 5 * 6; i++) {
      flow = advancePhase(flow);
    }

    expect(flow.phase).toBe('finished');
    expect(flow.setup.year).toBe(5);
    expect(() => advancePhase(flow)).toThrow();
  });

  it('does not select a disconnected or expelled player as PM', () => {
    const flow = makeFlow();
    const firstPm = getCurrentPrimeMinister(flow)!;

    firstPm.connected = false;

    const nextFlow = advancePhase(flow);

    expect(nextFlow.phase).toBe('intel');
    expect(getCurrentPrimeMinister(nextFlow)).toBeNull();
  });

  it('finishes immediately when the country collapses', () => {
    const flow = makeFlow();

    const finished = finishGameOnCollapse(flow, true);

    expect(finished.phase).toBe('finished');
  });

  it('leaves the game flow unchanged when the country has not collapsed', () => {
    const flow = makeFlow();

    const unchanged = finishGameOnCollapse(flow, false);

    expect(unchanged).toEqual(flow);
  });

});
