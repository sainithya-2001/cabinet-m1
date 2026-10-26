
import { describe, expect, it } from 'vitest';
import { defaultBudget } from '../src/engine/economy.ts';
import {
  resolveBudgetAttempt,
  resolveBudgetVote,
} from '../src/engine/budget-vote.ts';

describe('budget voting', () => {
  it('passes only when Yes exceeds No', () => {
    expect(resolveBudgetVote({ yes: 4, no: 3 }).passed).toBe(true);
    expect(resolveBudgetVote({ yes: 3, no: 3 }).passed).toBe(false);
    expect(resolveBudgetVote({ yes: 0, no: 0 }).passed).toBe(false);
    expect(resolveBudgetVote({ yes: 2, no: 4 }).passed).toBe(false);
  });

  it('rejects invalid vote counts', () => {
    expect(() => resolveBudgetVote({ yes: -1, no: 0 })).toThrow();
    expect(() => resolveBudgetVote({ yes: 1.5, no: 0 })).toThrow();
  });

  it('requests a redraft after the first failed vote', () => {
    const result = resolveBudgetAttempt(
      defaultBudget(),
      { yes: 2, no: 2 },
      0,
      null,
    );

    expect(result.status).toBe('redraft');
  });

  it('uses the last passed budget after the second failed vote', () => {
    const fallback = defaultBudget();

    const result = resolveBudgetAttempt(
      defaultBudget(),
      { yes: 1, no: 3 },
      1,
      fallback,
    );

    expect(result.status).toBe('shutdown');

    if (result.status === 'shutdown') {
      expect(result.fallbackBudget).toEqual(fallback);
    }
  });

  it('does not enter shutdown without a fallback budget', () => {
    expect(() =>
      resolveBudgetAttempt(
        defaultBudget(),
        { yes: 0, no: 1 },
        1,
        null,
      ),
    ).toThrow();
  });

  it('accepts a passed budget on either attempt', () => {
    const budget = defaultBudget();

    expect(
      resolveBudgetAttempt(budget, { yes: 3, no: 1 }, 0, null).status,
    ).toBe('passed');

    expect(
      resolveBudgetAttempt(budget, { yes: 3, no: 1 }, 1, null).status,
    ).toBe('passed');
  });
});
