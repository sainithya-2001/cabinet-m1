

import type { GameFlow } from './game-flow.js';
import type { YearInputs } from './types.js';
import type { Budget } from './types.js';
import type { MinistryPower } from './ministry-powers.js';
import { PARAMETERS } from './parameters.js';
import { validateBudget } from './economy.js';
import { validateMinistryPower } from './ministry-powers.js';

export interface PowerEffectResult {
  flow: GameFlow;
  inputs: YearInputs;
  delayedEffects: {
    dueYear: number;
    indicator: 'stability';
    amount: number;
    cause: string;
  }[];
}

function markPowerUsed(flow: GameFlow, playerId: string): GameFlow {
  return {
    ...flow,
    setup: {
      ...flow.setup,
      players: flow.setup.players.map((player) =>
        player.id === playerId
          ? { ...player, powerUsed: true }
          : player,
      ),
    },
  };
}

/**
 * Applies Finance's Emergency Loan or Trade's Trade Deal.
 * Returns new values without mutating the supplied objects.
 *
 * For Emergency Loan, loanAmount is the additional borrowing
 * granted by the power: 5, 10, 15, or 20 B.
 */
export function applyEconomicPower(
  flow: GameFlow,
  playerId: string,
  power: Extract<MinistryPower, 'emergency-loan' | 'trade-deal'>,
  inputs: YearInputs,
  budget: Budget,
  loanAmount?: number,
): PowerEffectResult {
  validateMinistryPower(flow, playerId, power);

  if (power === 'emergency-loan') {
    if (
      loanAmount === undefined ||
      !Number.isInteger(loanAmount) ||
      loanAmount < 5 ||
      loanAmount > 20 ||
      loanAmount % PARAMETERS.borrowing.step !== 0
    ) {
      throw new Error(
        'Emergency Loan must add 5, 10, 15, or 20 B.',
      );
    }

    const budgetErrors = validateBudget(budget);
    if (budgetErrors.length > 0) {
      throw new Error(`Invalid budget: ${budgetErrors.join(' ')}`);
    }

    const totalBorrowing =
      budget.borrowing +
      (inputs.emergencyBorrowing ?? 0) +
      loanAmount;

    if (totalBorrowing > 50) {
      throw new Error(
        'Total borrowing, including Emergency Loan, cannot exceed 50 B.',
      );
    }

    return {
      flow: markPowerUsed(flow, playerId),
      inputs: {
        ...inputs,
        emergencyBorrowing:
          (inputs.emergencyBorrowing ?? 0) + loanAmount,
      },
      delayedEffects: [],
    };
  }

  return {
    flow: markPowerUsed(flow, playerId),
    inputs: {
      ...inputs,
      extraRevenue: (inputs.extraRevenue ?? 0) + 15,
    },
    delayedEffects: [
      {
        // The first active year is Year 1; the penalty lands in Year 2.
        dueYear: flow.setup.year + 2,
        indicator: 'stability',
        amount: -6,
        cause: `Trade deal from Year ${flow.setup.year + 1}`,
      },
    ],
  };
}
