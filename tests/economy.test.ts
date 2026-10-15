import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  defaultBudget,
  makeCrisis,
  resolveYear,
  validateBudget,
  projectYear,
  mulberry32,
} from '../src/engine/index.js';
import type { YearInputs } from '../src/engine/index.js';

const baseInputs: YearInputs = {
  revenueTradeModifier: 0,
  interestRate: 0.05,
  crisis: makeCrisis('outbreak', 1),
};

describe('Cabinet economy engine M1', () => {
  it('creates the specified starting country', () => {
    expect(createInitialState()).toMatchObject({
      year: 0,
      economy: 50,
      happiness: 55,
      stability: 55,
      environment: 50,
      debt: 40,
      collapsed: false,
    });
  });

  it('reports a budget scale of 1 during normal operation', () => {
    const result = resolveYear(
      createInitialState(),
      defaultBudget(),
      baseInputs
    );

    expect(result.budgetScale).toBe(1);
  });

  it('reports a budget scale of 0.8 during shutdown', () => {
    const result = resolveYear(
      createInitialState(),
      defaultBudget(),
      { ...baseInputs, shutdown: true }
    );

    expect(result.budgetScale).toBe(0.8);
  });

  it('rejects invalid budget shares and borrowing', () => {
    const budget = defaultBudget();

    expect(validateBudget(budget)).toEqual([]);
    expect(
      validateBudget({ ...budget, borrowing: 3 })
    ).not.toEqual([]);
    expect(
      validateBudget({
        ...budget,
        shares: { ...budget.shares, health: 99 },
      })
    ).not.toEqual([]);
  });

  it('refuses to resolve a year with an invalid budget', () => {
    const budget = defaultBudget();
    budget.shares.health = 99;

    expect(() =>
      resolveYear(createInitialState(), budget, baseInputs)
    ).toThrow(/Invalid budget/);
  });

  it('accepts valid budget shares across many allocations', () => {
    const sectors = [
      'health',
      'education',
      'security',
      'infrastructure',
      'environment',
      'industry',
      'debtRepayment',
    ] as const;

    const rng = mulberry32(20261015);

    for (let trial = 0; trial < 200; trial++) {
      const shares = Object.fromEntries(
        sectors.map((sector) => [sector, 0])
      ) as Record<(typeof sectors)[number], number>;

      let remaining = 100;

      for (let i = 0; i < sectors.length - 1; i++) {
        const share = Math.floor(rng() * (remaining + 1));
        shares[sectors[i]!] = share;
        remaining -= share;
      }

      shares[sectors[sectors.length - 1]!] = remaining;

      const errors = validateBudget({
        shares,
        borrowing: 0,
      });

      expect(errors).toEqual([]);
    }
  });

  it('keeps indicator values finite and within their configured caps', () => {
    const rng = mulberry32(8675309);

    const sectors = [
      'health',
      'education',
      'security',
      'infrastructure',
      'environment',
      'industry',
      'debtRepayment',
    ] as const;

    const caps = {
      economy: [0, 100],
      happiness: [0, 100],
      stability: [0, 100],
      environment: [0, 100],
      debt: [0, 150],
    } as const;

    for (let trial = 0; trial < 200; trial++) {
      const shares = {} as Record<(typeof sectors)[number], number>;
      let remaining = 100;

      for (let i = 0; i < sectors.length - 1; i++) {
        const share = Math.floor(rng() * (remaining + 1));
        shares[sectors[i]!] = share;
        remaining -= share;
      }

      shares[sectors[sectors.length - 1]!] = remaining;

      const budget = {
        shares,
        borrowing: Math.floor(rng() * 7) * 5,
      };

      const result = resolveYear(
        createInitialState(),
        budget,
        baseInputs
      );

      for (const indicator of [
        'economy',
        'happiness',
        'stability',
        'environment',
        'debt',
      ] as const) {
        const value = result.state[indicator];

        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(caps[indicator][0]);
        expect(value).toBeLessThanOrEqual(caps[indicator][1]);
      }
    }
  });


it('reconciles every explanation line exactly to the resulting indicator', () => {
    const result = resolveYear(
      createInitialState(),
      defaultBudget(),
      baseInputs
    );

    for (const key of [
      'economy',
      'happiness',
      'stability',
      'environment',
      'debt',
    ] as const) {
      const item = result.changes[key];

      expect(
        item.before +
          item.lines.reduce((sum, line) => sum + line.rounded, 0)
      ).toBe(item.after);

      expect(result.state[key]).toBe(item.after);
    }
  });
    it('applies extra revenue and emergency borrowing inputs', () => {
    const state = createInitialState();
    const budget = defaultBudget();

    const normal = resolveYear(state, budget, baseInputs);

    const withExtraRevenue = resolveYear(state, budget, {
      ...baseInputs,
      extraRevenue: 10,
    });

    const withEmergencyBorrowing = resolveYear(state, budget, {
      ...baseInputs,
      emergencyBorrowing: 10,
    });

    expect(withExtraRevenue.revenue).toBe(normal.revenue + 10);
    expect(withEmergencyBorrowing.availableFunds).toBe(normal.availableFunds + 10);
    expect(withEmergencyBorrowing.state.debt).toBeGreaterThan(normal.state.debt);
  });

  it('enforces the regular and combined emergency borrowing caps', () => {
    const state = createInitialState();
    const budget = defaultBudget();

    // Regular borrowing above 30 B must be rejected, even with emergency borrowing.
    expect(() =>
      resolveYear(
        state,
        { ...budget, borrowing: 35 },
        { ...baseInputs, emergencyBorrowing: 10 },
      ),
    ).toThrow(/Invalid budget|exceeds this year's cap/);

    // Regular borrowing of 30 B plus emergency borrowing of 20 B is allowed.
    expect(() =>
      resolveYear(
        state,
        { ...budget, borrowing: 30 },
        { ...baseInputs, emergencyBorrowing: 20 },
      ),
    ).not.toThrow();

    // Combined borrowing above 50 B must be rejected.
    expect(() =>
      resolveYear(
        state,
        { ...budget, borrowing: 30 },
        { ...baseInputs, emergencyBorrowing: 25 },
      ),
    ).toThrow(/Invalid budget|exceeds this year's cap/);
  });





  it('is deterministic for the same state, budget, and inputs', () => {
    const a = resolveYear(
      createInitialState(),
      defaultBudget(),
      baseInputs
    );

    const b = resolveYear(
      createInitialState(),
      defaultBudget(),
      baseInputs
    );

    expect(a).toEqual(b);

    const rngA = mulberry32(1234);
    const rngB = mulberry32(1234);

    expect(Array.from({ length: 20 }, rngA)).toEqual(
      Array.from({ length: 20 }, rngB)
    );
  });


  it('enumerates hidden values and contains actual outcomes across scenarios', () => {
    const rng = mulberry32(20261016);
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

    for (let trial = 0; trial < 30; trial++) {
      const state = createInitialState();
      state.economy = 20 + Math.floor(rng() * 61);
      state.happiness = 20 + Math.floor(rng() * 61);
      state.stability = 20 + Math.floor(rng() * 61);
      state.environment = 20 + Math.floor(rng() * 61);
      state.debt = 10 + Math.floor(rng() * 71);

      const shares = {} as Record<(typeof sectors)[number], number>;
      let remaining = 100;

      for (let i = 0; i < sectors.length - 1; i++) {
        const share = Math.floor(rng() * (remaining + 1));
        shares[sectors[i]!] = share;
        remaining -= share;
      }
      shares[sectors[sectors.length - 1]!] = remaining;

      const budget = {
        shares,
        borrowing: Math.floor(rng() * 7) * 5,
      };

      const revenueMin = 90;
      const revenueMax = 110;

const baseInputsForProjection = {
  revenueTradeModifier: 0 as const,
  interestRate: 0.05 as const,
};


      const projected = projectYear(state, budget, {
        revenueMin,
        revenueMax,
        baseInputs: baseInputsForProjection,
        crisisForSeverity: (severity) =>
          makeCrisis('outbreak', severity),
      });

      for (let revenue = revenueMin; revenue <= revenueMax; revenue++) {
        for (const severity of [1, 2, 3] as const) {
          for (const interestRate of [0.03, 0.05, 0.08] as const) {
            const actual = resolveYear(state, budget, {
              revenueTradeModifier: 0,
              interestRate,
              crisis: makeCrisis('outbreak', severity),
              revenueOverride: revenue,
            });

            for (const indicator of indicators) {
              expect(actual.state[indicator]).toBeGreaterThanOrEqual(
                projected.min[indicator],
              );
              expect(actual.state[indicator]).toBeLessThanOrEqual(
                projected.max[indicator],
              );
            }
          }
        }
      }

      expect(projected.combinations).toBe(21 * 3 * 3);
    }
  });



  it('adds an explicit limit line when clamping occurs', () => {
    const state = {
      ...createInitialState(),
      environment: 11,
    };

    const crisis = makeCrisis('heatwave', 3);

    const result = resolveYear(state, defaultBudget(), {
      ...baseInputs,
      crisis,
    });

    expect(
      result.changes.environment.lines.some(
        (line) => line.cause === 'Limit reached'
      )
    ).toBe(true);
  });

  it('applies the shutdown stability penalty', () => {
    const result = resolveYear(
      createInitialState(),
      defaultBudget(),
      { ...baseInputs, shutdown: true }
    );

    expect(
      result.changes.stability.lines.some(
        (line) =>
          line.cause === 'Government shutdown' &&
          line.raw === -5
      )
    ).toBe(true);
  });

  it('reduces sector spending to 80% during shutdown', () => {
    const normal = resolveYear(
      createInitialState(),
      defaultBudget(),
      baseInputs
    );

    const shutdown = resolveYear(
      createInitialState(),
      defaultBudget(),
      { ...baseInputs, shutdown: true }
    );

    for (const sector of [
      'health',
      'education',
      'security',
      'infrastructure',
      'environment',
      'industry',
      'debtRepayment',
    ] as const) {
      expect(shutdown.spending[sector]).toBeCloseTo(
        normal.spending[sector] * 0.8,
        8
      );
    }
  });
  it('reconciles every indicator explanation with the final state', () => {
    const previous = createInitialState();
    const budget = defaultBudget();

    const result = resolveYear(previous, budget, {
      revenueTradeModifier: 0,
      interestRate: 0.05,
      crisis: makeCrisis('outbreak', 1),
    });

    for (const indicator of [
      'economy',
      'happiness',
      'stability',
      'environment',
      'debt',
    ] as const) {
      const explanation = result.changes[indicator];

      expect(
        explanation.before +
          explanation.lines.reduce((sum, line) => sum + line.rounded, 0),
      ).toBe(explanation.after);

      expect(explanation.after).toBe(result.state[indicator]);
    }
  });

  it('reconciles explanation lines across 1000 deterministic random years', () => {
    const rng = mulberry32(20261015);
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

    for (let trial = 0; trial < 1000; trial++) {
      const shares = {} as Record<(typeof sectors)[number], number>;
      let remaining = 100;

      for (let i = 0; i < sectors.length - 1; i++) {
        const share = Math.floor(rng() * (remaining + 1));
        shares[sectors[i]!] = share;
        remaining -= share;
      }
      shares[sectors[sectors.length - 1]!] = remaining;

      const borrowing = Math.floor(rng() * 7) * 5;
      const crisisId = crisisIds[Math.floor(rng() * crisisIds.length)]!;
      const severity = ([1, 2, 3] as const)[Math.floor(rng() * 3)]!;

      const result = resolveYear(
        createInitialState(),
        { shares, borrowing },
        {
          revenueTradeModifier: ([-8, -4, 0, 4, 8] as const)[
            Math.floor(rng() * 5)
          ]!,
          interestRate: ([0.03, 0.05, 0.08] as const)[
            Math.floor(rng() * 3)
          ]!,
          crisis: makeCrisis(crisisId, severity),
        }
      );

      for (const indicator of indicators) {
        const explanation = result.changes[indicator];

        expect(
          explanation.before +
            explanation.lines.reduce(
              (sum, line) => sum + line.rounded,
              0
            )
        ).toBe(explanation.after);

        expect(result.state[indicator]).toBe(explanation.after);
      }
    }
  });

  it('applies Infrastructure delayed Economy effects after one year', () => {
    const budget = {
      shares: {
        health: 0,
        education: 0,
        security: 0,
        infrastructure: 100,
        environment: 0,
        industry: 0,
        debtRepayment: 0,
      },
      borrowing: 0,
    };

    const year1 = resolveYear(
      createInitialState(),
      budget,
      baseInputs,
    );

    expect(
      year1.changes.economy.lines.some(
        (line) => line.cause === 'Infrastructure investment from Year 1',
      ),
    ).toBe(false);

    const year2 = resolveYear(year1.state, budget, baseInputs);

    expect(
      year2.changes.economy.lines.some(
        (line) => line.cause === 'Infrastructure investment from Year 1',
      ),
    ).toBe(true);

    expect(
      year2.state.delayedEffects.some(
        (effect) => effect.cause === 'Infrastructure investment from Year 1',
      ),
    ).toBe(false);
  });



  it('applies Education delayed Economy effects after two years', () => {
    const budget = defaultBudget();
    budget.shares.education = 100;
    budget.shares.health = 0;
    budget.shares.security = 0;
    budget.shares.infrastructure = 0;
    budget.shares.environment = 0;
    budget.shares.industry = 0;
    budget.shares.debtRepayment = 0;

    const safeState = {
      ...createInitialState(),
      economy: 70,
      happiness: 80,
      stability: 80,
      environment: 80,
      debt: 20,
    };

    const year1 = resolveYear(safeState, budget, baseInputs);

    expect(
      year1.state.delayedEffects.some(
        (effect) => effect.cause === 'Education investment from Year 1',
      ),
    ).toBe(true);

    const year2 = resolveYear(year1.state, defaultBudget(), baseInputs);

    expect(
      year2.changes.economy.lines.some(
        (line) => line.cause === 'Education investment from Year 1',
      ),
    ).toBe(false);

    const year3 = resolveYear(year2.state, defaultBudget(), baseInputs);

    expect(
      year3.changes.economy.lines.some(
        (line) => line.cause === 'Education investment from Year 1',
      ),
    ).toBe(true);

        expect(
      year3.state.delayedEffects.some(
        (effect) => effect.cause === 'Education investment from Year 1',
      ),
    ).toBe(false);
  });
});
