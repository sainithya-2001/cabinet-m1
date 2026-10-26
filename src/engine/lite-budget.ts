import type { Budget, Sector } from './types.js';

export type LiteBudgetLine = 'health' | 'education' | 'security' | 'environment' | 'economy';
export type LiteBudgetDraft = Record<LiteBudgetLine, number> & {
  borrowing: 0 | 10 | 20;
};

export const LITE_BUDGET_LINES: readonly LiteBudgetLine[] = [
  'health',
  'education',
  'security',
  'environment',
  'economy',
] as const;

export const LITE_YEARS = 3;
export const LITE_MIN_SEATS = 5;
export const LITE_MAX_HUMANS = 6;

export function validateLiteBudget(draft: LiteBudgetDraft): string[] {
  const errors: string[] = [];
  const counts = LITE_BUDGET_LINES.map((line) => draft[line]);

  if (counts.some((count) => !Number.isInteger(count) || count < 0 || count > 10)) {
    errors.push('Each budget line must contain 0–10 whole coins.');
  }
  if (counts.reduce((sum, count) => sum + count, 0) !== 10) {
    errors.push('The budget must allocate exactly 10 coins.');
  }
  if (![0, 10, 20].includes(draft.borrowing)) {
    errors.push('Borrowing must be 0, 10, or 20.');
  }

  return errors;
}

/** Converts the five-line Lite budget into the seven-sector engine format. */
export function toEngineBudget(draft: LiteBudgetDraft): Budget {
  const errors = validateLiteBudget(draft);
  if (errors.length) throw new Error(errors.join(' '));

  const shares: Record<Sector, number> = {
    health: draft.health * 10,
    education: draft.education * 10,
    security: draft.security * 10,
    infrastructure: draft.economy * 5,
    environment: draft.environment * 10,
    industry: draft.economy * 5,
    debtRepayment: 0,
  };

  return { shares, borrowing: draft.borrowing };
}

/** Reverse mapping for displaying a passed engine budget in the Lite UI. */
export function fromEngineBudget(budget: Budget): LiteBudgetDraft {
  const pairs: Array<[LiteBudgetLine, number]> = [
    ['health', budget.shares.health / 10],
    ['education', budget.shares.education / 10],
    ['security', budget.shares.security / 10],
    ['environment', budget.shares.environment / 10],
    ['economy', (budget.shares.infrastructure + budget.shares.industry) / 10],
  ];

  const valuesByLine = Object.fromEntries(pairs) as Record<LiteBudgetLine, number>;
  const result: Record<LiteBudgetLine, number> = {
    health: valuesByLine.health,
    education: valuesByLine.education,
    security: valuesByLine.security,
    environment: valuesByLine.environment,
    economy: valuesByLine.economy,
  };
  if (pairs.some(([, value]) => !Number.isInteger(value))) {
    throw new Error('This engine budget cannot be represented by the Lite coin UI.');
  }
  if (budget.shares.debtRepayment !== 0) {
    throw new Error('Lite budgets do not allocate coins to debt repayment.');
  }
  if (pairs.reduce((sum, [, value]) => sum + value, 0) !== 10) {
    throw new Error('This engine budget does not map to exactly 10 Lite coins.');
  }
  if (![0, 10, 20].includes(budget.borrowing)) {
    throw new Error('This engine budget uses a borrowing option unavailable in Lite.');
  }

  return { ...result, borrowing: budget.borrowing as 0 | 10 | 20 };
}
