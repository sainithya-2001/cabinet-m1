
import type { GamePlayer } from './game.js';
import type { GameFlow, GamePhase } from './game-flow.js';

export function assertPlayerCanAct(
  flow: GameFlow,
  playerId: string,
  allowedPhases?: readonly GamePhase[],
): GamePlayer {
  if (flow.phase === 'finished') {
    throw new Error('The game has already finished.');
  }

  const player = flow.setup.players.find(
    (candidate) => candidate.id === playerId,
  );

  if (!player) {
    throw new Error('Player does not exist in this game.');
  }

  if (!player.connected) {
    throw new Error('Disconnected players cannot act.');
  }

  if (player.expelled) {
    throw new Error('Expelled players cannot act.');
  }

  if (allowedPhases && !allowedPhases.includes(flow.phase)) {
    throw new Error('This action is not allowed during the current phase.');
  }

  return player;
}

export function assertPlayerCanUsePower(
  flow: GameFlow,
  playerId: string,
  allowedPhases: readonly GamePhase[],
): GamePlayer {
  const player = assertPlayerCanAct(flow, playerId, allowedPhases);

  if (player.powerUsed) {
    throw new Error('This player has already used their ministry power.');
  }

  return player;
}
