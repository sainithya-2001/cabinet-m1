
import type { Budget } from './types.js';

export interface BudgetVote {
  yes: number;
  no: number;
}

export type BudgetVoteResult =
  | { passed: true; yes: number; no: number }
  | { passed: false; yes: number; no: number };

export type BudgetAttemptResult =
  | {
      status: 'passed';
      budget: Budget;
      vote: BudgetVoteResult;
    }
  | {
      status: 'redraft';
      failedAttempts: 1;
      vote: BudgetVoteResult;
    }
  | {
      status: 'shutdown';
      failedAttempts: 2;
      fallbackBudget: Budget;
      vote: BudgetVoteResult;
    };

export function resolveBudgetVote(vote: BudgetVote): BudgetVoteResult {
  if (
    !Number.isInteger(vote.yes) ||
    !Number.isInteger(vote.no) ||
    vote.yes < 0 ||
    vote.no < 0
  ) {
    throw new Error('Vote counts must be non-negative integers.');
  }

  return {
    passed: vote.yes > vote.no,
    yes: vote.yes,
    no: vote.no,
  };
}

/**
 * Evaluates a budget vote.
 * failedAttempts is the number of failed budget votes before this attempt.
 * The caller is responsible for supplying the last passed budget as fallback.
 */
export function resolveBudgetAttempt(
  budget: Budget,
  vote: BudgetVote,
  failedAttempts: 0 | 1,
  lastPassedBudget: Budget | null,
): BudgetAttemptResult {
  const result = resolveBudgetVote(vote);

  if (result.passed) {
    return { status: 'passed', budget, vote: result };
  }

  if (failedAttempts === 0) {
    return {
      status: 'redraft',
      failedAttempts: 1,
      vote: result,
    };
  }

  if (!lastPassedBudget) {
    throw new Error(
      'Shutdown requires a previously passed budget as fallback.',
    );
  }

  return {
    status: 'shutdown',
    failedAttempts: 2,
    fallbackBudget: lastPassedBudget,
    vote: result,
  };
}
