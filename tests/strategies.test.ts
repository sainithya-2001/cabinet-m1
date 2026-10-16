import { describe, expect, it } from 'vitest';
import {
  canAffordRecklessTargets,
  chooseBudget,
  planMoleBudget,
  planRecklessBudget,
  recklessTargetSpending,
} from '../src/simulator/strategies.js';
import { PARAMETERS } from '../src/engine/parameters.js';
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

  it('returns a valid budget for the balanced strategy', () => {
    const budget = chooseBudget('balanced', state);

    expectValidShares(budget.shares);
    expect(budget.borrowing).toBeGreaterThanOrEqual(0);
    expect(budget.borrowing).toBeLessThanOrEqual(PARAMETERS.borrowing.max);
  });

  it('returns a valid budget for the greedy-agenda strategy', () => {
    const budget = chooseBudget('greedy-agenda', state, 'economy');

    expectValidShares(budget.shares);
    expect(budget.borrowing).toBeGreaterThanOrEqual(0);
    expect(budget.borrowing).toBeLessThanOrEqual(PARAMETERS.borrowing.max);
  });

  it('returns a valid budget for the reckless strategy', () => {
    const budget = chooseBudget('reckless', state);

    expectValidShares(budget.shares);
    expect(budget.borrowing).toBe(PARAMETERS.borrowing.max);
  });

  it('returns a valid budget for the mole strategy', () => {
    const budget = chooseBudget('mole', state);

    expectValidShares(budget.shares);
    expect(budget.borrowing).toBe(PARAMETERS.borrowing.max);
  });

  it('is deterministic for the same strategy and inputs', () => {
    expect(chooseBudget('balanced', state)).toEqual(
      chooseBudget('balanced', state),
    );
  });
});

describe('Reckless strategy planning', () => {
  it('increases each sector target by 1.3 times its need', () => {
    const targets = recklessTargetSpending(needs);

    expect(targets.health).toBeCloseTo(26);
    expect(targets.education).toBeCloseTo(18.2);
    expect(targets.security).toBeCloseTo(18.2);
    expect(targets.infrastructure).toBeCloseTo(20.8);
    expect(targets.environment).toBeCloseTo(13);
    expect(targets.industry).toBeCloseTo(18.2);
  });

  it('detects when available funds cover all reckless targets', () => {
    const totalTargets = Object.values(recklessTargetSpending(needs))
      .reduce((sum, amount) => sum + amount, 0);

    expect(canAffordRecklessTargets(totalTargets, needs)).toBe(true);
    expect(canAffordRecklessTargets(totalTargets - 1, needs)).toBe(false);
  });

  it('returns valid shares and reports affordability', () => {
    const totalTargets = Object.values(recklessTargetSpending(needs))
      .reduce((sum, amount) => sum + amount, 0);

    const result = planRecklessBudget(totalTargets, needs);

    expectValidShares(result.budget.shares);
    expect(result.budget.borrowing).toBe(PARAMETERS.borrowing.max);
    expect(result.budget.shares.debtRepayment).toBe(0);
    expect(result.affordable).toBe(true);
  });

  it('reports unaffordable targets when funds are insufficient', () => {
    const result = planRecklessBudget(0, needs);

    expect(result.affordable).toBe(false);
    expectValidShares(result.budget.shares);
  });
});

describe('Mole strategy planning', () => {
  it('returns valid shares that sum to 100', () => {
    const budget = planMoleBudget(needs);

    expectValidShares(budget.shares);
  });

  it('borrows the configured maximum', () => {
    const budget = planMoleBudget(needs);

    expect(budget.borrowing).toBe(PARAMETERS.borrowing.max);
  });

  it('does not allocate money to debt repayment', () => {
    const budget = planMoleBudget(needs);

    expect(budget.shares.debtRepayment).toBe(0);
  });

  it('reduces the relative allocation to the crisis sector', () => {
    const budget = planMoleBudget(needs, { health: 10 });

    // The current Mole planner targets the crisis sector at 60% of its need.
    // It distributes shares proportionally across all six sector targets.
    expectValidShares(budget.shares);
    expect(budget.shares.health).toBeLessThan(budget.shares.education);
  });

  it('is deterministic for the same needs and crisis changes', () => {
    expect(planMoleBudget(needs, { health: 10 })).toEqual(
      planMoleBudget(needs, { health: 10 }),
    );
  });
});
