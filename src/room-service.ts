
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