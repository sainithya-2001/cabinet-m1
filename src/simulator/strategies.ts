
import { defaultBudget } from '../engine/index.js';
import type { Budget, CountryState, Sector } from '../engine/index.js';
const RECKLESS_FUNDING_MULTIPLIER = 1.3;

export function recklessTargetSpending(
  needs: Record<
    'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry',
    number
  >,
) {
  return {
    health: needs.health * RECKLESS_FUNDING_MULTIPLIER,
    education: needs.education * RECKLESS_FUNDING_MULTIPLIER,
    security: needs.security * RECKLESS_FUNDING_MULTIPLIER,
    infrastructure: needs.infrastructure * RECKLESS_FUNDING_MULTIPLIER,
    environment: needs.environment * RECKLESS_FUNDING_MULTIPLIER,
    industry: needs.industry * RECKLESS_FUNDING_MULTIPLIER,
  };
}

export function canAffordRecklessTargets(
  availableFunds: number,
  needs: Record<
    'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry',
    number
  >,
): boolean {
  const targets = recklessTargetSpending(needs);
  const totalTargetSpending = Object.values(targets).reduce(
    (total, amount) => total + amount,
    0,
  );

  return availableFunds >= totalTargetSpending;
}


export function planRecklessBudget(
  availableFunds: number,
  needs: Record<
    'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry',
    number
  >,
): { budget: Budget; affordable: boolean } {
  const targets = recklessTargetSpending(needs);
  const totalTargets = Object.values(targets).reduce(
    (total, amount) => total + amount,
    0,
  );

  const budget = defaultBudget();
  const sectors = [
    'health',
    'education',
    'security',
    'infrastructure',
    'environment',
    'industry',
  ] as const;

  const rawShares = sectors.map((sector) => ({
    sector,
    exact: totalTargets > 0 ? (targets[sector] / totalTargets) * 100 : 0,
  }));

  for (const item of rawShares) {
    budget.shares[item.sector] = Math.floor(item.exact);
  }

  let remaining = 100 - sectors.reduce(
    (total, sector) => total + budget.shares[sector],
    0,
  );

  const byRemainder = [...rawShares].sort(
    (a, b) =>
      (b.exact - Math.floor(b.exact)) -
      (a.exact - Math.floor(a.exact)),
  );

  for (const item of byRemainder) {
    if (remaining <= 0) break;
    budget.shares[item.sector] += 1;
    remaining -= 1;
  }

  budget.shares.debtRepayment = 0;
  budget.borrowing = 30;

  return {
    budget,
    affordable: canAffordRecklessTargets(availableFunds, needs),
  };
}


export type StrategyName =
  | 'balanced'
  | 'greedy-agenda'
  | 'reckless'
  | 'mole';

export const STRATEGY_VERSIONS: Record<StrategyName, string> = {
  balanced: 'balanced-v0.1.1',
  'greedy-agenda': 'greedy-agenda-v0.1.0',
  reckless: 'reckless-v0.1.2',
  mole: 'mole-v0.2.0',
};

type Target = 'economy' | 'happiness' | 'stability' | 'environment';

function weakestIndicator(state: CountryState): Target {
  const values: Record<Target, number> = {
    economy: state.economy,
    happiness: state.happiness,
    stability: state.stability,
    environment: state.environment,
  };

  // Prioritize indicators closest to their collapse thresholds,
  // accounting for their different starting values and thresholds.
  const thresholds: Record<Target, number> = {
    economy: 15,
    happiness: 15,
    stability: 15,
    environment: 10,
  };

  const risk = (indicator: Target) =>
    (state[indicator] - thresholds[indicator]) /
    (100 - thresholds[indicator]);

  return (Object.keys(values) as Target[]).reduce((weakest, current) =>
    risk(current) < risk(weakest) ? current : weakest,
  );
}

/**
 * Initial heuristic agents. These are not final tuned AI policies.
 */


export function planMoleBudget(
  needs: Record<'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry', number>,
  crisisNeedChanges: Partial<Record<'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry', number>> = {},
): Budget {
  const sectors = ['health', 'education', 'security', 'infrastructure', 'environment', 'industry'] as const;
  const targetSector =
  sectors.reduce<string | undefined>((best, sector) => {
    const increase = crisisNeedChanges[sector] ?? 0;
    if (increase <= 0) return best;

    if (
      best === undefined ||
      increase > (crisisNeedChanges[best as typeof sectors[number]] ?? 0)
    ) {
      return sector;
    }

    return best;
  }, undefined) ?? 'industry';
  const targets = Object.fromEntries(sectors.map(sector => [
    sector, needs[sector] * (sector === targetSector ? 0.6 : 1),
  ])) as Record<(typeof sectors)[number], number>;
  const total = Object.values(targets).reduce((sum, value) => sum + value, 0);
  const budget = defaultBudget();
  const allocations = sectors.map(sector => {
    const exact = total > 0 ? targets[sector] / total * 100 : 0;
    budget.shares[sector] = Math.floor(exact);
    return { sector, remainder: exact - Math.floor(exact) };
  });
  let remaining = 100 - sectors.reduce((sum, sector) => sum + budget.shares[sector], 0);
  allocations.sort((a, b) =>
    b.remainder - a.remainder || sectors.indexOf(a.sector) - sectors.indexOf(b.sector),
  );
  for (const allocation of allocations) {
    if (remaining <= 0) break;
    budget.shares[allocation.sector]++;
    remaining--;
  }
  budget.shares.debtRepayment = 0;
  budget.borrowing = 30;
  return budget;
}
export function chooseBudget(
  strategy: StrategyName,
  state: CountryState,
  target: Target = 'economy',
  planningContext?: {
    availableFunds: number;
    needs: Record<
      'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry',
      number
    >;
    crisisNeedChanges?: Partial<Record<Exclude<Sector, 'debtRepayment'>, number>>;
  },
): Budget {

  const budget = defaultBudget();

  if (strategy === 'balanced') {
    const priority = weakestIndicator(state);
    const sectorByTarget = {
      economy: 'industry',
      happiness: 'health',
      stability: 'security',
      environment: 'environment',
    } as const;

    const sector = sectorByTarget[priority];
    budget.shares[sector] += 10;
    budget.shares.debtRepayment -= 10;
    return budget;
  }

  if (strategy === 'greedy-agenda') {
    const sectorByTarget = {
      economy: 'industry',
      happiness: 'health',
      stability: 'security',
      environment: 'environment',
    } as const;

    const sector = sectorByTarget[target];
    budget.shares[sector] += 10;
    budget.shares.debtRepayment -= 10;
    return budget;
  }

  
if (strategy === 'reckless') {
  if (planningContext) {
    return planRecklessBudget(
      planningContext.availableFunds,
      planningContext.needs,
    ).budget;
  }

  budget.borrowing = 30;
  budget.shares.industry += budget.shares.debtRepayment;
  budget.shares.debtRepayment = 0;
  return budget;
}


   if (strategy === 'mole') {
    if (planningContext) {
      return planMoleBudget(
        planningContext.needs,
        planningContext.crisisNeedChanges,
      );
    }

    budget.borrowing = 30;
    budget.shares.industry += budget.shares.debtRepayment;
    budget.shares.debtRepayment = 0;
    return budget;
  }

  return budget;
}
