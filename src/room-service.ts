
import { supabase } from './supabase.js';

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));

  return Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
}

export async function createRoom() {
  const playerToken = randomToken();
  const tokenHash = await hashToken(playerToken);

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();

    const { data, error } = await supabase.rpc('create_game_room', {
      p_room_code: roomCode,
      p_host_token_hash: tokenHash,
      p_initial_state: {},
    });

    if (!error) {
      return { roomCode, roomId: data as string, playerToken };
    }

    if (!error.message.toLowerCase().includes('duplicate key')) {
      throw new Error(error.message);
    }
  }

  throw new Error('Could not generate a unique room code. Please try again.');
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

  const playerToken = randomToken();
  const tokenHash = await hashToken(playerToken);

  const { data, error } = await supabase.rpc('join_game_room', {
    p_room_code: normalizedCode,
    p_player_name: normalizedName,
    p_player_token_hash: tokenHash,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { roomCode: normalizedCode, roomId: data as string, playerToken };
}
