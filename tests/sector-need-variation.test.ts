import { describe, expect, it } from 'vitest';
import { sectorNeeds, yearNeedVariationSeed } from '../src/engine/economy.ts';
import { makeCrisis } from '../src/engine/crises.ts';

describe('seeded yearly sector needs', () => {
  it('is repeatable per year and varies sector needs within ±20%', () => {
    const crisis = makeCrisis('outbreak', 2);
    const seed1 = yearNeedVariationSeed(1_760_000_000_000, 1);
    const seed2 = yearNeedVariationSeed(1_760_000_000_000, 2);
    const inputs = (seed: number) => ({ revenueTradeModifier: 0 as const, interestRate: 0.05 as const, crisis, needVariationSeed: seed });
    const first = sectorNeeds(inputs(seed1));
    expect(sectorNeeds(inputs(seed1))).toEqual(first);
    const second = sectorNeeds(inputs(seed2));
    const baseline = { health: 20, education: 14, security: 14, infrastructure: 16, environment: 10, industry: 14 };
    for (const sector of Object.keys(first) as Array<keyof typeof first>) {
      const crisisAdjusted = baseline[sector] + (crisis.needChanges[sector] ?? 0);
      expect(first[sector]).toBeGreaterThanOrEqual(Math.round(crisisAdjusted * 0.8));
      expect(first[sector]).toBeLessThanOrEqual(Math.round(crisisAdjusted * 1.2));
    }
    expect(Object.keys(first).some(key => first[key as keyof typeof first] !== second[key as keyof typeof second])).toBe(true);
  });
  it('keeps unseeded engine calls backward compatible', () => {
    expect(sectorNeeds({ revenueTradeModifier: 0, interestRate: 0.05, crisis: makeCrisis('outbreak', 2) }).health).toBe(36);
  });
});
