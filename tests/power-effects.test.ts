
import { describe, expect, it } from 'vitest';
import { createGameSetup } from '../src/engine/game.ts';

import { createGameFlow, advancePhase } from '../src/engine/game-flow.ts';
import { createInitialState, defaultBudget, resolveYear } from '../src/engine/economy.ts';
import { applyEconomicPower } from '../src/engine/power-effects.ts';
import type { YearInputs } from '../src/engine/types.ts';

function makeFlow() {
  const setup = createGameSetup(
    123,
    ['Alex', 'Blair', 'Casey', 'Drew', 'Eli', 'Frank', 'Gray', 'Harper'],
    'standard',
    'full',
  );
  return createGameFlow(setup);
}

function inputs(): YearInputs {
  return {
    revenueTradeModifier: 0,
    interestRate: 0.03,
    crisis: {
      id: 'test',
      name: 'Test crisis',
      category: 'Economy',
      severity: 1,
      unavoidableHits: {},
      needChanges: {},
    },
  };
}

describe('economic ministry power effects', () => {
  it('applies Trade Deal revenue and schedules its delayed penalty', () => {
    const flow = makeFlow();
    flow.phase = 'draft';
    const player = flow.setup.players.find((p) => p.ministry === 'trade')!;

    const result = applyEconomicPower(
      flow,
      player.id,
      'trade-deal',
      inputs(),
      defaultBudget(),
    );

    expect(result.inputs.extraRevenue).toBe(15);
    expect(result.delayedEffects).toEqual([
      {
        dueYear: 2,
        indicator: 'stability',
        amount: -6,
        cause: 'Trade deal from Year 1',
      },
    ]);
    expect(result.flow.setup.players.find((p) => p.id === player.id)?.powerUsed)
      .toBe(true);
    expect(player.powerUsed).toBe(false);
  });


  it('rejects a second Trade Deal after the year advances', () => {
    let flow = makeFlow();
    flow.phase = 'draft';

    const player = flow.setup.players.find((p) => p.ministry === 'trade')!;

    const firstResult = applyEconomicPower(
      flow,
      player.id,
      'trade-deal',
      inputs(),
      defaultBudget(),
    );

    flow = firstResult.flow;

    for (let i = 0; i < 6; i++) {
      flow = advancePhase(flow);
    }

    expect(flow.setup.year).toBe(1);
    expect(
      flow.setup.players.find((p) => p.id === player.id)?.powerUsed,
    ).toBe(true);

    flow.phase = 'draft';

    expect(() =>
      applyEconomicPower(
        flow,
        player.id,
        'trade-deal',
        inputs(),
        defaultBudget(),
      ),
    ).toThrow();
  });
    it('rejects Trade Deal from a player in the wrong ministry', () => {
    const flow = makeFlow();
    flow.phase = 'draft';
    const player = flow.setup.players.find((p) => p.ministry === 'health')!;

    expect(() =>
      applyEconomicPower(
        flow,
        player.id,
        'trade-deal',
        inputs(),
        defaultBudget(),
      ),
    ).toThrow();
  });

  
it('rejects an Emergency Loan that would exceed 50 B total borrowing without consuming the power', () => {
  const flow = makeFlow();
  const player = flow.setup.players.find(
    (candidate) => candidate.ministry === 'finance',
  );

  if (!player) {
    throw new Error('Finance player not found in test setup.');
  }

  const budget = {
    shares: {
      health: 20,
      education: 15,
      security: 15,
      infrastructure: 15,
      environment: 10,
      industry: 15,
      debtRepayment: 10,
    },
    borrowing: 30,
  };

  expect(() =>
    applyEconomicPower(
      flow,
      player.id,
      'emergency-loan',
      inputs(),
      budget,
      20,
    ),
  ).toThrow();

  expect(player.powerUsed).toBe(false);
});

  it('applies a valid 10 B Emergency Loan and consumes the power', () => {
    const flow = makeFlow();
    flow.phase = 'draft';

    const player = flow.setup.players.find(
      (candidate) => candidate.ministry === 'finance',
    );

    if (!player) {
      throw new Error('Finance player not found in test setup.');
    }

    const result = applyEconomicPower(
      flow,
      player.id,
      'emergency-loan',
      inputs(),
      defaultBudget(),
      10,
    );

    expect(result.inputs.emergencyBorrowing).toBe(10);
    expect(result.flow.setup.players.find(
      (candidate) => candidate.id === player.id,
    )?.powerUsed).toBe(true);
    expect(player.powerUsed).toBe(false);
  });

  it('applies the Trade Deal stability penalty in Year 2', () => {
    const initialState = createInitialState();

    const yearOne = resolveYear(
      initialState,
      defaultBudget(),
      inputs(),
    );

    const stateWithTradeDeal = {
      ...yearOne.state,
      delayedEffects: [
        ...yearOne.state.delayedEffects,
        {
          dueYear: 2,
          indicator: 'stability' as const,
          amount: -6,
          cause: 'Trade deal from Year 1',
        },
      ],
    };

    const yearTwo = resolveYear(
      stateWithTradeDeal,
      defaultBudget(),
      inputs(),
    );

    expect(yearTwo.state.year).toBe(2);
    expect(yearTwo.changes.stability.lines).toContainEqual(
      expect.objectContaining({
        cause: 'Trade deal from Year 1',
        rounded: -6,
      }),
    );
    expect(yearTwo.state.delayedEffects).not.toContainEqual(
      expect.objectContaining({
        dueYear: 2,
        cause: 'Trade deal from Year 1',
      }),
    );
  });
});
