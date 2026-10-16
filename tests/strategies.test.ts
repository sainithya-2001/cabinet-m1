
import { describe, expect, it } from 'vitest';
import { createInitialState, validateBudget } from '../src/engine/index.js';

import {
  canAffordRecklessTargets,
  chooseBudget,
  planMoleBudget,
  planRecklessBudget,
  recklessTargetSpending,
} from '../src/simulator/strategies.js';


describe('Cabinet strategy agents', () => {
  const strategies = [
    'balanced',
    'greedy-agenda',
    'reckless',
    'mole',
  ] as const;

  for (const strategy of strategies) {
    it(`${strategy} produces a valid budget`, () => {
      const budget = chooseBudget(strategy, createInitialState());

      expect(
        Object.values(budget.shares).reduce((sum, share) => sum + share, 0),
      ).toBe(100);

      expect(validateBudget(budget)).toEqual([]);
    });
  }

  it('greedy-agenda can prioritize different targets', () => {
    const state = createInitialState();

    const economy = chooseBudget('greedy-agenda', state, 'economy');
    const happiness = chooseBudget('greedy-agenda', state, 'happiness');

    expect(economy.shares.industry).toBeGreaterThan(happiness.shares.industry);
    expect(happiness.shares.health).toBeGreaterThan(economy.shares.health);
  });
it('reckless always borrows 30 and allocates nothing to debt repayment', () => {
  const budget = chooseBudget('reckless', createInitialState());

  expect(budget.borrowing).toBe(30);
  expect(budget.shares.debtRepayment).toBe(0);
  expect(
    Object.values(budget.shares).reduce((sum, share) => sum + share, 0),
  ).toBe(100);
});
it('calculates Reckless targets at 1.3 times each sector need', () => {
  expect(
    recklessTargetSpending({
      health: 20,
      education: 14,
      security: 14,
      infrastructure: 16,
      environment: 10,
      industry: 14,
    }),
  ).toEqual({
    health: 26,
    education: 18.2,
    security: 18.2,
    infrastructure: 20.8,
    environment: 13,
    industry: 18.2,
  });
});
});

it('checks whether Reckless target spending is affordable', () => {
  const needs = {
    health: 20,
    education: 14,
    security: 14,
    infrastructure: 16,
    environment: 10,
    industry: 14,
  };

  expect(canAffordRecklessTargets(115, needs)).toBe(true);
  expect(canAffordRecklessTargets(114, needs)).toBe(false);
});

it('plans a valid Reckless budget and reports affordability', () => {
  const needs = {
    health: 20,
    education: 14,
    security: 14,
    infrastructure: 16,
    environment: 10,
    industry: 14,
  };

  const affordablePlan = planRecklessBudget(115, needs);
  const unaffordablePlan = planRecklessBudget(114, needs);

  expect(affordablePlan.affordable).toBe(true);
  expect(unaffordablePlan.affordable).toBe(false);

  expect(affordablePlan.budget.borrowing).toBe(30);
  expect(affordablePlan.budget.shares.debtRepayment).toBe(0);
  expect(
    Object.values(affordablePlan.budget.shares).reduce(
      (sum, share) => sum + share,
      0,
    ),
  ).toBe(100);

  for (const share of Object.values(affordablePlan.budget.shares)) {
    expect(Number.isInteger(share)).toBe(true);
  }
});

it('uses the planning context for the Reckless budget', () => {
  const needs = {
    health: 20,
    education: 14,
    security: 14,
    infrastructure: 16,
    environment: 10,
    industry: 14,
  };

  const budget = chooseBudget(
    'reckless',
    createInitialState(),
    'economy',
    { availableFunds: 115, needs },
  );

  expect(budget.borrowing).toBe(30);
  expect(budget.shares.debtRepayment).toBe(0);
  expect(
    Object.values(budget.shares).reduce((sum, share) => sum + share, 0),
  ).toBe(100);
  expect(budget.shares).toEqual(
    planRecklessBudget(115, needs).budget.shares,
  );
});

describe('Mole strategy planning', () => {
  const needs = {
    health: 20,
    education: 14,
    security: 14,
    infrastructure: 16,
    environment: 10,
    industry: 14,
  };

  it('underfunds the sector with the largest crisis-driven need increase', () => {
    const budget = planMoleBudget(needs, {
      health: 8,
      infrastructure: 4,
    });

    // Health receives less funding relative to its need than other sectors.
    expect(budget.shares.health / needs.health).toBeLessThan(
      budget.shares.education / needs.education,
    );
    expect(budget.shares.debtRepayment).toBe(0);
    expect(budget.borrowing).toBe(30);
  });

  it('falls back to industry when no sector need increases', () => {
    const budget = planMoleBudget(needs, {});

    expect(budget.shares.industry / needs.industry).toBeLessThan(
      budget.shares.health / needs.health,
    );
  });

  it('produces integer shares totaling 100 and a valid budget', () => {
    const budget = planMoleBudget(needs, { security: 5 });

    expect(
      Object.values(budget.shares).reduce((sum, share) => sum + share, 0),
    ).toBe(100);

    for (const share of Object.values(budget.shares)) {
      expect(Number.isInteger(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0);
    }

    expect(validateBudget(budget)).toEqual([]);
  });
});