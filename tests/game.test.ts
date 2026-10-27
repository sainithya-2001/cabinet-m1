
import { describe, expect, it } from 'vitest';
import {
  AGENDAS,
  createGameSetup,
  nextPrimeMinister,
  MINISTRY_ORDER,
} from '../src/engine/game.ts';

describe('game setup', () => {
  it('creates an eight-year Standard game with one hidden Mole', () => {
    const game = createGameSetup(
      12345,
      ['Alex', 'Blair', 'Casey', 'Devon'],
      'standard',
      'full',
    );

    expect(game.totalYears).toBe(8);
    expect(game.year).toBe(0);
    expect(game.players).toHaveLength(4);
    expect(game.players.filter((player) => player.isMole)).toHaveLength(1);
    expect(game.molePlayerId).not.toBeNull();
    expect(game.crisisGoal).toBeNull();
  });

  it('creates a five-year Quick game', () => {
    const game = createGameSetup(
      12345,
      ['Alex', 'Blair', 'Casey'],
      'crisis',
      'quick',
    );

    expect(game.totalYears).toBe(5);
    expect(game.players).toHaveLength(3);
    expect(game.players.every((player) => !player.isMole)).toBe(true);
    expect(game.molePlayerId).toBeNull();
    expect(game.crisisGoal).not.toBeNull();
  });

  it('assigns ministries in the specified priority order', () => {
    const game = createGameSetup(
      12345,
      ['Alex', 'Blair', 'Casey', 'Devon'],
      'crisis',
      'full',
    );

    expect(
      [...game.players]
        .sort((a, b) => a.seat - b.seat)
        .map((player) => player.ministry),
    ).toEqual(MINISTRY_ORDER.slice(0, 4));
  });

  it('is reproducible for the same seed and inputs', () => {
    const names = ['Alex', 'Blair', 'Casey', 'Devon'];

    expect(
      createGameSetup(9876, names, 'standard', 'full'),
    ).toEqual(
      createGameSetup(9876, names, 'standard', 'full'),
    );
  });

  it('assigns each player an agenda belonging to their ministry', () => {
    const game = createGameSetup(
      12345,
      ['Alex', 'Blair', 'Casey', 'Devon'],
      'standard',
      'full',
    );

    for (const player of game.players) {
      expect(AGENDAS[player.ministry]).toContain(player.agenda);
    }
  });

  it('skips disconnected and expelled players when choosing the next PM', () => {
    const game = createGameSetup(
      12345,
      ['Alex', 'Blair', 'Casey', 'Devon'],
      'crisis',
      'full',
    );

    const firstSeat = game.players.find((player) => player.seat === 1)!;
    firstSeat.connected = false;

    const secondSeat = game.players.find((player) => player.seat === 2)!;
    secondSeat.expelled = true;

    const next = nextPrimeMinister(game, 0);

    expect(next).not.toBeNull();
    expect(next?.seat).toBe(3);
  });

  it('rejects invalid player counts and duplicate names', () => {
    expect(() =>
      createGameSetup(1, ['Alex', 'Blair', 'Casey'], 'standard', 'full'),
    ).toThrow();

    expect(() =>
      createGameSetup(1, ['Alex', 'Blair', 'Casey'], 'crisis', 'full'),
    ).not.toThrow();

    expect(() =>
      createGameSetup(1, ['Alex', 'Blair', 'alex', 'Devon'], 'standard', 'full'),
    ).toThrow();
  });
  it('rejects invalid game modes and game lengths at runtime', () => {
    expect(() =>
      createGameSetup(
        1,
        ['Alex', 'Blair', 'Casey'],
        'invalid' as 'crisis',
        'full',
      ),
    ).toThrow(/Invalid game mode/);

    expect(() =>
      createGameSetup(
        1,
        ['Alex', 'Blair', 'Casey'],
        'crisis',
        'invalid' as 'quick',
      ),
    ).toThrow(/Invalid game length/);
  });
  it('rejects a seed that is not a safe integer', () => {
    expect(() =>
      createGameSetup(
        Number.MAX_SAFE_INTEGER + 1,
        ['Alex', 'Blair', 'Casey'],
        'crisis',
        'full',
      ),
    ).toThrow(/safe integer/);
  });

  it('rejects a player-name input that is not an array of strings', () => {
    expect(() =>
      createGameSetup(
        1,
        null as unknown as string[],
        'crisis',
        'full',
      ),
    ).toThrow(/array of strings/);

    expect(() =>
      createGameSetup(
        1,
        ['Alex', 42, 'Casey'] as unknown as string[],
        'crisis',
        'full',
      ),
    ).toThrow(/array of strings/);
  });
  it('trims player names and rejects duplicates ignoring case and whitespace', () => {
    const game = createGameSetup(
      1,
      ['  Alex  ', 'Blair', 'Casey'],
      'crisis',
      'full',
    );

    expect(game.players.some((player) => player.name === 'Alex')).toBe(true);

    expect(() =>
      createGameSetup(
        1,
        ['Alex', '  alex  ', 'Casey'],
        'crisis',
        'full',
      ),
    ).toThrow(/unique/i);
  });
});
