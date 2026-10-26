import { describe, expect, it } from 'vitest';
import { fromEngineBudget, toEngineBudget, validateLiteBudget } from './lite-budget.js';
import { createLiteGameSetup } from './lite-setup.js';

describe('Cabinet Lite budget adapter', () => {
  it('maps ten coins to the seven-sector engine budget without changing engine tuning', () => {
    const draft = { health: 2, education: 2, security: 2, environment: 2, economy: 2, borrowing: 10 as const };
    const budget = toEngineBudget(draft);

    expect(Object.values(budget.shares).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(budget.shares).toEqual({
      health: 20,
      education: 20,
      security: 20,
      infrastructure: 10,
      environment: 20,
      industry: 10,
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
