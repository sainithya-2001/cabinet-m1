export type Indicator = 'economy' | 'happiness' | 'stability' | 'environment' | 'debt';
export type Sector = 'health' | 'education' | 'security' | 'infrastructure' | 'environment' | 'industry' | 'debtRepayment';
export type CrisisCategory = 'Health' | 'Disaster' | 'Security' | 'Economy' | 'Climate' | 'Social';
export type InterestRate = 0.03 | 0.05 | 0.08;
export type TradeModifier = -8 | -4 | 0 | 4 | 8;

export interface CountryState {
  year: number;
  economy: number;
  happiness: number;
  stability: number;
  environment: number;
  debt: number;
  delayedEffects: DelayedEffect[];
  collapsed: boolean;
  collapseReasons: Indicator[];
}

export interface DelayedEffect {
  dueYear: number;
  indicator: Exclude<Indicator, 'debt'>;
  amount: number;
  cause: string;
}

export interface CrisisCard {
  id: string;
  name: string;
  category: CrisisCategory;
  severity: 1 | 2 | 3;
  unavoidableHits: Partial<Record<Exclude<Indicator, 'debt'>, number>>;
  needChanges: Partial<Record<Exclude<Sector, 'debtRepayment'>, number>>;
  revenueChange?: number;
}

export interface Budget {
  shares: Record<Sector, number>;
  borrowing: number;
}

export interface YearInputs {
  revenueTradeModifier: TradeModifier;
  interestRate: InterestRate;
  crisis: CrisisCard;
  /** Stable per-game/per-year seed for sector need variation. */
  needVariationSeed?: number;
  /** Extra revenue modifiers from powers, e.g. Trade deal. */
  extraRevenue?: number;
  /** Additional borrowing granted by Finance's power, if used. */
  emergencyBorrowing?: number;
  /** A prior budget can be passed as the shutdown fallback. */
  shutdown?: boolean;
  /** Projection-only exact revenue override; omitted during real resolution. */
  revenueOverride?: number;
}

export interface CauseLine {
  cause: string;
  raw: number;
  rounded: number;
}

export interface IndicatorResolution {
  before: number;
  unclamped: number;
  after: number;
  lines: CauseLine[];
}

export interface YearResolution {
  state: CountryState;
  revenue: number;
  interest: number;
  availableFunds: number;
  effectiveBudget: Budget;
  budgetScale: number;
  spending: Record<Sector, number>;
  changes: Record<Indicator, IndicatorResolution>;
}