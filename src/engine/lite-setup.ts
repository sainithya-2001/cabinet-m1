import { createGameSetup, type GameSetup } from './game.ts';
import { mulberry32 } from './random.ts';

export interface LiteSeatInput {
  id: string;
  name: string;
}

export interface LiteGameSetup extends GameSetup {
  totalYears: 3;
  humanPlayerIds: string[];
  botPlayerIds: string[];
}

const BOT_NAMES = ['Ada', 'Boris', 'Cleo', 'Dmitri', 'Elsie', 'Felix'];

function shortUniqueName(name: string, used: Set<string>): string {
  const base = name.trim().slice(0, 16) || 'Player';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = String(suffix++);
    candidate = `${base.slice(0, 16 - tail.length)}${tail}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Adapts the existing engine setup for Cabinet Lite without changing engine
 * tuning: 2–6 humans, three years, and enough bot seats to reach five players.
 * Human identities remain the caller's stable IDs; bot IDs are server-side.
 */
export function createLiteGameSetup(
  seed: number,
  humanSeats: LiteSeatInput[],
): LiteGameSetup {
  if (!Number.isSafeInteger(seed)) throw new Error('Seed must be a safe integer.');
  if (humanSeats.length < 2 || humanSeats.length > 6) {
    throw new Error('Cabinet Lite requires 2–6 human players.');
  }
  if (humanSeats.some((p) => !p.id.trim() || !p.name.trim())) {
    throw new Error('Every human player needs an ID and a name.');
  }
  if (new Set(humanSeats.map((p) => p.id)).size !== humanSeats.length) {
    throw new Error('Human player IDs must be unique.');
  }
  if (new Set(humanSeats.map((p) => p.name.trim().toLowerCase())).size !== humanSeats.length) {
    throw new Error('Player names must be unique, ignoring case.');
  }

  const botCount = Math.max(0, 5 - humanSeats.length);
  const usedNames = new Set<string>();
  const namesById = new Map<string, string>();
  const namesForEngine = humanSeats.map((human, index) => {
    const name = shortUniqueName(human.name, usedNames);
    const id = `player-${index + 1}`;
    namesById.set(id, human.name.trim());
    return name;
  });

  for (let i = 0; i < botCount; i++) {
    const name = shortUniqueName(BOT_NAMES[i] ?? `Bot${i + 1}`, usedNames);
    namesForEngine.push(name);
    namesById.set(`player-${i + 1 + humanSeats.length}`, name);
  }

  const base = createGameSetup(seed, namesForEngine, 'standard', 'full');
  const rng = mulberry32(seed ^ 0x4c495445);
  const humanIdsByEngineId = new Map<string, string>();
  humanSeats.forEach((human, index) => humanIdsByEngineId.set(`player-${index + 1}`, human.id));

  const humanPlayers = base.players
    .filter((player) => humanIdsByEngineId.has(player.id))
    .map((player) => ({
      ...player,
      id: humanIdsByEngineId.get(player.id)!,
      name: humanSeats.find((human) => human.id === humanIdsByEngineId.get(player.id))!.name.trim(),
    }));

  const botPlayers = base.players
    .filter((player) => !humanIdsByEngineId.has(player.id))
    .map((player) => ({ ...player, name: namesById.get(player.id) ?? player.name }));

  const firstHuman = Math.floor(rng() * humanPlayers.length);
  const rotatedHumans = [
    ...humanPlayers.slice(firstHuman),
    ...humanPlayers.slice(0, firstHuman),
  ];
  const orderedPlayers = [...rotatedHumans, ...botPlayers].map((player, seat) => ({ ...player, seat }));
  const mole = orderedPlayers.find((player) => player.isMole);

  return {
    ...base,
    totalYears: 3,
    year: 0,
    players: orderedPlayers,
    molePlayerId: mole?.id ?? null,
    humanPlayerIds: orderedPlayers.filter((player) => humanSeats.some((human) => human.id === player.id)).map((p) => p.id),
    botPlayerIds: orderedPlayers.filter((player) => !humanSeats.some((human) => human.id === player.id)).map((p) => p.id),
  };
}
