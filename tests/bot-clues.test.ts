import { describe, expect, it } from 'vitest';
import { botClueValue } from '../src/engine/bot-clues.ts';

describe('bot clue tells', () => {
  it('applies loyal bot tells and clamps clue ranges', () => {
    expect(botClueValue('Baroness Slowclap', 'Health', 40, false)).toBe(32);
    expect(botClueValue('The Hon. Member for Shouting', 'Defense', 40, false)).toBe(52);
    expect(botClueValue('Lord Ribbon-Cutter', 'Environment', 40, false)).toBe(48);
    expect(botClueValue('Sir Nodsalot', 'Health', 40, false)).toBe(40);
    expect(botClueValue('The Hon. Member for Shouting', 'Environment', 60, false)).toBe(60);
    expect(botClueValue('Baroness Slowclap', 'Finance', 60, false)).toBe(60);
  });
  it('makes Mole bots lie in the harmful direction', () => {
    expect(botClueValue('Baroness Slowclap', 'Health', 40, true)).toBe(48);
    expect(botClueValue('The Hon. Member for Shouting', 'Health', 40, true)).toBe(32);
    expect(botClueValue('Lord Ribbon-Cutter', 'Health', 40, true)).toBe(32);
    expect(botClueValue('Sir Nodsalot', 'Health', 40, true)).toBe(32);
    expect(botClueValue('Sir Nodsalot', 'Finance', 100, true)).toBe(118);
    expect(botClueValue('Sir Nodsalot', 'Finance', 135, true)).toBe(140);
  });
});
