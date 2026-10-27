
import { describe, expect, it } from 'vitest';
import { createGameSetup } from '../src/engine/game.ts';
import { createGameFlow } from '../src/engine/game-flow.ts';
import {
  assertPlayerCanAct,
  assertPlayerCanUsePower,
} from '../src/engine/player-actions.ts';

function makeFlow() {
  const setup = createGameSetup(
    123,
    ['Alex', 'Blair', 'Casey', 'Drew'],
    'standard',
    'full',
  );

  return createGameFlow(setup);
}

describe('player action eligibility', () => {
  it('allows an eligible player to act', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    expect(assertPlayerCanAct(flow, player.id)).toEqual(player);
  });

  it('rejects an unknown player', () => {
    expect(() => assertPlayerCanAct(makeFlow(), 'missing-player'))
      .toThrow('Player does not exist in this game.');
  });

  it('rejects a disconnected player', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    player.connected = false;
    expect(() => assertPlayerCanAct(flow, player.id))
      .toThrow('Disconnected players cannot act.');
  });

  it('rejects an expelled player', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    player.expelled = true;
    expect(() => assertPlayerCanAct(flow, player.id))
      .toThrow('Expelled players cannot act.');
  });

  it('rejects actions in the wrong phase', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    expect(() => assertPlayerCanAct(flow, player.id, ['draft', 'vote']))
      .toThrow('This action is not allowed during the current phase.');
  });

  it('rejects a power that was already used', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    player.powerUsed = true;
    expect(() => assertPlayerCanUsePower(flow, player.id, ['news']))
      .toThrow('This player has already used their ministry power.');
  });

  it('rejects actions after the game finishes', () => {
    const flow = makeFlow();
    const player = flow.setup.players[0]!;
    flow.phase = 'finished';
    expect(() => assertPlayerCanAct(flow, player.id))
      .toThrow('The game has already finished.');
  });
});
