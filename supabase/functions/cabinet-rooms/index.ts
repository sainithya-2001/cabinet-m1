
import { withSupabase } from "@supabase/server";

type RequestBody = {
  action?: unknown;
  roomCode?: unknown;
  playerName?: unknown;
  roomId?: unknown;
  playerToken?: unknown;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, { status });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));

  return Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      let body: RequestBody;

      try {
        const parsed: unknown = await req.json();

        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          return jsonResponse({ error: "Invalid request body." }, 400);
        }

        body = parsed as RequestBody;
      } catch {
        return jsonResponse(
          { error: "Request body must be valid JSON." },
          400,
        );
      }

      if (body.action === "create") {
        const playerToken = randomToken();
        const tokenHash = await hashToken(playerToken);

        for (let attempt = 0; attempt < 5; attempt++) {
          const roomCode = generateRoomCode();

          const { data, error } = await ctx.supabaseAdmin
            .from("game_rooms")
            .insert({
  room_code: roomCode,
  host_name: typeof body.playerName === "string"
    ? body.playerName.trim().slice(0, 30) || "Host"
    : "Host",
  host_token_hash: tokenHash,
  game_state: {},
})
            .select("id")
            .single();

          if (!error && data) {
            return jsonResponse({
              roomCode,
              roomId: data.id,
              playerToken,
            });
          }

          if (error?.code !== "23505") {
            console.error("Room creation failed:", error?.message);
            return jsonResponse(
              { error: "Could not create the room. Please try again." },
              500,
            );
          }
        }

        return jsonResponse(
          { error: "Could not generate a unique room code. Please try again." },
          503,
        );
      }

      if (body.action === "join") {
        if (typeof body.roomCode !== "string") {
          return jsonResponse({ error: "Enter a valid room code." }, 400);
        }

        if (typeof body.playerName !== "string") {
          return jsonResponse({ error: "Enter your player name." }, 400);
        }

        const roomCode = body.roomCode.trim().toUpperCase();
        const playerName = body.playerName.trim();

        if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
          return jsonResponse(
            { error: "Enter a valid six-character room code." },
            400,
          );
        }

        if (playerName.length < 1 || playerName.length > 30) {
          return jsonResponse(
            { error: "Your name must be between 1 and 30 characters." },
            400,
          );
        }

        const { data: room, error: roomError } = await ctx.supabaseAdmin
          .from("game_rooms")
          .select("id")
          .eq("room_code", roomCode)
          .eq("status", "waiting")
          .maybeSingle();

        if (roomError) {
          console.error("Room lookup failed:", roomError.message);
          return jsonResponse({ error: "Could not look up that room." }, 500);
        }

        if (!room) {
          return jsonResponse(
            { error: "Room not found or no longer accepting players." },
            404,
          );
        }

        const playerToken = randomToken();
        const tokenHash = await hashToken(playerToken);

        const { error: playerError } = await ctx.supabaseAdmin
          .from("game_players")
          .insert({
            room_id: room.id,
            player_name: playerName,
            player_token_hash: tokenHash,
          });

        if (playerError) {
          if (playerError.code === "23505") {
            return jsonResponse(
              { error: "That name is already taken in this room." },
              409,
            );
          }

          console.error("Player join failed:", playerError.message);
          return jsonResponse({ error: "Could not join the room." }, 500);
        }

        return jsonResponse({
          roomCode,
          roomId: room.id,
          playerToken,
        });
      }

            if (body.action === "players") {
        if (
          typeof body.roomId !== "string" ||
          typeof body.playerToken !== "string"
        ) {
          return jsonResponse(
            { error: "Room ID and player token are required." },
            400,
          );
        }

        const tokenHash = await hashToken(body.playerToken);

        const { data: room, error: roomError } = await ctx.supabaseAdmin
          .from("game_rooms")
          .select("id, host_token_hash, host_name")
          .eq("id", body.roomId)
          .maybeSingle();

        if (roomError || !room) {
          return jsonResponse({ error: "Room not found." }, 404);
        }

        let authorized = room.host_token_hash === tokenHash;

        if (!authorized) {
          const { data: player, error: playerError } =
            await ctx.supabaseAdmin
              .from("game_players")
              .select("id")
              .eq("room_id", room.id)
              .eq("player_token_hash", tokenHash)
              .maybeSingle();

          if (playerError) {
            return jsonResponse(
              { error: "Could not verify player access." },
              500,
            );
          }

          authorized = player !== null;
        }

        if (!authorized) {
          return jsonResponse({ error: "Invalid player token." }, 401);
        }

        const { data: joinedPlayers, error: playersError } =
  await ctx.supabaseAdmin
    .from("game_players")
    .select("player_name, joined_at")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

        if (playersError) {
          return jsonResponse(
            { error: "Could not load players." },
            500,
          );
        }

        return jsonResponse({
  players: [
    {
      player_name: room.host_name,
      joined_at: "",
    },
    ...(joinedPlayers ?? []),
  ],
});
      }

      return jsonResponse({ error: "Unknown action." }, 400);
    },
  ),
};
