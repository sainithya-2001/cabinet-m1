import { createPublicRevenueRange } from '../src/simulator/simulation.js';
import { describe, expect, it } from 'vitest';
import { createConditions, runSimulation } from '../src/simulator/simulation.js';

describe('public revenue range', () => {
  it('contains actual revenue and has a width of 20', () => {
    for (let actualRevenue = 60; actualRevenue <= 140; actualRevenue++) {
      for (let offset = 0; offset <= 20; offset++) {
        const range = createPublicRevenueRange(actualRevenue, offset);

        expect(range.low).toBeLessThanOrEqual(actualRevenue);
        expect(range.high).toBeGreaterThanOrEqual(actualRevenue);
        expect(range.high - range.low).toBe(20);
        expect(range.midpoint).toBe(range.low + 10);
      }
    }
  });

  it('provides the public midpoint, not the hidden actual revenue', () => {
    const firstRange = createPublicRevenueRange(100, 10);
    const secondRange = createPublicRevenueRange(105, 15);

    // Both scenarios expose the same public range and midpoint.
    expect(firstRange).toEqual({
      low: 90,
      high: 110,
      midpoint: 100,
    });
    expect(secondRange).toEqual(firstRange);
  });
});
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

  it('keeps environmental conditions stable for a known seed', () => {
    const conditions = createConditions(123);

    const environmentalConditions = conditions.map(
      ({ crisisId, severity, revenueTradeModifier, interestRate }) => [
        crisisId,
        severity,
        revenueTradeModifier,
        interestRate,
      ],
    );

    expect(environmentalConditions).toEqual([
      ['outbreak', 1, 4, 0.08],
      ['energy-price-spike', 1, -8, 0.05],
      ['floods', 1, 0, 0.05],
      ['housing-shortage', 1, 0, 0.08],
      ['heatwave', 1, -8, 0.03],
      ['tech-breakthrough', 2, 8, 0.03],
      ['cyberattack', 2, 8, 0.08],
      ['recession', 3, -8, 0.05],
    ]);
  });
});
