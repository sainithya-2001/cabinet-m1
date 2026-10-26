import { describe, expect, it } from 'vitest';
import { makeCrisis } from './crises.ts';
import { createInitialState, resolveYear } from './economy.ts';
import { toEngineBudget } from './lite-budget.ts';

describe('Lite debt handling', () => {
  it('keeps debt unchanged when borrowing is zero', () => {
    const budget = toEngineBudget({
      health: 2, education: 2, security: 2, environment: 2, economy: 2, borrowing: 0,
    });
    const result = resolveYear(createInitialState(), budget, {
      revenueTradeModifier: 0, interestRate: 0.05, crisis: makeCrisis('protests', 2),
    });
    expect(budget.shares.debtRepayment).toBe(0);
    expect(result.spending.debtRepayment).toBe(0);
    expect(result.changes.debt.after).toBe(40);
  });
});
