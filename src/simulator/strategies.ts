
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
  balanced: 'balanced-v0.2.0',
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
type FundableSector = Exclude<Sector, 'debtRepayment'>;

type BalancedNeeds = Record<FundableSector, number>;

export function planBalancedBudget(
  fundsBeforeBorrowing: number,
  needs: BalancedNeeds,
): Budget {
  const budget = defaultBudget();
  const sectors: FundableSector[] = [
    'health',
    'education',
    'security',
    'infrastructure',
    'environment',
    'industry',
  ];

  const totalNeeds = sectors.reduce(
    (sum, sector) => sum + Math.max(0, needs[sector]),
    0,
  );

  const borrowing = Math.min(
    20,
    Math.ceil(Math.max(0, totalNeeds - fundsBeforeBorrowing) / 5) * 5,
  );

  budget.borrowing = borrowing;

  const funds = Math.max(0, fundsBeforeBorrowing + borrowing);
  const targets: Record<Sector, number> = {
    health: Math.max(0, needs.health),
    education: Math.max(0, needs.education),
    security: Math.max(0, needs.security),
    infrastructure: Math.max(0, needs.infrastructure),
    environment: Math.max(0, needs.environment),
    industry: Math.max(0, needs.industry),
    debtRepayment: 0,
  };

  if (funds > totalNeeds) {
    const environmentBonus = Math.min(
      funds - totalNeeds,
      Math.max(0, needs.environment) * 0.3,
    );

    targets.environment += environmentBonus;
    targets.debtRepayment = funds - totalNeeds - environmentBonus;
  }

  const totalTargets = Object.values(targets).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  if (totalTargets <= 0) {
    budget.shares = {
      health: 0,
      education: 0,
      security: 0,
      infrastructure: 0,
      environment: 0,
      industry: 0,
      debtRepayment: 100,
    };
    return budget;
  }

   const allocations = sectors.map((sector) => ({
    sector,
    exact: (targets[sector] / totalTargets) * 100,
  }));

  const exactDebtShare = (targets.debtRepayment / totalTargets) * 100;

  for (const allocation of allocations) {
    budget.shares[allocation.sector] = Math.floor(allocation.exact);
  }
  budget.shares.debtRepayment = Math.floor(exactDebtShare);

  let remaining = 100 - Object.values(budget.shares).reduce(
    (sum, share) => sum + share,
    0,
  );

  const remainders = [
    ...allocations,
    { sector: 'debtRepayment' as const, exact: exactDebtShare },
  ].sort(
    (a, b) =>
      (b.exact - Math.floor(b.exact)) -
      (a.exact - Math.floor(a.exact)),
  );

  for (const allocation of remainders) {
    if (remaining <= 0) break;
    budget.shares[allocation.sector] += 1;
    remaining--;
  }

  return budget;
}
export function chooseBudget(
  strategy: StrategyName,
  state: CountryState,
  target: Target = 'economy',
  planningContext?: {
  availableFunds: number;
  fundsBeforeBorrowing?: number;
  needs: BalancedNeeds;
  crisisNeedChanges?: Partial<Record<Exclude<Sector, 'debtRepayment'>, number>>;
},
): Budget {

  const budget = defaultBudget();


     if (strategy === 'balanced') {
    if (planningContext) {
      return planBalancedBudget(
        planningContext.fundsBeforeBorrowing ?? planningContext.availableFunds,
        planningContext.needs,
      );
    }

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
