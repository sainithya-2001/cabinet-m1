
import { supabase } from './supabase.js';

type RoomResponse = {
  roomCode: string;
  roomId: string;
  playerToken: string;
};

async function callRoomFunction(
  body: Record<string, string>,
): Promise<RoomResponse> {
  const { data, error } = await supabase.functions.invoke(
    'cabinet-rooms',
    { body },
  );

  if (error) {
    throw new Error(error.message || 'Could not connect to the game server.');
  }

  if (
    !data ||
    typeof data.roomCode !== 'string' ||
    typeof data.roomId !== 'string' ||
    typeof data.playerToken !== 'string'
  ) {
    throw new Error(data?.error || 'The game server returned an invalid response.');
  }

  return data as RoomResponse;
}

export async function createRoom(playerName: string) {
  return callRoomFunction({
    action: 'create',
    playerName: playerName.trim(),
  });
}
export async function joinRoom(roomCode: string, playerName: string) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const normalizedName = playerName.trim();

  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    throw new Error('Enter a valid six-character room code.');
  }

  if (normalizedName.length < 1 || normalizedName.length > 30) {
    throw new Error('Your name must be between 1 and 30 characters.');
  }

  return callRoomFunction({
    action: 'join',
    roomCode: normalizedCode,
    playerName: normalizedName,
  });
}

export type RoomPlayer = {
  player_name: string;
  joined_at: string;
};

export async function getRoomPlayers(
  roomId: string,
  playerToken: string,
): Promise<RoomPlayer[]> {
  const { data, error } = await supabase.functions.invoke(
    'cabinet-rooms',
    {
      body: {
        action: 'players',
        roomId,
        playerToken,
      },
    },
  );

  if (error) {
    throw new Error(error.message || 'Could not load players.');
  }

  if (!data || !Array.isArray(data.players)) {
    throw new Error(data?.error || 'Invalid player list response.');
  }

  return data.players as RoomPlayer[];
}

export type PublicGamePlayer = {
  id: string; name: string; seat: number; isBot: boolean; ministry: string; ready: boolean;
};
export type PublicGameState = {
  version: number; status: 'waiting' | 'playing' | 'finished'; createdAt: number;
  phase: string; phaseStartedAt: number; phaseDeadline: number | null; year: number;
  players: PublicGamePlayer[];
  chat: Array<{ playerId: string; name: string; text: string; at: number }>;
  budgetDraft: Record<string, number> | null; votes: Record<string, boolean>; result: unknown;
  primeMinisterId?: string | null; voteChoices?: Record<string, boolean>; guesses?: Record<string, string>;
  country?: { economy:number; happiness:number; stability:number; environment:number; debt:number; collapsed:boolean; collapseReasons:string[] } | null;
  lastPassedBudget?: unknown; failedVotes?: number;
};
export type PrivateGameInfo = { ministry: string; isMole: boolean; clue: string };
async function callGameAction<T>(roomId: string, playerToken: string, action: string, payload?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cabinet-rooms', {
    body: { action, roomId, playerToken, ...(payload === undefined ? {} : { payload }) },
  });
  if (error) throw new Error(error.message || 'Could not connect to the game server.');
  if (!data || data.error) throw new Error(data?.error || 'The game server returned an invalid response.');
  return data as T;
}
export async function startGame(roomId: string, playerToken: string) {
  return callGameAction<{ state: PublicGameState; private: PrivateGameInfo }>(roomId, playerToken, 'start');
}
export async function getGameState(roomId: string, playerToken: string) {
  return callGameAction<{ state: PublicGameState | null; status?: string }>(roomId, playerToken, 'state');
}
export async function getPrivateGameInfo(roomId: string, playerToken: string) {
  return callGameAction<{ private: PrivateGameInfo | null }>(roomId, playerToken, 'private');
}
export async function markReady(roomId: string, playerToken: string) {
  return callGameAction<{ state: PublicGameState }>(roomId, playerToken, 'ready');
}
export async function sendRoomChat(roomId: string, playerToken: string, text: string) {
  return callGameAction<{ state: PublicGameState }>(roomId, playerToken, 'chat', { text });
}

export type LiteBudgetDraft = { health:number; education:number; security:number; environment:number; economy:number; borrowing:0|10|20 };
export async function submitLiteBudget(roomId:string,playerToken:string,budget:LiteBudgetDraft) {
  return callGameAction<{state:PublicGameState}>(roomId,playerToken,'budget',budget);
}
export async function castBudgetVote(roomId:string,playerToken:string,yes:boolean) {
  return callGameAction<{state:PublicGameState}>(roomId,playerToken,'vote',{yes});
}

export async function submitMoleGuess(roomId:string,playerToken:string,playerId:string) {
  return callGameAction<{state:PublicGameState}>(roomId,playerToken,'guess',{playerId});
}
