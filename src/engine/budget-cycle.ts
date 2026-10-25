
import type { Budget } from './types.js';
import type { CountryState, YearInputs } from './types.js';
import type { BudgetVote } from './budget-vote.js';
import { resolveBudgetAndYear } from './budget-resolution.js';
import type { BudgetResolutionResult } from './budget-resolution.js';
import type { GameFlow } from './game-flow.js';
import {
  advancePhase,
  finishGameOnCollapse,
  getCurrentPrimeMinister,
} from './game-flow.js';

export interface BudgetCycle {  flow: GameFlow;
  country: CountryState;
  failedVotes: 0 | 1;
  lastPassedBudget: Budget | null;
  lastResult: BudgetResolutionResult | null;
}

export function createBudgetCycle(
  flow: GameFlow,
  country: CountryState,
  lastPassedBudget: Budget | null = null,
): BudgetCycle {
  return {
    flow,
    country,
    failedVotes: 0,
    lastPassedBudget,
    lastResult: null,
  };
}

export function submitBudgetVote(
  cycle: BudgetCycle,
  proposedBudget: Budget,
  vote: BudgetVote,
  inputs: YearInputs,
): BudgetCycle {
  if (cycle.flow.phase !== 'vote') {
    throw new Error('A budget can only be voted on during the Vote phase.');
  }

  if (cycle.country.collapsed) {
    throw new Error('Cannot vote after the country has collapsed.');
  }

  const result = resolveBudgetAndYear(
    cycle.country,
    proposedBudget,
    vote,
    cycle.failedVotes,
    cycle.lastPassedBudget,
    inputs,
  );

  if (result.status === 'redraft') {
    const currentPm = getCurrentPrimeMinister(cycle.flow);
    if (!currentPm) {
      throw new Error('There is no eligible Prime Minister for redrafting.');
    }

    const count = cycle.flow.setup.players.length;
    let nextPm = null;

    for (let offset = 1; offset <= count; offset++) {
      const seat = (currentPm.seat + offset + count) % count;
      const candidate = cycle.flow.setup.players.find(
        (player) =>
          player.seat === seat &&
          player.connected &&
          !player.expelled,
      );

      if (candidate) {
        nextPm = candidate;
        break;
      }
    }

    if (!nextPm) {
      throw new Error('No eligible Prime Minister is available for redrafting.');
    }

    return {
      ...cycle,
      flow: {
        ...cycle.flow,
        phase: 'draft',
        primeMinisterId: nextPm.id,
        previousPrimeMinisterSeat: nextPm.seat,
      },
      failedVotes: 1,
      lastResult: result,
    };
  }

  const resolvedCountry = result.resolution.state;

  if (result.status === 'passed') {
    const flow = resolvedCountry.collapsed
      ? finishGameOnCollapse(cycle.flow, true)
      : { ...cycle.flow, phase: 'resolve' as const };

    return {
      ...cycle,
      country: resolvedCountry,
      failedVotes: 0,
      lastPassedBudget: result.passedBudget,
      lastResult: result,
      flow,
    };
  }

  const flow = resolvedCountry.collapsed
    ? finishGameOnCollapse(cycle.flow, true)
    : { ...cycle.flow, phase: 'resolve' as const };

  return {
    ...cycle,
    country: resolvedCountry,
    failedVotes: 0,
    lastPassedBudget: result.passedBudget,
    lastResult: result,
    flow,
  };
}
export function advanceBudgetCycleAfterResolve(
  cycle: BudgetCycle,
): BudgetCycle {
  if (cycle.flow.phase !== 'resolve') {
    throw new Error('A new year can only begin after Resolve.');
  }

  if (cycle.country.collapsed) {
    throw new Error('Cannot advance after the country has collapsed.');
  }

  const flow = advancePhase(cycle.flow);

  return {
    ...cycle,
    flow,
    failedVotes: 0,
    lastResult: null,
  };
}

export function submitBudgetForVote(
  cycle: BudgetCycle,
): BudgetCycle {
  if (cycle.flow.phase !== 'draft') {
    throw new Error('A budget can only be submitted during the Draft phase.');
  }

  if (cycle.country.collapsed) {
    throw new Error('Cannot submit a budget after the country has collapsed.');
  }

  if (!getCurrentPrimeMinister(cycle.flow)) {
    throw new Error('There is no eligible Prime Minister to submit a budget.');
  }

  return {
    ...cycle,
    flow: {
      ...cycle.flow,
      phase: 'vote',
    },
  };
}