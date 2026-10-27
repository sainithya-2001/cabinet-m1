
import {
  defaultBudget,
  resolveYear,
  validateBudget,
} from './economy.ts';
import { resolveBudgetAttempt } from './budget-vote.ts';
import type { Budget } from './types.ts';
import type { CountryState, YearInputs, YearResolution } from './types.ts';
import type { BudgetVote } from './budget-vote.ts';

export type BudgetResolutionResult =
  | {
      status: 'passed';
      resolution: YearResolution;
      passedBudget: Budget;
    }
  | {
      status: 'redraft';
      failedAttempts: 1;
      vote: { passed: false; yes: number; no: number };
    }
  | {
      status: 'shutdown';
      failedAttempts: 2;
      resolution: YearResolution;
      passedBudget: Budget;
      usedYearOneFallback: boolean;
    };

export function resolveBudgetAndYear(
  previous: CountryState,
  proposedBudget: Budget,
  vote: BudgetVote,
  failedAttempts: 0 | 1,
  lastPassedBudget: Budget | null,
  inputs: YearInputs,
): BudgetResolutionResult {
  const proposedErrors = validateBudget(proposedBudget);
  if (proposedErrors.length > 0) {
    throw new Error(`Invalid proposed budget: ${proposedErrors.join(' ')}`);
  }

  // Year 1 uses the default budget as the shutdown fallback when no
  // previously passed budget exists.
  const fallbackForAttempt =
    lastPassedBudget ?? (previous.year === 0 ? defaultBudget() : null);

  const attempt = resolveBudgetAttempt(
    proposedBudget,
    vote,
    failedAttempts,
    fallbackForAttempt,
  );

    if (attempt.status === 'redraft') {
    return {
      status: 'redraft',
      failedAttempts: 1,
      vote: {
        passed: false,
        yes: attempt.vote.yes,
        no: attempt.vote.no,
      },
    };
  }

  if (attempt.status === 'passed') {
    const resolution = resolveYear(previous, attempt.budget, inputs);

    return {
      status: 'passed',
      resolution,
      passedBudget: attempt.budget,
    };
  }

  const resolution = resolveYear(previous, attempt.fallbackBudget, {
    ...inputs,
    shutdown: true,
  });

  return {
    status: 'shutdown',
    failedAttempts: 2,
    resolution,
    passedBudget: attempt.fallbackBudget,
    usedYearOneFallback: lastPassedBudget === null,
  };
}
