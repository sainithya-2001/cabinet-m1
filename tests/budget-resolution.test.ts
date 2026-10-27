
import { describe, expect, it } from 'vitest';
import { createInitialState, defaultBudget } from '../src/engine/economy.ts';
import { PARAMETERS } from '../src/engine/parameters.ts';
import { makeCrisis } from '../src/engine/crises.ts';
import { resolveBudgetAndYear } from '../src/engine/budget-resolution.ts';
import type { YearInputs } from '../src/engine/types.ts';

const inputs: YearInputs = {
  revenueTradeModifier: 0,
  interestRate: 0.03,
  crisis: makeCrisis('outbreak', 1),
};

describe('budget resolution integration', () => {
  it('resolves a budget when its vote passes', () => {
    const budget = defaultBudget();
    const result = resolveBudgetAndYear(
      createInitialState(),
      budget,
      { yes: 4, no: 2 },
      0,
      null,
      inputs,
    );

    expect(result.status).toBe('passed');

    if (result.status === 'passed') {
      expect(result.resolution.state.year).toBe(1);
      expect(result.passedBudget).toEqual(budget);
    }
  });

  it('does not resolve the year after the first failed vote', () => {
    const result = resolveBudgetAndYear(
      createInitialState(),
      defaultBudget(),
      { yes: 2, no: 2 },
      0,
      null,
      inputs,
    );

    expect(result.status).toBe('redraft');
  });

  it('applies shutdown after a second failed vote with a previous budget', () => {
    const fallback = defaultBudget();
    const result = resolveBudgetAndYear(
      createInitialState(),
      defaultBudget(),
      { yes: 1, no: 3 },
      1,
      fallback,
      inputs,
    );

    expect(result.status).toBe('shutdown');

    if (result.status === 'shutdown') {
      expect(result.resolution.budgetScale).toBe(PARAMETERS.shutdown.budgetScale);
      expect(result.resolution.changes.stability.lines).toContainEqual(
        expect.objectContaining({
          cause: 'Government shutdown',
          raw: PARAMETERS.shutdown.stabilityPenalty,
        }),
      );
    }
  });

  it('uses the default budget for a Year 1 shutdown when no budget has passed', () => {
    const result = resolveBudgetAndYear(
      createInitialState(),
      defaultBudget(),
      { yes: 1, no: 3 },
      1,
      null,
      inputs,
    );

    expect(result.status).toBe('shutdown');

    if (result.status === 'shutdown') {
      expect(result.usedYearOneFallback).toBe(true);
      expect(result.passedBudget).toEqual(defaultBudget());
      expect(result.resolution.budgetScale).toBe(
        PARAMETERS.shutdown.budgetScale,
      );
      expect(result.resolution.changes.stability.lines).toContainEqual(
        expect.objectContaining({
          cause: 'Government shutdown',
          raw: PARAMETERS.shutdown.stabilityPenalty,
        }),
      );
    }
  });

  it('uses the last passed budget instead of the default in later years', () => {
    const previous = {
      ...createInitialState(),
      year: 1,
    };
    const fallback = {
      ...defaultBudget(),
      borrowing: 5,
    };

    const result = resolveBudgetAndYear(
      previous,
      defaultBudget(),
      { yes: 1, no: 3 },
      1,
      fallback,
      inputs,
    );

    expect(result.status).toBe('shutdown');

    if (result.status === 'shutdown') {
      expect(result.usedYearOneFallback).toBe(false);
      expect(result.passedBudget).toEqual(fallback);
    }
  });

  it('rejects an invalid proposed budget', () => {
    const invalid = {
      ...defaultBudget(),
      borrowing: -5,
    };

    expect(() =>
      resolveBudgetAndYear(
        createInitialState(),
        invalid,
        { yes: 4, no: 1 },
        0,
        null,
        inputs,
      ),
    ).toThrow(/Invalid proposed budget/);
  });
});
