
import type { GameFlow, GamePhase } from './game-flow.ts';
import type { GamePlayer, Ministry } from './game.ts';
import { assertPlayerCanUsePower } from './player-actions.ts';

export type MinistryPower =
  | 'emergency-loan'
  | 'trade-deal'
  | 'audit'
  | 'expert-testimony'
  | 'fast-track'
  | 'emergency-session'
  | 'veto'
  | 'investigate';

export interface MinistryPowerDefinition {
  ministry: Ministry;
  allowedPhases: readonly GamePhase[];
}

export const MINISTRY_POWER_RULES: Record<
  MinistryPower,
  MinistryPowerDefinition
> = {
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
};

export function validateMinistryPower(
  flow: GameFlow,
  playerId: string,
  power: MinistryPower,
): GamePlayer {
  const rules = MINISTRY_POWER_RULES[power];

  const player = assertPlayerCanUsePower(
    flow,
    playerId,
    rules.allowedPhases,
  );

  if (player.ministry !== rules.ministry) {
    throw new Error(
      `Only the ${rules.ministry} ministry can use ${power}.`,
    );
  }

  return player;
}
