import { describe, expect, it } from 'vitest';
import { createInitialState, defaultBudget } from '../src/engine/economy.ts';
import { makeCrisis } from '../src/engine/crises.ts';
import { createGameSetup } from '../src/engine/game.ts';
import { createGameFlow } from '../src/engine/game-flow.ts';
import {
  advanceBudgetCycleAfterResolve,
  createBudgetCycle,
  submitBudgetForVote,
  submitBudgetVote,
} from '../src/engine/budget-cycle.ts';
import type { YearInputs } from '../src/engine/types.ts';

const inputs: YearInputs = {
  revenueTradeModifier: 0,
  interestRate: 0.03,
  crisis: makeCrisis('outbreak', 1),
};

function makeCycle() {
  const setup = createGameSetup(
    12345,
    ['Alex', 'Blair', 'Casey', 'Devon'],
    'crisis',
    'full',
  );
  const flow = createGameFlow(setup);
  return createBudgetCycle(
    { ...flow, phase: 'vote' },
    createInitialState(),
  );
}

describe('budget cycle', () => {
  it('rejects voting outside the Vote phase', () => {
    const cycle = makeCycle();

    expect(() =>
      submitBudgetVote(
        { ...cycle, flow: { ...cycle.flow, phase: 'news' } },
        defaultBudget(),
        { yes: 3, no: 1 },
        inputs,
      ),
    ).toThrow(/Vote phase/);
  });

  it('rotates the PM and returns to Draft after a failed first vote', () => {
    const cycle = makeCycle();
    const originalPm = cycle.flow.primeMinisterId;

    const result = submitBudgetVote(
      cycle,
      defaultBudget(),
      { yes: 2, no: 2 },
      inputs,
    );

    expect(result.flow.phase).toBe('draft');
    expect(result.flow.primeMinisterId).not.toBe(originalPm);
    expect(result.failedVotes).toBe(1);
    expect(result.country.year).toBe(0);
  });

  it('resolves a passed budget and moves to Resolve', () => {
    const result = submitBudgetVote(
      makeCycle(),
      defaultBudget(),
      { yes: 3, no: 1 },
      inputs,
    );

    expect(result.flow.phase).toBe('resolve');
    expect(result.country.year).toBe(1);
    expect(result.failedVotes).toBe(0);
  });

  it('shuts down after a second failed vote using the default Year 1 fallback', () => {
    const cycle = {
      ...makeCycle(),
      failedVotes: 1 as const,
    };

    const result = submitBudgetVote(
      cycle,
      defaultBudget(),
      { yes: 2, no: 2 },
      inputs,
    );

    expect(result.lastResult?.status).toBe('shutdown');
    expect(result.flow.phase).toBe('resolve');
    expect(result.country.year).toBe(1);
    expect(result.lastPassedBudget).toEqual(defaultBudget());
  });

  it('rejects a vote after collapse', () => {
    const cycle = makeCycle();
    const collapsedCountry = {
      ...cycle.country,
      collapsed: true,
    };

    expect(() =>
      submitBudgetVote(
        { ...cycle, country: collapsedCountry },
        defaultBudget(),
        { yes: 3, no: 1 },
        inputs,
      ),
    ).toThrow(/collapsed/);
  });

  it('starts the next year after Resolve and resets per-year state', () => {
    const firstVote = submitBudgetVote(
      makeCycle(),
      defaultBudget(),
      { yes: 2, no: 2 },
      inputs,
    );

    const redraftedCycle = submitBudgetForVote({
      ...firstVote,
      flow: {
        ...firstVote.flow,
        phase: 'draft',
      },
    });

    const passed = submitBudgetVote(
      redraftedCycle,
      defaultBudget(),
      { yes: 3, no: 1 },
      inputs,
    );

    const next = advanceBudgetCycleAfterResolve(passed);

    expect(next.flow.phase).toBe('news');
    expect(next.flow.setup.year).toBe(1);
    expect(next.country.year).toBe(1);
    expect(next.failedVotes).toBe(0);
    expect(next.lastResult).toBeNull();
    expect(next.lastPassedBudget).toEqual(defaultBudget());
  });

  it('rejects a year transition outside Resolve', () => {
    const cycle = makeCycle();

    expect(() => advanceBudgetCycleAfterResolve(cycle)).toThrow(
      /after Resolve/,
    );
  });

  it('moves from Draft to Vote when an eligible PM submits a budget', () => {
    const cycle = {
      ...makeCycle(),
      flow: {
        ...makeCycle().flow,
        phase: 'draft' as const,
      },
    };

    const result = submitBudgetForVote(cycle);

    expect(result.flow.phase).toBe('vote');
  });

  it('rejects budget submission outside Draft', () => {
    const cycle = makeCycle();

    expect(() => submitBudgetForVote(cycle)).toThrow(/Draft phase/);
  });
});