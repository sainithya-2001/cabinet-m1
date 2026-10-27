import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOT_POOL } from '../src/engine/bot-roster.ts';

describe('bot portrait assets', () => {
  it('maps every bot in the server pool to an existing public image', () => {
    for (const bot of BOT_POOL) {
      expect(
        existsSync(resolve(process.cwd(), 'public', 'images', `${bot.portrait}.webp`)),
        `${bot.name} should map to public/images/${bot.portrait}.webp`,
      ).toBe(true);
    }
  });
});
