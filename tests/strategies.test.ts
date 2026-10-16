import { describe, expect, it } from 'vitest';
import {
  canAffordRecklessTargets,
  chooseBudget,
  planMoleBudget,
  planRecklessBudget,
  recklessTargetSpending,
} from '../src/simulator/strategies.js';
import { defaultBudget } from '../src/engine/economy.js';
import type { CountryState, Sector } from '../src/engine/types.js';

const needs = {
  health: 20,
  education: 14,
  security: 14,
  infrastructure: 16,
  environment: 10,
  industry: 14,
};

const state = {
  economy: 50,
  happiness: 55,
  stability: 55,
  environment: 50,
} as CountryState;

function expectValidShares(shares: Record<Sector, number>) {
  const values = Object.values(shares);
  expect(values.every(Number.isInteger)).toBe(true);
  expect(values.every((share) => share >= 0 && share <= 100)).toBe(true);
  expect(values.reduce((sum, share) => sum + share, 0)).toBe(100);
}

describe('Cabinet strategy agents', () => {
  it('returns a valid default budget', () => {
    const budget = defaultBudget();
    expectValidShares(budget.shares);
    expect(budget.borrowing).toBe(0);
  });

  it('returns valid budgets for each strategy', () => {
    for (const strategy of [
      'balanced',
      'greedy-agenda',
      'reckless',
      'mole',
    ] as const) {
      expectValidShares(chooseBudget(strategy, state).shares);
    }
  });
});

describe('Reckless strategy planning', () => {
  it('targets 1.3 times each sector need', () => {
    const targets = recklessTargetSpending(needs);
    expect(targets.health).toBeCloseTo(26);
    expect(targets.education).toBeCloseTo(18.2);
    expect(targets.security).toBeCloseTo(18.2);
    expect(targets.infrastructure).toBeCloseTo(20.8);
    expect(targets.environment).toBeCloseTo(13);
    expect(targets.industry).toBeCloseTo(18.2);
  });

  it('checks whether all targets are affordable', () => {
    const total = Object.values(recklessTargetSpending(needs))
      .reduce((sum, amount) => sum + amount, 0);
    expect(canAffordRecklessTargets(total, needs)).toBe(true);
    expect(canAffordRecklessTargets(total - 1, needs)).toBe(false);
  });

  it('returns valid budget shares', () => {
    const result = planRecklessBudget(200, needs);
    expectValidShares(result.budget.shares);
    expect(result.affordable).toBe(true);
  });

  it('reports when targets are unaffordable', () => {
    expect(planRecklessBudget(0, needs).affordable).toBe(false);
  });
});

describe('Mole strategy planning', () => {
  it('returns valid budget shares', () => {
    expectValidShares(planMoleBudget(needs).shares);
  });

  it('does not allocate shares to debt repayment when targets exceed funds', () => {
    const budget = planMoleBudget(needs, {});
    expect(budget.shares.debtRepayment).toBe(0);
    expectValidShares(budget.shares);
  });

  it('reduces the crisis sector target to 60% of its need', () => {
    const budget = planMoleBudget(needs, { health: 10 });
    expectValidShares(budget.shares);
    expect(budget.shares.health).toBeLessThan(budget.shares.education);
  });

  it('is deterministic for identical inputs', () => {
    expect(planMoleBudget(needs, { health: 10 })).toEqual(
  planMoleBudget(needs, { health: 10 }),
);
  });
});
