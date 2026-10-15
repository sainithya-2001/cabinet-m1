import { collapseReasons, PARAMETERS, SECTORS } from './parameters.js';
import type { Budget, CauseLine, CountryState, Indicator, IndicatorResolution, Sector, YearInputs, YearResolution } from './types.js';

const round = (n: number) => Math.round(n);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function createInitialState(): CountryState {
  return { year: 0, ...PARAMETERS.initialState, delayedEffects: [], collapsed: false, collapseReasons: [] };
}

export function defaultBudget(): Budget {
  return { shares: { health: 20, education: 14, security: 14, infrastructure: 16, environment: 10, industry: 14, debtRepayment: 12 }, borrowing: 0 };
}

export function validateBudget(budget: Budget, maxBorrowing: number = PARAMETERS.borrowing.max): string[] {
  const errors: string[] = [];
  const values = SECTORS.map((s) => budget.shares[s]);
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) errors.push('Every budget share must be an integer from 0 to 100.');
  if (values.reduce((a, b) => a + b, 0) !== 100) errors.push('Budget shares must sum to 100.');
  if (!Number.isInteger(budget.borrowing) || budget.borrowing < PARAMETERS.borrowing.min || budget.borrowing > maxBorrowing || budget.borrowing % PARAMETERS.borrowing.step !== 0) errors.push(`Borrowing must be in ${PARAMETERS.borrowing.step} B steps from 0 to ${maxBorrowing} B.`);
  return errors;
}

/** Funding below need hurts linearly; above need helps at half-rate, capped at 2x need. */
export function fundingEffect(spend: number, need: number): number {
  if (need <= 0) return 0;
  const f = spend / need;
  return f < 1 ? f - 1 : 0.5 * Math.min(f - 1, 1);
}

function allocateRoundedLines(rawLines: { cause: string; raw: number }[], target: number): CauseLine[] {
  // Largest-remainder apportionment preserves the rounded total even when individual causes round differently.
  const floors = rawLines.map((line) => Math.floor(Math.abs(line.raw)) * Math.sign(line.raw));
  const current = floors.reduce((a, b) => a + b, 0);
  const delta = target - current;
  const order = rawLines.map((line, i) => ({ i, fraction: Math.abs(line.raw) - Math.floor(Math.abs(line.raw)), sign: Math.sign(line.raw) })).sort((a, b) => b.fraction - a.fraction);
  const rounded = [...floors];
  if (delta > 0) {
    for (let i = 0; i < delta; i++) { const item = order[i % order.length]; if (item) rounded[item.i] = (rounded[item.i] ?? 0) + 1; }
  } else if (delta < 0) {
    const reverse = [...order].reverse();
    for (let i = 0; i < -delta; i++) { const item = reverse[i % reverse.length]; if (item) rounded[item.i] = (rounded[item.i] ?? 0) - 1; }
  }
  return rawLines.map((line, i) => ({ cause: line.cause, raw: line.raw, rounded: rounded[i] ?? 0 }));
}

function resolveIndicator(before: number, rawLines: { cause: string; raw: number }[], indicator: Indicator): IndicatorResolution {
  const rawTotal = rawLines.reduce((sum, line) => sum + line.raw, 0);
  const roundedTotal = round(rawTotal);
  const lines = allocateRoundedLines(rawLines, roundedTotal);
  const unclamped = before + roundedTotal;
  const [min, max] = PARAMETERS.indicatorCaps[indicator];
  const after = clamp(unclamped, min, max);
  if (after !== unclamped) lines.push({ cause: 'Limit reached', raw: after - unclamped, rounded: after - unclamped });
  if (before + lines.reduce((sum, line) => sum + line.rounded, 0) !== after) {
    throw new Error(`Explanation invariant failed for ${indicator}: ${before} + lines != ${after}`);
  }
  return { before, unclamped, after, lines };
}

export function sectorNeeds(inputs: YearInputs): Record<Exclude<Sector, 'debtRepayment'>, number> {
  const needs = { ...PARAMETERS.sectorNeeds };
  for (const [sector, amount] of Object.entries(inputs.crisis.needChanges)) {
    const key = sector as keyof typeof needs;
    needs[key] += amount ?? 0;
  }
  return needs;
}
export function calculateYearFinances(
  previous: CountryState,
  budget: Budget,
  inputs: YearInputs,
) {
  const borrowing = budget.borrowing + (inputs.emergencyBorrowing ?? 0);

  const revenue =
    inputs.revenueOverride ??
    round(
      PARAMETERS.revenue.base +
        PARAMETERS.revenue.economyFactor * (previous.economy - 50) +
        inputs.revenueTradeModifier +
        (inputs.crisis.revenueChange ?? 0) +
        (inputs.extraRevenue ?? 0),
    );

  const interest = round(previous.debt * inputs.interestRate);
  const availableFunds = Math.max(0, revenue + borrowing - interest);

  return { borrowing, revenue, interest, availableFunds };
}
/** Pure yearly resolver shared by live projection and actual resolution. */
export function resolveYear(previous: CountryState, budget: Budget, inputs: YearInputs): YearResolution {
  const validation = validateBudget(budget, inputs.emergencyBorrowing ? 50 : PARAMETERS.borrowing.max);
  if (validation.length) throw new Error(`Invalid budget: ${validation.join(' ')}`);
  if (previous.collapsed) throw new Error('Cannot resolve a year after collapse.');

  const year = previous.year + 1;
  const { borrowing, revenue, interest, availableFunds } =
  calculateYearFinances(previous, budget, inputs);

if (borrowing > (inputs.emergencyBorrowing ? 50 : PARAMETERS.borrowing.max)) {
  throw new Error("Borrowing exceeds this year's cap.");
}
  const needs = sectorNeeds(inputs);
  const spending = {} as Record<Sector, number>;
    const budgetScale = inputs.shutdown ? PARAMETERS.shutdown.budgetScale : 1;
  for (const sector of SECTORS) spending[sector] = availableFunds * budget.shares[sector] / 100 * budgetScale;

  const raw: Record<Indicator, { cause: string; raw: number }[]> = { economy: [], happiness: [], stability: [], environment: [], debt: [] };
  const delayedRemaining = previous.delayedEffects.filter((effect) => effect.dueYear !== year);
  for (const effect of previous.delayedEffects.filter((effect) => effect.dueYear === year)) raw[effect.indicator].push({ cause: effect.cause, raw: effect.amount });

  const effect = (sector: Exclude<Sector, 'debtRepayment'>, indicator: Exclude<Indicator, 'debt'>, k: number) => {
    raw[indicator].push({ cause: `${sector[0]!.toUpperCase()}${sector.slice(1)} funding`, raw: k * fundingEffect(spending[sector], needs[sector]) });
  };
  const h = PARAMETERS.sectorEffects.health;
  effect('health', 'happiness', h.happiness); effect('health', 'economy', h.economy);
  const ed = PARAMETERS.sectorEffects.education;
  effect('education', 'happiness', ed.happiness);
  if (ed.delayedEconomy * fundingEffect(spending.education, needs.education) !== 0) delayedRemaining.push({ dueYear: year + ed.delayedYears, indicator: 'economy', amount: ed.delayedEconomy * fundingEffect(spending.education, needs.education), cause: `Education investment from Year ${year}` });
  const sec = PARAMETERS.sectorEffects.security; effect('security', 'stability', sec.stability);
  const infra = PARAMETERS.sectorEffects.infrastructure; effect('infrastructure', 'stability', infra.stability);
  if (infra.delayedEconomy * fundingEffect(spending.infrastructure, needs.infrastructure) !== 0) delayedRemaining.push({ dueYear: year + infra.delayedYears, indicator: 'economy', amount: infra.delayedEconomy * fundingEffect(spending.infrastructure, needs.infrastructure), cause: `Infrastructure investment from Year ${year}` });
  const env = PARAMETERS.sectorEffects.environment; effect('environment', 'environment', env.environment); effect('environment', 'happiness', env.happiness);
  const ind = PARAMETERS.sectorEffects.industry; effect('industry', 'economy', ind.economy);
  raw.environment.push({ cause: 'Industry pollution', raw: -PARAMETERS.industryPollutionPerNeed * Math.min(spending.industry / needs.industry, 2) });
  raw.environment.push({ cause: 'Environmental drift', raw: PARAMETERS.environmentDrift });
  for (const [indicator, amount] of Object.entries(inputs.crisis.unavoidableHits)) raw[indicator as Exclude<Indicator, 'debt'>].push({ cause: `${inputs.crisis.name} crisis`, raw: amount ?? 0 });
  if (inputs.shutdown) raw.stability.push({ cause: 'Government shutdown', raw: PARAMETERS.shutdown.stabilityPenalty });

  // Debt is a percentage-of-GDP index. Borrowing raises it; each B repaid lowers it by 0.5.
  raw.debt.push({ cause: 'Borrowing', raw: borrowing * PARAMETERS.borrowing.debtFactor });
  raw.debt.push({ cause: 'Debt repayment', raw: -spending.debtRepayment * PARAMETERS.repaymentDebtReductionPerB });

  const values: Record<Indicator, number> = { economy: previous.economy, happiness: previous.happiness, stability: previous.stability, environment: previous.environment, debt: previous.debt };
  const changes = {} as Record<Indicator, IndicatorResolution>;
  for (const indicator of Object.keys(values) as Indicator[]) changes[indicator] = resolveIndicator(values[indicator], raw[indicator], indicator);
  const nextValues = { economy: changes.economy.after, happiness: changes.happiness.after, stability: changes.stability.after, environment: changes.environment.after, debt: changes.debt.after };
  const reasons = collapseReasons(nextValues);
  const state: CountryState = { year, ...nextValues, delayedEffects: delayedRemaining, collapsed: reasons.length > 0, collapseReasons: reasons };
  return { state, revenue, interest, availableFunds, effectiveBudget: budget, budgetScale, spending, changes };
}

export interface ProjectionRange { min: Record<Indicator, number>; max: Record<Indicator, number>; combinations: number }
export function projectYear(previous: CountryState, budget: Budget, known: { revenueMin: number; revenueMax: number; severityKnown?: 1 | 2 | 3; interestKnown?: 0.03 | 0.05 | 0.08; baseInputs: Omit<YearInputs, 'crisis'>; crisisForSeverity: (severity: 1 | 2 | 3) => YearInputs['crisis'] }): ProjectionRange {
  const severities = known.severityKnown ? [known.severityKnown] : [1, 2, 3] as const;
  const rates = known.interestKnown ? [known.interestKnown] : [0.03, 0.05, 0.08] as const;
  const indicators: Indicator[] = ['economy', 'happiness', 'stability', 'environment', 'debt'];
  const min = { economy: Infinity, happiness: Infinity, stability: Infinity, environment: Infinity, debt: Infinity };
  const max = { economy: -Infinity, happiness: -Infinity, stability: -Infinity, environment: -Infinity, debt: -Infinity };
  let combinations = 0;
  for (let revenue = known.revenueMin; revenue <= known.revenueMax; revenue++) for (const severity of severities) for (const rate of rates) {
    const crisis = known.crisisForSeverity(severity);
    const result = resolveYear(previous, budget, { ...known.baseInputs, interestRate: rate, crisis, revenueOverride: revenue });
    combinations++;
    for (const indicator of indicators) { min[indicator] = Math.min(min[indicator], result.state[indicator]); max[indicator] = Math.max(max[indicator], result.state[indicator]); }
  }
  return { min, max, combinations };
}
