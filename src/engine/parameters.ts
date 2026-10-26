import type { Indicator, Sector } from './types.ts';

/** Versioned tuning knobs. Values marked provisional should be calibrated by the simulator. */
export const PARAMS_VERSION = '0.1.1';
export const PARAMETERS = {
  initialState: { economy: 50, happiness: 55, stability: 55, environment: 50, debt: 40 },
  collapseLines: { economy: 15, happiness: 15, stability: 15, environment: 10, debt: 100 },
  indicatorCaps: { economy: [0, 100], happiness: [0, 100], stability: [0, 100], environment: [0, 100], debt: [0, 150] } as Record<Indicator, [number, number]>,
  revenue: { base: 100, economyFactor: 0.8, min: 60, max: 140 },
  borrowing: { min: 0, max: 30, step: 5, debtFactor: 0.6 },
  repaymentDebtReductionPerB: 0.5,
  sectorNeeds: { health: 20, education: 14, security: 14, infrastructure: 16, environment: 10, industry: 14 } as Record<Exclude<Sector, 'debtRepayment'>, number>,
  sectorEffects: {
    health: { happiness: 12, economy: 3 },
    education: { happiness: 4, delayedEconomy: 10, delayedYears: 2 },
    security: { stability: 14 },
    infrastructure: { stability: 4, delayedEconomy: 10, delayedYears: 1 },
    environment: { environment: 12, happiness: 3 },
    industry: { economy: 10 }
  },
  industryPollutionPerNeed: 3,
  environmentDrift: -1,
  /** Shutdown applies 80% of the last passed budget; provisional representation is shares unchanged. */
  shutdown: { stabilityPenalty: -5, budgetScale: 0.8 },
} as const;

export const SECTORS: Sector[] = ['health', 'education', 'security', 'infrastructure', 'environment', 'industry', 'debtRepayment'];
export const INDICATORS: Indicator[] = ['economy', 'happiness', 'stability', 'environment', 'debt'];

export function collapseReasons(values: Record<Indicator, number>): Indicator[] {
  return INDICATORS.filter((indicator) => {
    const line = PARAMETERS.collapseLines[indicator];
    return indicator === 'debt' ? values.debt >= line : values[indicator] <= line;
  });
}
