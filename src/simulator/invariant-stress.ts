
import {
  createInitialState,
  defaultBudget,
  makeCrisis,
  mulberry32,
  resolveYear,
} from '../engine/index.ts';

const CASES = 100_000;

const indicators = [
  'economy',
  'happiness',
  'stability',
  'environment',
  'debt',
] as const;

const sectors = [
  'health',
  'education',
  'security',
  'infrastructure',
  'environment',
  'industry',
  'debtRepayment',
] as const;

const crisisIds = [
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
] as const;

const tradeModifiers = [-8, -4, 0, 4, 8] as const;
const interestRates = [0.03, 0.05, 0.08] as const;
const rng = mulberry32(20261015);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function randomBudget() {
  const shares = {} as Record<(typeof sectors)[number], number>;
  let remaining = 100;

  for (let i = 0; i < sectors.length - 1; i++) {
    const share = Math.floor(rng() * (remaining + 1));
    shares[sectors[i]!] = share;
    remaining -= share;
  }

  shares[sectors[sectors.length - 1]!] = remaining;

  return {
    shares,
    borrowing: Math.floor(rng() * 7) * 5,
  };
}

let checked = 0;

for (let trial = 0; trial < CASES; trial++) {
  const budget = randomBudget();
  const crisis = makeCrisis(pick(crisisIds), pick([1, 2, 3] as const));

  const result = resolveYear(
    createInitialState(),
    budget,
    {
      revenueTradeModifier: pick(tradeModifiers),
      interestRate: pick(interestRates),
      crisis,
    },
  );

  for (const indicator of indicators) {
    const explanation = result.changes[indicator];

    const explainedValue =
      explanation.before +
      explanation.lines.reduce((sum, line) => sum + line.rounded, 0);

    if (
      explainedValue !== explanation.after ||
      result.state[indicator] !== explanation.after
    ) {
      throw new Error(
        `Invariant failed in case ${trial + 1}, indicator ${indicator}: ` +
        `${explanation.before} + explanation lines = ${explainedValue}, ` +
        `but final value is ${explanation.after}.`,
      );
    }

    checked++;
  }
}

console.log(
  `PASS: ${CASES.toLocaleString()} cases; ` +
  `${checked.toLocaleString()} indicator explanations reconciled.`,
);
