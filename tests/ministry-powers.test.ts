
import { MINISTRY_POWER_RULES } from '../src/engine/ministry-powers.js';
import { describe, expect, it } from 'vitest';
import { createGameSetup } from '../src/engine/game.js';
import { createGameFlow } from '../src/engine/game-flow.js';
import {
  validateMinistryPower,
  type MinistryPower,
} from '../src/engine/ministry-powers.js';

function makeFlow() {
  const setup = createGameSetup(
    123,
    ['Alex', 'Blair', 'Casey', 'Drew', 'Eli', 'Frank', 'Gray', 'Harper'],
    'standard',
    'full',
  );

  return createGameFlow(setup);
}
function playerWithMinistry(
  flow: ReturnType<typeof makeFlow>,
  ministry: string,
) {
  const player = flow.setup.players.find(
    (candidate) => candidate.ministry === ministry,
  );

  if (!player) {
    throw new Error(`Test setup has no ${ministry} player.`);
  }

  return player;
}

describe('ministry power validation', () => {
  it('allows Finance to use Emergency Loan during Draft', () => {
    const flow = makeFlow();
    flow.phase = 'draft';
    const player = playerWithMinistry(flow, 'finance');

    expect(
      validateMinistryPower(flow, player.id, 'emergency-loan'),
    ).toEqual(player);
  });

  it('allows Trade to use Trade Deal during Vote', () => {
    const flow = makeFlow();
    flow.phase = 'vote';
    const player = playerWithMinistry(flow, 'trade');

    expect(
      validateMinistryPower(flow, player.id, 'trade-deal'),
    ).toEqual(player);
  });

  it('rejects a power used by the wrong ministry', () => {
    const flow = makeFlow();
    flow.phase = 'draft';
    const player = playerWithMinistry(flow, 'health');

    expect(() =>
      validateMinistryPower(flow, player.id, 'emergency-loan'),
    ).toThrow('Only the finance ministry can use emergency-loan.');
  });

  it('rejects a power in the wrong phase', () => {
    const flow = makeFlow();
    flow.phase = 'news';
    const player = playerWithMinistry(flow, 'finance');

    expect(() =>
      validateMinistryPower(flow, player.id, 'emergency-loan'),
    ).toThrow('This action is not allowed during the current phase.');
  });

  it('rejects a power already used', () => {
    const flow = makeFlow();
    flow.phase = 'draft';
    const player = playerWithMinistry(flow, 'finance');
    player.powerUsed = true;

    expect(() =>
      validateMinistryPower(flow, player.id, 'emergency-loan'),
    ).toThrow('This player has already used their ministry power.');
  });

  it('defines the expected ministry and phases for every power', () => {
  expect(MINISTRY_POWER_RULES).toEqual({
    'emergency-loan': {
      ministry: 'finance',
      allowedPhases: ['draft', 'vote'],
    },
    'trade-deal': {
      ministry: 'trade',
      allowedPhases: ['draft', 'vote'],
    },
    audit: {
      ministry: 'environment',
      allowedPhases: ['debate', 'draft'],
    },
    'expert-testimony': {
      ministry: 'education',
      allowedPhases: ['debate'],
    },
    'fast-track': {
      ministry: 'infrastructure',
      allowedPhases: ['resolve'],
    },
    'emergency-session': {
      ministry: 'health',
      allowedPhases: ['vote'],
    },
    veto: {
      ministry: 'defense',
      allowedPhases: ['vote'],
    },
    investigate: {
      ministry: 'intelligence',
      allowedPhases: ['news', 'intel', 'debate', 'draft', 'vote'],
    },
  });
});
});
