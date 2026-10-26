import { describe, expect, it } from 'vitest';
import { fromEngineBudget, toEngineBudget, validateLiteBudget } from './lite-budget.ts';
import { createLiteGameSetup } from './lite-setup.ts';
import { liteCollapseVerdict } from './lite-collapse.ts';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Cabinet Lite budget adapter', () => {
  it('maps ten coins to the seven-sector engine budget without changing engine tuning', () => {
    const draft = { health: 2, education: 2, security: 2, environment: 2, economy: 2, borrowing: 10 as const };
    const budget = toEngineBudget(draft);

    expect(Object.values(budget.shares).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(budget.shares).toEqual({
      health: 20,
      education: 20,
      security: 20,
      infrastructure: 6,
      environment: 20,
      industry: 14,
      debtRepayment: 0,
    });
    expect(fromEngineBudget(budget)).toEqual(draft);
  });

  it('rejects budgets that do not allocate exactly ten coins', () => {
    expect(validateLiteBudget({
      health: 2, education: 2, security: 2, environment: 2, economy: 1, borrowing: 0,
    })).toContain('The budget must allocate exactly 10 coins.');
  });
});

describe('Cabinet Lite setup adapter', () => {
  it.each([2, 3, 4, 5, 6])('creates a three-year game with %i human players', (count) => {
    const humans = Array.from({ length: count }, (_, index) => ({
      id: `human-id-${index + 1}`,
      name: `Human ${index + 1}`,
    }));
    const game = createLiteGameSetup(12345, humans);

    expect(game.totalYears).toBe(3);
    expect(game.players.filter((player) => game.humanPlayerIds.includes(player.id))).toHaveLength(count);
    expect(game.botPlayerIds).toHaveLength(Math.max(0, 5 - count));
    expect(game.players).toHaveLength(Math.max(5, count));
    expect(game.molePlayerId).not.toBeNull();
    expect(game.players.slice(0, count).every((player) => game.humanPlayerIds.includes(player.id))).toBe(true);
  });

  it('rejects fewer than two or more than six humans', () => {
    expect(() => createLiteGameSetup(1, [{ id: 'a', name: 'A' }])).toThrow('2–6');
    expect(() => createLiteGameSetup(1, Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `P${i}` })))).toThrow('2–6');
  });
});

describe('Lite collapse ending', () => {
  it('finishes immediately when a Year 1 resolution collapses the country', () => {
    const verdict = liteCollapseVerdict(true, ['economy'], 'Baroness Slowclap');
    expect(verdict).toEqual({ outcome: 'Mole wins', reason: 'collapse', collapsedIndicator: 'economy', moleName: 'Baroness Slowclap' });
  });

  it('does not create a collapse verdict for a surviving year', () => {
    expect(liteCollapseVerdict(false, [], 'Baroness Slowclap')).toBeNull();
  });
});

describe('Cabinet Lite bot portraits', () => {
  it.each([
    ['Sir Nodsalot','sir-nodsalot'], ['Baroness Slowclap','baroness-slowclap'],
    ['Sir Reginald Filibuster','sir-reginald-filibuster'], ['The Hon. Member for Shouting','hon-member-for-shouting'],
    ['Minister Low-Battery','minister-low-battery'], ['The Paper-Tearer','paper-tearer'],
    ['Sir Point-of-Order','sir-point-of-order'], ['Lord Ribbon-Cutter','lord-ribbon-cutter'],
    ['Speaker Thunderbottom','speaker-thunderbottom'],
  ])('%s has a portrait file', (_name, slug) => {
    expect(existsSync(resolve(process.cwd(), 'public/images', slug + '.webp'))).toBe(true);
  });
});
