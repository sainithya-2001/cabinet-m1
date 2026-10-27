import { describe, expect, it } from 'vitest';
import { makeCrisis } from './crises.ts';
import { createInitialState, resolveYear, validateBudget } from './economy.ts';
import { fallbackLiteDraft, toEngineBudget, validateLiteBudget, type LiteBudgetDraft } from './lite-budget.ts';

const balanced: LiteBudgetDraft = { health: 2, education: 2, security: 2, environment: 2, economy: 2, borrowing: 0 };
const moleBotDraft: LiteBudgetDraft = { health: 1, education: 1, security: 1, environment: 1, economy: 6, borrowing: 20 };

describe('Lite budget conversion', () => {
  it('keeps debt repayment at zero and preserves the ten-coin budget', () => {
    const budget = toEngineBudget(balanced);
    expect(budget.shares.debtRepayment).toBe(0);
    expect(Object.values(budget.shares).reduce((sum, share) => sum + share, 0)).toBe(100);
    expect(validateBudget(budget)).toEqual([]);
    const result = resolveYear(createInitialState(), budget, { revenueTradeModifier: 0, interestRate: 0.05, crisis: makeCrisis('protests', 2) });
    expect(result.spending.debtRepayment).toBe(0);
    expect(result.changes.debt.after).toBe(40);
  });
  it('uses a valid fallback for missed deadlines and shutdowns', () => {
    const fallback = toEngineBudget(fallbackLiteDraft());
    expect(validateLiteBudget(fallbackLiteDraft())).toEqual([]);
    expect(validateBudget(fallback)).toEqual([]);
    expect(fallback.shares.debtRepayment).toBe(0);
  });
  it('converts ordinary and Mole bot PM drafts through the same converter', () => {
    for (const draft of [balanced, moleBotDraft]) {
      const budget = toEngineBudget(draft);
      expect(validateBudget(budget)).toEqual([]);
      expect(budget.shares.debtRepayment).toBe(0);
      expect(Object.values(budget.shares).reduce((sum, share) => sum + share, 0)).toBe(100);
    }
  });
  it('preserves every valid ten-coin combination as exactly 100 share points', () => {
    let combinations = 0;
    for (let health=0; health<=10; health++) for (let education=0; education<=10; education++)
    for (let security=0; security<=10; security++) for (let environment=0; environment<=10; environment++) {
      const economy=10-health-education-security-environment;
      if (economy<0 || economy>10) continue;
      const draft: LiteBudgetDraft={health,education,security,environment,economy,borrowing:0};
      expect(validateLiteBudget(draft)).toEqual([]);
      const budget=toEngineBudget(draft);
      expect(Object.values(budget.shares).reduce((sum,share) => sum+share,0)).toBe(100);
      expect(budget.shares.debtRepayment).toBe(0);
      combinations++;
    }
    expect(combinations).toBe(1001);
  });
  it('resolves three years of timeout shutdown budgets without invalid budgets', () => {
    let country=createInitialState();
    for (let year=1; year<=3; year++) {
      const budget=toEngineBudget(fallbackLiteDraft());
      expect(validateBudget(budget)).toEqual([]);
      country=resolveYear(country,budget,{revenueTradeModifier:0,interestRate:0.05,crisis:makeCrisis('protests',2),shutdown:true}).state;
      expect(country.year).toBe(year);
      if (country.collapsed) break;
    }
    expect(country.year).toBeGreaterThan(0);
  });
});