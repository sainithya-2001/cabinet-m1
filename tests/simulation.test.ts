import { describe, expect, it } from 'vitest';
import { createConditions, runSimulation } from '../src/simulator/simulation.js';

describe('Cabinet simulator', () => {
  it('produces identical results for repeated runs with the same seed count', () => {
    const first = runSimulation({ seeds: 10 });
    const second = runSimulation({ seeds: 10 });

    expect(first).toEqual(second);
  });

  it('reports the requested seed count for every strategy', () => {
    const result = runSimulation({ seeds: 5 });

    expect(result.results).toHaveLength(4);

    for (const strategy of result.results) {
      expect(strategy.seeds).toBe(5);
    }
  });
it('uses the fixed tutorial crisis and avoids repeating crises', () => {
  const first = createConditions(123);
  const second = createConditions(123);

  expect(first).toEqual(second);
  expect(first).toHaveLength(8);
  expect(first[0]).toMatchObject({
    crisisId: 'outbreak',
    severity: 1,
  });

  const crisisIds = first.map(year => year.crisisId);
  expect(new Set(crisisIds).size).toBe(8);
});
});