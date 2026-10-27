
import {
  createInitialState,
  makeCrisis,
  mulberry32,
  resolveYear,
  sectorNeeds,
  PARAMETERS,
  PARAMS_VERSION,
} from '../engine/index.ts';

import type { InterestRate, TradeModifier } from '../engine/index.ts';
import { chooseBudget, STRATEGY_VERSIONS } from './strategies.ts';
import type { StrategyName } from './strategies.ts';

export interface PublicRevenueRange {
  low: number;
  high: number;
  midpoint: number;
}

export function createPublicRevenueRange(
  actualRevenue: number,
  offset: number,
): PublicRevenueRange {
  const safeOffset = Math.max(0, Math.min(20, Math.floor(offset)));
  const low = actualRevenue - safeOffset;
  const high = low + 20;

  return {
    low,
    high,
    midpoint: low + 10,
  };
}
const DEFAULT_SEEDS = 1000;


const STRATEGIES: StrategyName[] = [
  'balanced',
  'greedy-agenda',
  'reckless',
  'mole',
];

const rates: InterestRate[] = [0.03, 0.05, 0.08];
const trade: TradeModifier[] = [-8, -4, 0, 4, 8];

const cards = [
  'outbreak',
  'floods',
  'border-tension',
  'recession',
  'heatwave',
  'teacher-strike',
  'cyberattack',
  'housing-shortage',
  'energy-price-spike',
  'protests',
  'export-boom',
  'tech-breakthrough',
];

const targets = ['economy', 'happiness', 'stability', 'environment'] as const;

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

interface YearConditions {
  crisisId: string;
  severity: 1 | 2 | 3;
  revenueTradeModifier: TradeModifier;
  interestRate: InterestRate;
  revenueRangeOffset: number;
}
export function createConditions(seed: number): YearConditions[] {
  const rng = mulberry32(seed);
  const rangeRng = mulberry32(seed ^ 0x5f3759df);

  // Year 1 always uses the fixed tutorial outbreak.
  // The remaining cards are shuffled deterministically.
  const remainingCards = cards.filter((card) => card !== 'outbreak');

  for (let i = remainingCards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [remainingCards[i], remainingCards[j]] = [
      remainingCards[j]!,
      remainingCards[i]!,
    ];
  }

  const conditions: YearConditions[] = [];

  for (let year = 1; year <= 8; year++) {
            conditions.push({
      crisisId: year === 1 ? 'outbreak' : remainingCards[year - 2]!,
      severity: (
        year === 1 ? 1 : pick(rng, [1, 1, 2, 2, 3])
      ) as 1 | 2 | 3,
      revenueTradeModifier: pick(rng, trade),
      interestRate: pick(rng, rates),
      revenueRangeOffset: Math.floor(rangeRng() * 21),
    });
  }

  return conditions;
}

export interface SimulationOptions {
  seeds?: number;
}

export interface StrategyResult {
  strategy: StrategyName;
  strategyVersion: string;
  seeds: number;
  survivalRate: number;
  averageYearsResolved: number;
  collapsedGames: number;
  collapseReasons: Record<string, number>;
}

export function runSimulation(options: SimulationOptions = {}) {
  const seeds = Math.max(1, Math.floor(options.seeds ?? DEFAULT_SEEDS));

  const conditionsBySeed = new Map<number, YearConditions[]>();

  for (let seed = 1; seed <= seeds; seed++) {
    conditionsBySeed.set(seed, createConditions(seed));
  }

  function runStrategy(strategy: StrategyName): StrategyResult {
    let survived = 0;
    let yearsTotal = 0;
    const collapses: Record<string, number> = {};

    for (let seed = 1; seed <= seeds; seed++) {
      const conditions = conditionsBySeed.get(seed)!;
      const strategyRng = mulberry32(seed + 1_000_000);
      let state = createInitialState();

      for (let year = 1; year <= 8 && !state.collapsed; year++) {
        const condition = conditions[year - 1]!;
        const crisis = makeCrisis(condition.crisisId, condition.severity);

        const planningInputs = {
          revenueTradeModifier: condition.revenueTradeModifier,
          interestRate: condition.interestRate,
          crisis,
        };

        const needs = sectorNeeds(planningInputs);

        // Balanced plans against severity-2 needs and estimates funds
        // before borrowing. The engine still resolves the actual crisis.
        const balancedNeeds = sectorNeeds({
          ...planningInputs,
          crisis: makeCrisis(condition.crisisId, 2),
        });

 const actualRevenueForRange = Math.round(
  PARAMETERS.revenue.base +
    PARAMETERS.revenue.economyFactor * (state.economy - 50) +
    condition.revenueTradeModifier +
    (crisis.revenueChange ?? 0),
);

const publicRevenueRange = createPublicRevenueRange(
  actualRevenueForRange,
  condition.revenueRangeOffset,
);

const estimatedRevenue = publicRevenueRange.midpoint;
const estimatedInterest = Math.round(state.debt * 0.05);

const fundsBeforeBorrowing = Math.max(
  0,
  estimatedRevenue - estimatedInterest,
);

        // Preserve the existing Reckless and Mole funding estimate.
        const availableFunds = Math.max(
          0,
          Math.round(
            PARAMETERS.revenue.base +
              PARAMETERS.revenue.economyFactor * (state.economy - 50) +
              condition.revenueTradeModifier +
              (crisis.revenueChange ?? 0),
          ) +
            30 -
            Math.round(state.debt * condition.interestRate),
        );

        const budget =
          strategy === 'balanced'
            ? chooseBudget(strategy, state, pick(strategyRng, targets), {
                availableFunds,
                fundsBeforeBorrowing,
                needs: balancedNeeds,
              })
            : strategy === 'reckless' || strategy === 'mole'
              ? chooseBudget(strategy, state, pick(strategyRng, targets), {
                  availableFunds,
                  needs,
                  ...(strategy === 'mole'
                    ? { crisisNeedChanges: crisis.needChanges }
                    : {}),
                })
              : chooseBudget(strategy, state, pick(strategyRng, targets));

        const result = resolveYear(state, budget, planningInputs);

        state = result.state;
        yearsTotal++;

        if (state.collapsed) {
          for (const reason of state.collapseReasons) {
            collapses[reason] = (collapses[reason] ?? 0) + 1;
          }
        }
      }

      if (!state.collapsed) survived++;
    }

    return {
      strategy,
      strategyVersion: STRATEGY_VERSIONS[strategy],
      seeds,
      survivalRate: survived / seeds,
      averageYearsResolved: yearsTotal / seeds,
      collapsedGames: seeds - survived,
      collapseReasons: collapses,
    };
  }

  return {
    comparisonVersion: 'strategy-comparison-v0.3.0',
    paramsVersion: PARAMS_VERSION,
    note: 'Shared environmental conditions per seed. Mole targets the largest crisis-driven sector need increase.',
    results: STRATEGIES.map(runStrategy),
  };
}
