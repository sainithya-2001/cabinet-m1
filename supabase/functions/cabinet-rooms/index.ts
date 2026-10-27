import { liteCollapseVerdict } from "../../../src/engine/lite-collapse.ts";
import { calculateYearFinances, createInitialState, defaultBudget, resolveYear, sectorNeeds, yearNeedVariationSeed } from "../../../src/engine/economy.ts";
import { makeCrisis, CRISIS_TEMPLATES } from "../../../src/engine/crises.ts";
import type { Budget, CountryState, YearInputs } from "../../../src/engine/types.ts";
import { fallbackLiteDraft, toEngineBudget, validateLiteBudget, type LiteBudgetDraft } from "../../../src/engine/lite-budget.ts";
import { mutateVersionedState } from "../../../src/engine/versioned-mutation.ts";
import { toPublicGameState, type GamePlayer, type PublishedClue } from "../../../src/engine/public-game-state.ts";
import { withSupabase } from "@supabase/server";
import { BOT_POOL } from "../../../src/engine/bot-roster.ts";
import { botClueValue } from "../../../src/engine/bot-clues.ts";

type RequestBody = {
  action?: unknown; roomCode?: unknown; playerName?: unknown; roomId?: unknown;
  playerToken?: unknown; ready?: unknown; phaseAction?: unknown; payload?: unknown;
};
type Db = any;
type PlayerRow = { id: string; player_name: string; joined_at: string; player_token_hash: string };
type LiteState = {
  version: number; status: "waiting" | "playing" | "finished"; createdAt: number;
  phase: string; phaseStartedAt: number; phaseDeadline: number | null; year: number;
  players: GamePlayer[]; backbenchers: Array<{id:string;name:string;portrait:string}>; privateByPlayer: Record<string, { ministry: string; isMole: boolean; clue: string; trueValue: number }>;
  publishedClues: PublishedClue[];
  readyByPlayer: Record<string, boolean>;
  budgetDraft: Record<string, number> | null; votes: Record<string, boolean>; result: unknown;
  lastActionAt: Record<string, number>;
  country: CountryState | null;
  lastPassedBudget: Budget | null;
  failedVotes: 0 | 1;
  pendingBudget: Budget | null;
  voteChoices: Record<string, boolean>;
  crisisId: string | null;
  yearResolution: unknown;
  yearHistory?: Array<{year:number;crisis:string;primeMinister:string;passed:boolean;shutdown?:boolean;biggestChange:string}>;
  primeMinisterId: string | null;
  guesses: Record<string, string>;
  botPlan: Record<string, unknown>;
};
async function broadcastBotMoment(db: any, roomId: string, state: LiteState, moment: "clue" | "budget" | "vote" | "result") {
  const voices: Record<string, Partial<Record<typeof moment, string[]>>> = {
    "Sir Nodsalot": { clue: ["Zzz… a number. Wake me when it becomes policy.", "I heard a figure. I voted in my sleep once."], budget: ["Zzz… those coins look adequately round.", "I support whichever budget lets me nap."], vote: ["Was that a yes? I shall nod appropriately.", "The result is in. Excellent. Back to sleep."] },
    "Baroness Slowclap": { clue: ["👏 A 👏 figure 👏 of 👏 breathtaking 👏 ambition.", "How brave. A number without a shred of modesty."], budget: ["A budget. I shall applaud the arithmetic.", "At last, a chance to fund something with a proper entrance."], vote: ["A decision! Let us applaud the consequences.", "How decisive. Three very slow claps."] },
    "Sir Reginald Filibuster": { clue: ["That figure requires, at minimum, a subcommittee.", "I reserve judgement until I have spoken for forty minutes."], budget: ["I move that we debate every coin individually.", "This budget is missing an appendix and a lengthy preface."], vote: ["The House has decided, though I have not finished speaking.", "I request a recount of the arguments, not the votes."] },
    "The Hon. Member for Shouting": { clue: ["THAT NUMBER IS EITHER BRILLIANT OR A NATIONAL DISGRACE!", "I DEMAND THIS FIGURE BE READ ALOUD, LOUDER!"], budget: ["FUND SOMETHING! CUT SOMETHING! I FORGOT WHICH!", "THIS BUDGET HAS TOO MANY COINS AND NOT ENOUGH OUTRAGE!"], vote: ["THE HOUSE HAS SPOKEN! I SHALL SHOUT IT AGAIN!", "I ACCEPT THIS OUTCOME UNDER EXTREMELY LOUD PROTEST!"] },
    "Minister Low-Battery": { clue: ["number received. processing… maybe.", "that figure has low confidence and 2% battery."], budget: ["budget uploaded. have we tried turning the economy off and on?", "coins allocated. enthusiasm not found."], vote: ["result received. reaction loading…", "my civic battery is at 1%." ] },
    "The Paper-Tearer": { clue: ["*holds the figure up to the light, then tears it in half*", "This number has failed its paper inspection."], budget: ["*shuffles the budget papers ominously*", "Filed under ‘suspicious stationery’."], vote: ["*tears up one copy of the result, keeps another*", "The paperwork remains emotionally unofficial."] },
    "Sir Point-of-Order": { clue: ["POINT OF ORDER: what is the evidence for that figure?", "I request a footnote for this suspiciously round number."], budget: ["POINT OF ORDER: who authorised these coins to be adjacent?", "Procedurally interesting and morally confusing."], vote: ["POINT OF ORDER: I challenge the order of this result.", "The vote is concluded; my objections are just starting."] },
    "Lord Ribbon-Cutter": { clue: ["A splendid number. I can picture the unveiling ceremony.", "Imagine the headline. Imagine the ribbon."], budget: ["Can we unveil the health allocation with a ribbon?", "I propose a photo opportunity for each department."], vote: ["Whatever the result, I brought ceremonial scissors.", "A historic decision. Fetch the ribbon and photographer."] }
  };
  const available = [...(state.backbenchers ?? [])];
  if (!available.length) return;
  const count = Math.min(4, available.length, 2 + crypto.getRandomValues(new Uint32Array(1))[0] % 3);
  const channel = db.channel("cabinet-chat:" + roomId);
  for (let i = 0; i < count; i++) {
    const bot = available.splice(crypto.getRandomValues(new Uint32Array(1))[0] % available.length, 1)[0];
    const clue = (state.publishedClues ?? []).filter(c => c.year === state.year).slice(-1)[0];
    const sector = ["health","education","security","environment","economy"][i % 5];
    const amount = state.pendingBudget?.[sector] ?? state.budgetDraft?.[sector] ?? 0;
    const voteNames = state.players.filter(p => state.voteChoices?.[p.id] !== undefined).map(p => p.name + " voted " + (state.voteChoices[p.id] ? "aye" : "no"));
    const result = state.result as {resolution?:{changes?:Record<string,{before:number;after:number}>}} | null;
    const stability = result?.resolution?.changes?.stability;
    const dynamicLines = moment === "clue" && clue ? [clue.ministry === "Finance" ? "Revenue is " + clue.value + "? The Treasury has never been that cheerful." : clue.ministry + " at " + clue.value + "? That figure smells of committee.", "I have questions about " + clue.name + "'s suspiciously confident number."] : moment === "budget" ? ["Only " + amount + " coins for " + sector + "?", "My sector has submitted a formal complaint about this allocation."] : moment === "vote" ? [(voteNames.slice(-2).join("; ") || "The House") + ". I shall remember these votes.", "I heard those votes and reserve the right to be theatrically disappointed."] : ["Stability " + (stability ? (stability.after < stability.before ? "down " : "up ") + Math.abs(stability.after-stability.before) : "has changed") + "! Who could have predicted this? Me. I predicted this.", "The result is in. I shall pretend I expected it."];
    const options = [...(voices[bot.name]?.[moment] ?? []), ...dynamicLines];
    const message = { id: crypto.randomUUID(), playerId: bot.id, name: bot.name, text: options[crypto.getRandomValues(new Uint32Array(1))[0] % options.length], at: Date.now() + i * 1800 };
    if (i) await new Promise(resolve => setTimeout(resolve, 1800));
    try { await channel.send({ type: "broadcast", event: "chat-message", payload: message }); } catch (error) { console.error("Bot moment broadcast failed:", error); }
  }
}
function jsonResponse(body: Record<string, unknown>, status = 200): Response { return Response.json(body, { status }); }
type MutationResult = { state: LiteState; status?: string; changed?: boolean };
async function mutateGameState(db: Db, roomId: string, apply: (latest: LiteState | null, roomStatus: string) => MutationResult): Promise<{ state: LiteState; status: string }> {
  return mutateVersionedState<LiteState, string>({
    async read() {
      const { data: row, error } = await db.from("game_rooms").select("game_state,status").eq("id", roomId).maybeSingle();
      if (error || !row) throw new Error("Could not reload game state.");
      return { state: row.game_state as LiteState | null, status: row.status as string };
    },
    async compareAndSwap(expectedVersion, next, status) {
      let update = db.from("game_rooms").update({ game_state: next, status }).eq("id", roomId);
      update = expectedVersion !== null ? update.eq("game_state->>version", String(expectedVersion)) : update.is("game_state", null);
      const { data: saved, error } = await update.select("id").maybeSingle();
      if (error) throw new Error("Could not save game state.");
      return Boolean(saved);
    },
  }, apply);
}
function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
}
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function makePrivateClue(ministry: string): string {
  const clues: Record<string,string> = {
    Finance: "You alone know the exact revenue figure for this year.",
    Health: "You have the precise health-sector need for this year.",
    Defense: "You have the precise security-sector need for this year.",
    Education: "You have the precise education-sector need for this year.",
    Environment: "You have the precise environment-sector need for this year.",
    Economy: "You have the precise economy-sector need for this year.",
  };
  return clues[ministry] ?? "Watch the budget and look for inconsistencies in other ministers' claims.";
}
function publicState(state: LiteState) { return toPublicGameState(state); }
function trueClueValue(ministry: string, country: CountryState, crisisId: string, createdAt: number, year: number): number {
  const crisis = makeCrisis(crisisId, 2);
  const inputs: YearInputs = { revenueTradeModifier: 0, interestRate: 0.05, crisis, needVariationSeed: yearNeedVariationSeed(createdAt, year) };
  if (ministry === "Finance") return calculateYearFinances(country, defaultBudget(), inputs).revenue;
  const needs = sectorNeeds(inputs);
  if (ministry === "Health") return needs.health;
  if (ministry === "Defense") return needs.security;
  if (ministry === "Education") return needs.education;
  if (ministry === "Environment") return needs.environment;
  if (ministry === "Economy") return needs.industry + needs.infrastructure;
  return 0;
}
async function findPlayer(db: Db, roomId: string, token: string) {
  const tokenHash = await hashToken(token);
  const { data: player, error } = await db.from("game_players").select("id,player_name,joined_at,player_token_hash").eq("room_id", roomId).eq("player_token_hash", tokenHash).maybeSingle();
  if (error) throw new Error("Could not verify player access.");
  if (!player) throw new Error("Invalid player token.");
  return player as PlayerRow;
}
function liteDraftToBudget(draft: Record<string, number>): Budget {
  const errors = validateLiteBudget(draft as LiteBudgetDraft);
  if (errors.length) throw new Error(errors.join(" "));
  return toEngineBudget(draft as LiteBudgetDraft);
}
function applyYearResolution(
  state: LiteState,
  resolution: ReturnType<typeof resolveYear>,
  budget: Budget,
  now: number,
  resultDetails: Record<string, unknown>,
): LiteState {
  const collapsed = resolution.state.collapsed;
  return {
    ...state,
    yearHistory: [...(state.yearHistory ?? []), (() => { const changes = Object.entries(resolution.changes).flatMap(([indicator, change]) => change.lines.filter(line => line.rounded !== 0).map(line => ({ indicator, cause: line.cause, rounded: line.rounded }))).sort((a,b) => Math.abs(b.rounded)-Math.abs(a.rounded)); const pm = state.players.find(p => p.id === state.primeMinisterId)?.name ?? 'Unknown PM'; const crisis = state.crisisId ? makeCrisis(state.crisisId, 2).name : 'Unknown crisis'; return { year: state.year, crisis, primeMinister: pm, passed: resultDetails.passed === true, ...(resultDetails.shutdown === true ? { shutdown: true } : {}), biggestChange: changes[0] ? `${changes[0].indicator} ${changes[0].rounded > 0 ? '+' : ''}${changes[0].rounded} (${changes[0].cause})` : 'no major indicator change' }; })()],
    country: resolution.state,
    lastPassedBudget: budget,
    yearResolution: resolution,
    phase: collapsed ? "finished" : "result",
    phaseStartedAt: now,
    phaseDeadline: collapsed ? null : now + (state.year === 1 ? 15000 : 10000),
    status: collapsed ? "finished" : "playing",
    result: collapsed
      ? liteCollapseVerdict(true, resolution.state.collapseReasons, state.players.find((p) => p.isMole)?.name)
      : { ...resultDetails, resolution },
    pendingBudget: null,
    failedVotes: 0,
    voteChoices: {},
    votes: {},
    budgetDraft: null,
  };
}
function fallbackEngineBudget(): Budget {
  return toEngineBudget(fallbackLiteDraft());
}
function botDraft(state: LiteState): Record<string, number> {
  const pm = state.players.find((p) => p.id === state.primeMinisterId);
  // A Mole PM favours growth at the expense of public services and takes maximum debt.
  if (pm?.isMole) return { health: 1, education: 1, security: 1, environment: 1, economy: 6, borrowing: 20 };
  // Ordinary bot PMs use a balanced cabinet budget, with a small crisis-aware adjustment.
  const draft = { health: 2, education: 2, security: 2, environment: 2, economy: 2, borrowing: 0 };
  const crisis = state.crisisId;
  if (crisis === "outbreak") { draft.health++; draft.economy--; }
  else if (crisis === "border-tension" || crisis === "cyberattack" || crisis === "protests") { draft.security++; draft.economy--; }
  else if (crisis === "floods" || crisis === "heatwave") { draft.environment++; draft.economy--; }
  else if (crisis === "teacher-strike") { draft.education++; draft.economy--; }
  else if (crisis === "recession" || crisis === "energy-price-spike") { draft.economy++; draft.health--; }
  return draft;
}
function botVoteChoices(state: LiteState): Record<string, boolean> {
  const choices: Record<string, boolean> = {};
  for (const bot of state.players.filter((p) => p.isBot)) {
    // Keep the Mole's voting less predictable while making cabinet bots usually supportive.
    choices[bot.id] = crypto.getRandomValues(new Uint32Array(1))[0] % 100 < (bot.isMole ? 35 : 70);
  }
  return choices;
}
function initialLiteState(players: PlayerRow[], solo = false): LiteState {
  if (players.length < (solo ? 1 : 2) || players.length > 6) throw new Error(solo ? "Solo test mode requires one human player." : "Cabinet Lite requires 2–6 human players to start.");
  const seatRows = players.map((p) => ({ row: p, isBot: false }));
  const botPool = shuffle(BOT_POOL.map((bot) => ({ ...bot })));
  const cabinetBots=botPool.slice(0,Math.max(0,5-seatRows.length));
  for(const [index,bot] of cabinetBots.entries()) seatRows.push({row:{id:"bot-"+(index+1),player_name:bot.name,joined_at:new Date().toISOString(),player_token_hash:""},isBot:true});
  const backbenchers=botPool.slice(cabinetBots.length).map((bot,index)=>({id:"backbench-"+index,name:bot.name,portrait:bot.portrait}));
  const ministryOrder = ["Finance", "Health", "Defense", "Education", "Environment", "Economy"];
  const ministries = ministryOrder.slice(0, seatRows.length);
  // The Mole may be any cabinet member, including a bot, as specified by the game rules.
  const moleIndex = crypto.getRandomValues(new Uint32Array(1))[0] % seatRows.length;
  let humanJoinIndex = 0;
  const gamePlayers: GamePlayer[] = seatRows.map((item, seat) => {
    const avatar = item.isBot ? undefined : (humanJoinIndex++ % 2 === 0 ? "human-avatar-1" : "human-avatar-2");
    return {
      id: item.row.id, name: item.row.player_name, seat, isBot: item.isBot, avatar,
      ministry: ministries[seat], isMole: seat === moleIndex, ready: false,
    };
  });
  const initialCountry = createInitialState();
  const initialCrisisId = CRISIS_TEMPLATES[crypto.getRandomValues(new Uint32Array(1))[0] % CRISIS_TEMPLATES.length].id;
  const createdAt = Date.now();
  const privateByPlayer: LiteState["privateByPlayer"] = {};
  for (const player of gamePlayers) {
    const trueValue = trueClueValue(player.ministry, initialCountry, initialCrisisId, createdAt, 1);
    privateByPlayer[player.id] = {
      ministry: player.ministry, isMole: player.isMole, trueValue,
      clue: player.isMole ? "You are the Mole. Secretly undermine the government without revealing yourself." : makePrivateClue(player.ministry),
    };
  }
  // The first human is PM first; bots only rotate in after every human has had a turn.
  const humans = gamePlayers.filter((p) => !p.isBot);
  const bots = gamePlayers.filter((p) => p.isBot);
  const first = crypto.getRandomValues(new Uint32Array(1))[0] % humans.length;
  const ordered = [...humans.slice(first), ...humans.slice(0, first), ...bots].map((p, seat) => ({...p, seat}));
  return {
    version: 1, status: "playing", createdAt, phase: "headline",
    phaseStartedAt: Date.now(), phaseDeadline: Date.now() + 4000, year: 1,
    players: ordered, backbenchers, privateByPlayer, publishedClues: [], readyByPlayer: {},
    budgetDraft: null, votes: {}, result: null, lastActionAt: {}, yearHistory: [],
    country: initialCountry, lastPassedBudget: null, failedVotes: 0,
    pendingBudget: null, voteChoices: {}, crisisId: initialCrisisId, yearResolution: null,
    primeMinisterId: ordered.find(p => !p.isBot)?.id ?? null, guesses: {}, botPlan: {},
  };
}
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
    let body: RequestBody;
    try {
      const parsed: unknown = await req.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return jsonResponse({ error: "Invalid request body." }, 400);
      body = parsed as RequestBody;
    } catch { return jsonResponse({ error: "Request body must be valid JSON." }, 400); }
    const db: Db = ctx.supabaseAdmin;

    if (body.action === "create") {
      const playerName = typeof body.playerName === "string" ? body.playerName.trim().slice(0, 30) || "Host" : "Host";
      const playerToken = randomToken(), tokenHash = await hashToken(playerToken);
      for (let attempt = 0; attempt < 5; attempt++) {
        const roomCode = generateRoomCode();
        const { data: room, error } = await db.from("game_rooms").insert({room_code: roomCode,host_name: playerName,host_token_hash: tokenHash,game_state: { version: 0 },status:"waiting"}).select("id").single();
        if (error || !room) {
          if (error?.code === "23505") continue;
          console.error("Room creation failed:", error?.message);
          return jsonResponse({ error: "Could not create the room. Please try again." }, 500);
        }
        const { error: playerError } = await db.from("game_players").insert({room_id: room.id,player_name: playerName,player_token_hash: tokenHash});
        if (playerError) {
          await db.from("game_rooms").delete().eq("id", room.id);
          return jsonResponse({ error: "Could not initialize the host player." }, 500);
        }
        return jsonResponse({roomCode,roomId:room.id,playerToken});
      }
      return jsonResponse({error:"Could not generate a unique room code."},503);
    }

    if (body.action === "join") {
      if (typeof body.roomCode !== "string" || typeof body.playerName !== "string") return jsonResponse({error:"Room code and player name are required."},400);
      const roomCode=body.roomCode.trim().toUpperCase(), playerName=body.playerName.trim();
      if (!/^[A-Z0-9]{6}$/.test(roomCode)) return jsonResponse({error:"Enter a valid six-character room code."},400);
      if (playerName.length<1 || playerName.length>30) return jsonResponse({error:"Your name must be between 1 and 30 characters."},400);
      const {data:room,error}=await db.from("game_rooms").select("id").eq("room_code",roomCode).eq("status","waiting").maybeSingle();
      if(error)return jsonResponse({error:"Could not look up that room."},500);
      if(!room)return jsonResponse({error:"Room not found or no longer accepting players."},404);
      const {count}=await db.from("game_players").select("id",{count:"exact",head:true}).eq("room_id",room.id);
      if((count??0)>=6)return jsonResponse({error:"This room already has six human players."},409);
      const playerToken=randomToken(),tokenHash=await hashToken(playerToken);
      const {error:playerError}=await db.from("game_players").insert({room_id:room.id,player_name:playerName,player_token_hash:tokenHash});
      if(playerError)return jsonResponse({error:playerError.code==="23505"?"That name is already taken in this room.":"Could not join the room."},playerError.code==="23505"?409:500);
      return jsonResponse({roomCode,roomId:room.id,playerToken});
    }

    if (typeof body.roomId !== "string" || typeof body.playerToken !== "string") return jsonResponse({error:"Room ID and player token are required."},400);
    let player: PlayerRow;
    try { player=await findPlayer(db,body.roomId,body.playerToken); }
    catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not verify player access."},401); }

    const {data:room,error:roomError}=await db.from("game_rooms").select("id,room_code,status,game_state,host_token_hash").eq("id",body.roomId).maybeSingle();
    if(roomError||!room)return jsonResponse({error:"Room not found."},404);
    const state = room.game_state as LiteState | null;

    if(body.action==="players") {
      const {data:players,error}=await db.from("game_players").select("player_name,joined_at").eq("room_id",room.id).order("joined_at",{ascending:true});
      if(error)return jsonResponse({error:"Could not load players."},500);
      return jsonResponse({players:players??[]});
    }
    if(body.action==="start") {
      if(room.host_token_hash!==await hashToken(body.playerToken))return jsonResponse({error:"Only the host can start the game."},403);
      const {data:rows,error}=await db.from("game_players").select("id,player_name,joined_at,player_token_hash").eq("room_id",room.id).order("joined_at",{ascending:true});
      if(error)return jsonResponse({error:"Could not load players."},500);
      try {
        const initial=initialLiteState((rows??[]) as PlayerRow[], (body.payload as Record<string,unknown>|undefined)?.solo === true);
        const saved=await mutateGameState(db,room.id,(latest,roomStatus)=>{
          if (roomStatus !== "waiting") {
            if (latest) return { state: latest, status: roomStatus, changed: false };
            throw new Error("This room is no longer waiting and has no game state.");
          }
          if (latest && (latest.version !== 0 || Object.keys(latest).some(k => k !== "version"))) {
            throw new Error("The waiting room state is not a fresh lobby.");
          }
          return {state:initial,status:"playing"};
        });
        return jsonResponse({state:publicState(saved.state),private:{...saved.state.privateByPlayer[player.id],playerId:player.id}});
      }catch(e){return jsonResponse({error:e instanceof Error?e.message:"Could not start game."},409);}
    }
    if(body.action==="state") {
      if (room.status === "waiting") return jsonResponse({state:null,status:"waiting"});
      const observedPhase = state?.phase;
      const observedYear = state?.year;
      const observedDeadline = state?.phaseDeadline;
      try {
        const saved = await mutateGameState(db, room.id, (state, roomStatus) => {
          if (!state) throw new Error("The game has not started.");
          // Another request may already have advanced the deadline we observed.
          if (state.phase !== observedPhase || state.year !== observedYear || state.phaseDeadline !== observedDeadline) {
            return { state, status: roomStatus, changed: false };
          }
          const now=Date.now();
          let next=state;
          if (state.status === "playing" && state.phase === "clue") {
            const dueBots = state.players.filter(p => p.isBot && !state.publishedClues.some(c => c.playerId === p.id && c.year === state.year) && now >= state.phaseStartedAt + 2500 + p.seat * 3500);
            if (dueBots.length) {
              const published = [...state.publishedClues];
              for (const bot of dueBots) {
                const secret = state.privateByPlayer[bot.id]; if (!secret) continue;
                const truth = secret.trueValue;
                const value = botClueValue(bot.name, bot.ministry, truth, secret.isMole);
                published.push({playerId:bot.id,name:bot.name,ministry:secret.ministry,value,trueValue:truth,year:state.year,at:now});
              }
              next = {...next,publishedClues:published,version:next.version+1};
            }
          }
          if (!(state.status==="playing" && state.phaseDeadline!==null && now>=state.phaseDeadline)) return {state:next,status:roomStatus,changed:next!==state};
                if(state.status==="playing" && state.phaseDeadline!==null && now>=state.phaseDeadline) {
                  const phases: Record<string,string> = { headline:"clue", clue:"budget", budget:"vote", vote:"result", result:"headline", guess:"finished" };
                  const phase=phases[state.phase] ?? "headline";
                  let year=state.year;
                  let status=state.status as LiteState["status"];
                  if(state.phase==="vote" && state.pendingBudget && state.country) {
                    const choices={...state.voteChoices};
                    // Missing human votes count as abstentions. Bot votes are fixed when the vote opens.
                    const yes=Object.values(choices).filter(Boolean).length;
                    const no=Object.values(choices).filter(v=>v===false).length;
                    if(yes>no) {
                      const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[0].id,2);
                      const resolution=resolveYear(state.country,state.pendingBudget,{revenueTradeModifier:0,interestRate:0.05,crisis,needVariationSeed:yearNeedVariationSeed(state.createdAt,state.year)});
                      next={...applyYearResolution(state,resolution,state.pendingBudget,now,{passed:true,yes,no}),version:state.version+1};
                    } else if(state.failedVotes===0) {
                      // A failed first vote hands the redraft to the next seat, including bot seats.
                      const currentIndex=state.players.findIndex(p=>p.id===state.primeMinisterId);
                      const pm=state.players[(currentIndex+1+state.players.length)%state.players.length];
                      if(pm?.isBot) {
                        const draft=botDraft({...state,primeMinisterId:pm.id,failedVotes:1});
                        const budget=liteDraftToBudget(draft);
                        const choices=botVoteChoices(state);
                        next={...state,failedVotes:1,primeMinisterId:pm.id,phase:"vote",phaseStartedAt:now,phaseDeadline:now+(state.year===1?15000:10000),pendingBudget:budget,budgetDraft:draft,voteChoices:choices,votes:choices,result:{passed:false,yes,no,redraftBy:pm.id,botRedraft:true},version:state.version+1};
                      } else {
                        next={...state,failedVotes:1,primeMinisterId:pm?.id ?? null,phase:"budget",phaseStartedAt:now,phaseDeadline:now+20000,pendingBudget:null,budgetDraft:null,voteChoices:{},votes:{},result:{passed:false,yes,no,redraftBy:pm?.id},version:state.version+1};
                      }
                    } else {
                      const fallback=state.lastPassedBudget ?? fallbackEngineBudget();
                      const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[0].id,2);
                      const resolution=resolveYear(state.country,fallback,{revenueTradeModifier:0,interestRate:0.05,crisis,shutdown:true,needVariationSeed:yearNeedVariationSeed(state.createdAt,state.year)});
                      next={...applyYearResolution(state,resolution,fallback,now,{passed:false,shutdown:true,yes,no}),version:state.version+1};
                    }
                  } else if(state.phase==="budget") {
                    // A PM who misses the drafting deadline triggers the same fallback path as a failed vote.
                    const currentDraft = state.budgetDraft;
                    const usableDraft = currentDraft && validateLiteBudget(currentDraft as LiteBudgetDraft).length === 0 ? currentDraft : fallbackLiteDraft();
                    const fallback = liteDraftToBudget(usableDraft);
                    const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[0].id,2);
                    const resolution=resolveYear(state.country ?? createInitialState(),fallback,{revenueTradeModifier:0,interestRate:0.05,crisis,shutdown:true,needVariationSeed:yearNeedVariationSeed(state.createdAt,state.year)});
                    next={...applyYearResolution(state,resolution,fallback,now,{passed:false,shutdown:true,reason:"Budget deadline expired"}),version:state.version+1};
                  } else if(state.phase==="clue" && state.players.find(p=>p.id===state.primeMinisterId)?.isBot) {
                    // Bot PMs draft automatically; they must not trigger a fake missed-deadline shutdown.
                    const draft=botDraft(state);
                    const budget=liteDraftToBudget(draft);
                    const choices=botVoteChoices(state);
                    next={...state,budgetDraft:draft,pendingBudget:budget,phase:"vote",phaseStartedAt:now,phaseDeadline:now+(state.year===1?15000:10000),votes:choices,voteChoices:choices,readyByPlayer:{},version:state.version+1};
                  } else if(state.phase==="result") {
                    if(year>=3) { next={...state,phase:"guess",phaseStartedAt:now,phaseDeadline:now+30000,readyByPlayer:{},version:state.version+1}; }
                    else {
                      year++;
                      // PM rotation follows the ordered seats: all humans get their turn before bots.
                      const currentIndex=state.players.findIndex(p=>p.id===state.primeMinisterId);
                      const nextPm=state.players[(currentIndex+1+state.players.length)%state.players.length];
                      const privateByPlayer = { ...state.privateByPlayer };
                      for (const minister of state.players) {
                        const previous = privateByPlayer[minister.id];
                        if (!previous) continue;
                        const trueValue = state.country && state.crisisId ? trueClueValue(minister.ministry, state.country, state.crisisId, state.createdAt, year) : previous.trueValue;
                        privateByPlayer[minister.id] = { ...previous, trueValue };
                      }
                      next={...state,year,privateByPlayer,primeMinisterId:nextPm?.id ?? state.players[0]?.id ?? null,phase:"headline",phaseStartedAt:now,phaseDeadline:now+4000,readyByPlayer:{},budgetDraft:null,votes:{},voteChoices:{},pendingBudget:null,failedVotes:0,version:state.version+1};
                    }
                  } else if(state.phase==="guess") {
                    status="finished";
                    const humans=state.players.filter(p=>!p.isBot);
                    const mole=state.players.find(p=>p.isMole);
                    const correct=humans.filter(p=>state.guesses[p.id]===mole?.id).length;
                    const incorrect=humans.length-correct;
                    next={...state,status,phase:"finished",phaseStartedAt:now,phaseDeadline:null,result:{outcome:incorrect>correct?"Mole wins":"Cabinet wins",moleName:mole?.name,correctGuesses:correct,incorrectGuesses:incorrect,guesses:state.guesses},version:state.version+1};
                  } else {
                    const duration=phase==="clue"?(year===1?60000:30000):phase==="budget"?(year===1?40000:30000):phase==="vote"?(year===1?15000:10000):phase==="result"?(year===1?15000:10000):30000;
                    next={...state,phase,phaseStartedAt:now,phaseDeadline:now+duration,readyByPlayer:{},version:state.version+1};
                  }
            }
          return {state:next,status:next.status,changed:true};
        });
        return jsonResponse({state:publicState(saved.state),status:saved.status});
      } catch(e) {
        const message = e instanceof Error ? e.message : "Could not advance game phase.";
        console.error("Automatic phase transition failed; preserving current game state:", message);
        const { data: current, error: reloadError } = await db.from("game_rooms").select("game_state,status").eq("id", room.id).maybeSingle();
        if (reloadError) console.error("Could not reload state after failed automatic transition:", reloadError.message);
        const currentState = current?.game_state as LiteState | null;
        return jsonResponse({ state: currentState ? publicState(currentState) : state ? publicState(state) : null, status: current?.status ?? room.status, transitionError: message }, 200);
      }
    }
    if(body.action==="publish-clue") {
      const payload=body.payload as Record<string,unknown>|undefined;
      if(!payload || !Number.isInteger(payload.value)) return jsonResponse({error:"Enter a whole-number clue."},400);
      try {
        const saved=await mutateGameState(db,room.id,(latest,roomStatus)=>{
          if(!latest || latest.status!=="playing" || roomStatus!=="playing" || latest.phase!=="clue") throw new Error("Clues can only be published during the clue phase.");
          const secret=latest.privateByPlayer[player.id];
          if(!secret) throw new Error("Your private clue is unavailable.");
          if(latest.publishedClues.some(c=>c.playerId===player.id && c.year===latest.year)) throw new Error("You have already published your clue this year.");
          const value=Number(payload.value), min=secret.ministry==="Finance"?60:0, max=secret.ministry==="Finance"?140:60;
          if(value<min || value>max) throw new Error(`Your clue must be between ${min} and ${max}.`);
          const publishedClues=[...latest.publishedClues,{playerId:player.id,name:player.player_name,ministry:secret.ministry,value,trueValue:secret.trueValue,year:latest.year,at:Date.now()}];
          return {state:{...latest,publishedClues}};
        });
        const published=saved.state.publishedClues.find(c=>c.playerId===player.id&&c.year===saved.state.year);
        if(!published) throw new Error("Published clue was not saved.");
        const message={id:player.id+":"+published.year+":"+published.at,playerId:player.id,name:player.player_name,text:`${published.ministry}: ${published.ministry==="Finance"?"revenue is":"need is"} ${published.value}`,at:published.at,kind:"clue"};
        try { const sent=await db.channel("cabinet-chat:"+room.id).send({type:"broadcast",event:"chat-message",payload:message}); if(sent==="error") throw new Error("Could not broadcast clue."); }
        catch(e) { console.error("Clue chat broadcast failed:",e); }
        await broadcastBotMoment(db, room.id, saved.state, "clue");
        return jsonResponse({state:publicState(saved.state),message});
      } catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not publish clue."},409); }
    }
    if(body.action==="budget-preview") {
      const payload=body.payload as Record<string,unknown>|undefined;
      const lines=["health","education","security","environment","economy"];
      if(!payload || lines.some(k=>!Number.isInteger(payload[k]) || Number(payload[k])<0 || Number(payload[k])>10) || lines.reduce((sum,k)=>sum+Number(payload[k]??0),0)>10 || ![0,10,20].includes(Number(payload.borrowing))) return jsonResponse({error:"Invalid budget preview."},400);
      if(!state || state.phase!=="budget" || state.primeMinisterId!==player.id) return jsonResponse({error:"Only the PM can preview a budget during the budget phase."},409);
      try { const sent=await db.channel("cabinet-chat:"+room.id).send({type:"broadcast",event:"budget-preview",payload}); if(sent==="error") throw new Error("Could not broadcast budget preview."); return jsonResponse({ok:true}); }
      catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not send budget preview."},500); }
    }
    if(body.action==="private") {
      if(!state)return jsonResponse({private:null});
      return jsonResponse({private:state.privateByPlayer?.[player.id]?{...state.privateByPlayer[player.id],playerId:player.id}:null});
    }
    if(body.action==="ready") {
      try {
        const saved = await mutateGameState(db, room.id, (latest, roomStatus) => {
          if (!latest || latest.status !== "playing" || roomStatus !== "playing") throw new Error("The game has not started.");
          if (latest.readyByPlayer[player.id]) return { state: latest, changed: false };
          const readyByPlayer = { ...latest.readyByPlayer, [player.id]: true };
          const humans = latest.players.filter(p => !p.isBot);
          const everyoneReady = humans.length > 0 && humans.every(p => readyByPlayer[p.id]);
          const minimumMs: Record<string, number> = { headline:4000, clue:15000, budget:0, vote:0, result:0, guess:0 };
          const canSkip = everyoneReady && Date.now()-latest.phaseStartedAt >= (minimumMs[latest.phase] ?? 0) && latest.phaseDeadline !== null;
          return { state: { ...latest, readyByPlayer, phaseDeadline: canSkip ? Date.now() : latest.phaseDeadline } };
        });
        return jsonResponse({ state: publicState(saved.state) });
      } catch (e) { return jsonResponse({ error:e instanceof Error?e.message:"Could not save ready status." }, 409); }
    }
    if(body.action==="budget") {
      const payload = body.payload as Record<string, unknown> | undefined;
      if (!payload || typeof payload !== "object") return jsonResponse({error:"Budget payload is required."},400);
      const lines = ["health","education","security","environment","economy"];
      if (lines.some(k=>!Number.isInteger(payload[k]) || Number(payload[k])<0 || Number(payload[k])>10) || lines.reduce((sum,k)=>sum+Number(payload[k]??0),0)!==10 || ![0,10,20].includes(Number(payload.borrowing))) return jsonResponse({error:"Allocate exactly ten whole coins and choose borrowing 0, 10 or 20."},400);
      const draft: Record<string,number> = {health:Number(payload.health),education:Number(payload.education),security:Number(payload.security),environment:Number(payload.environment),economy:Number(payload.economy),borrowing:Number(payload.borrowing)};
      try {
        const saved = await mutateGameState(db, room.id, (latest, roomStatus) => {
          if (!latest || latest.status!=="playing" || roomStatus!=="playing") throw new Error("The game has not started.");
          if (latest.phase!=="budget") throw new Error("Budget drafts are only accepted during the budget phase.");
          if (latest.primeMinisterId!==player.id) throw new Error("Only the current Prime Minister can submit the budget.");
          const budget = liteDraftToBudget(draft), choices = botVoteChoices(latest);
          return {state:{...latest,budgetDraft:draft,pendingBudget:budget,phase:"vote",phaseStartedAt:Date.now(),phaseDeadline:Date.now()+(latest.year===1?15000:10000),votes:choices,voteChoices:choices,readyByPlayer:{}}};
        });
        await broadcastBotMoment(db, room.id, saved.state, "budget");
        return jsonResponse({state:publicState(saved.state)});
      } catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not submit budget."},409); }
    }
    if(body.action==="vote") {
      const payload = body.payload as Record<string,unknown>|undefined;
      if (typeof payload?.yes!=="boolean") return jsonResponse({error:"Choose yes or no."},400);
      try {
        const saved = await mutateGameState(db, room.id, (latest, roomStatus) => {
          if (!latest || latest.status!=="playing" || roomStatus!=="playing" || latest.phase!=="vote" || !latest.pendingBudget || !latest.country) throw new Error("There is no active budget vote.");
          if (latest.voteChoices[player.id]!==undefined) throw new Error("You have already voted.");
          const choices={...latest.voteChoices,[player.id]:payload.yes}, humans=latest.players.filter(p=>!p.isBot), allVoted=humans.every(p=>choices[p.id]!==undefined), now=Date.now();
          let next: LiteState={...latest,voteChoices:choices,votes:choices};
          if (allVoted || (latest.phaseDeadline!==null && now>=latest.phaseDeadline)) {
            const yes=Object.values(choices).filter(Boolean).length, no=Object.values(choices).filter(v=>!v).length;
            if (yes>no) {
              const resolution=resolveYear(latest.country,latest.pendingBudget,{revenueTradeModifier:0,interestRate:0.05,crisis:makeCrisis(latest.crisisId??CRISIS_TEMPLATES[0].id,2),needVariationSeed:yearNeedVariationSeed(latest.createdAt,latest.year)});
              next={...applyYearResolution(next,resolution,latest.pendingBudget,now,{passed:true,yes,no})};
            } else if (latest.failedVotes===0) {
              const ix=latest.players.findIndex(p=>p.id===latest.primeMinisterId), pm=latest.players[(ix+1+latest.players.length)%latest.players.length];
              if(pm?.isBot){const draft=botDraft({...latest,primeMinisterId:pm.id,failedVotes:1}), budget=liteDraftToBudget(draft), botChoices=botVoteChoices(latest);next={...next,failedVotes:1,primeMinisterId:pm.id,phase:"vote",phaseStartedAt:now,phaseDeadline:now+(latest.year===1?15000:10000),pendingBudget:budget,budgetDraft:draft,voteChoices:botChoices,votes:botChoices,result:{passed:false,yes,no,redraftBy:pm.id,botRedraft:true}};}
              else next={...next,failedVotes:1,primeMinisterId:pm?.id??null,phase:"budget",phaseStartedAt:now,phaseDeadline:now+20000,pendingBudget:null,budgetDraft:null,voteChoices:{},votes:{},result:{passed:false,yes,no,redraftBy:pm?.id}};
            } else {
              const fallback=latest.lastPassedBudget ?? fallbackEngineBudget();
              const resolution=resolveYear(latest.country,fallback,{revenueTradeModifier:0,interestRate:0.05,crisis:makeCrisis(latest.crisisId??CRISIS_TEMPLATES[0].id,2),shutdown:true,needVariationSeed:yearNeedVariationSeed(latest.createdAt,latest.year)});
              next={...applyYearResolution(next,resolution,fallback,now,{passed:false,shutdown:true,yes,no})};
            }
          }
          return {state:next,status:next.status};
        });
        if (saved.state.phase !== "vote" || saved.state.result) await broadcastBotMoment(db, room.id, saved.state, saved.state.phase === "result" ? "result" : "vote");
        return jsonResponse({state:publicState(saved.state)});
      } catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not save vote."},409); }
    }
    if(body.action==="guess") {
      const payload=body.payload as Record<string,unknown>|undefined;
      if(typeof payload?.playerId!=="string")return jsonResponse({error:"Choose a player to accuse."},400);
      try {
        const saved=await mutateGameState(db,room.id,(latest,roomStatus)=>{
          if(!latest||latest.status!=="playing"||roomStatus!=="playing"||latest.phase!=="guess")throw new Error("Mole guesses are only open at the end of Year 3.");
          const target=latest.players.find(p=>p.id===payload.playerId);if(!target)throw new Error("Choose a cabinet minister.");
          if(latest.guesses[player.id])throw new Error("You have already guessed.");
          const guesses={...latest.guesses,[player.id]:target.id},humans=latest.players.filter(p=>!p.isBot),allGuessed=humans.every(p=>guesses[p.id]),now=Date.now();
          let next:LiteState={...latest,guesses};
          if(allGuessed||(latest.phaseDeadline!==null&&now>=latest.phaseDeadline)){const mole=latest.players.find(p=>p.isMole),correct=humans.filter(p=>guesses[p.id]===mole?.id).length,incorrect=humans.length-correct;next={...next,status:"finished",phase:"finished",phaseDeadline:null,result:{outcome:incorrect>correct?"Mole wins":"Cabinet wins",moleName:mole?.name,correctGuesses:correct,incorrectGuesses:incorrect,guesses}}; }
          return {state:next,status:next.status};
        });
        return jsonResponse({state:publicState(saved.state)});
      }catch(e){return jsonResponse({error:e instanceof Error?e.message:"Could not save Mole guess."},409);}
    }
    if(body.action==="chat") {
      const payload=body.payload as Record<string,unknown>|undefined;
      if(typeof payload?.text!=="string")return jsonResponse({error:"Message text is required."},400);
      const text=payload.text.trim();if(!text||text.length>140)return jsonResponse({error:"Messages must be 1–140 characters."},400);
      if(!state||state.status!=="playing"||room.status!=="playing")return jsonResponse({error:"The game has not started."},409);
      if(["vote","result","finished"].includes(state.phase))return jsonResponse({error:"Chat is closed during voting and results."},409);
      const message={id:crypto.randomUUID(),playerId:player.id,name:player.player_name,text,at:Date.now()};
      try {
        const channel=db.channel("cabinet-chat:"+room.id);
        const sent=await channel.send({type:"broadcast",event:"chat-message",payload:message});
        if(sent==="error")throw new Error("Could not broadcast chat message.");
        const lower=text.toLowerCase();
        const accusedMole = state.players.find(p => p.isBot && state.privateByPlayer[p.id]?.isMole && lower.includes(p.name.toLowerCase()) && /\\b(liar|mole)\\b/.test(lower));
        if (accusedMole) {
          const defences = ["I am absolutely, categorically, spectacularly not the Mole. Why would you even ask?", "The Mole? Me? This accusation is so outrageous I shall deny it twice.", "I demand an apology, a retraction, and a committee to investigate whoever said Mole.", "I am innocent. Suspiciously innocent? That is an insulting distinction."];
          await db.channel("cabinet-chat:"+room.id).send({type:"broadcast",event:"chat-message",payload:{id:crypto.randomUUID(),playerId:accusedMole.id,name:accusedMole.name,text:defences[crypto.getRandomValues(new Uint32Array(1))[0]%defences.length],at:Date.now()+700}});
        }
        const reacts=/\b(lie|liar|trust)\b/.test(lower)||/\b(8[0-9]|9[0-9]|1[0-4][0-9])\b/.test(text), busy=lower.includes("!")||lower.includes("order")||text.length>110;
        if(reacts&&state.backbenchers?.length){
          const pick=state.backbenchers[crypto.getRandomValues(new Uint32Array(1))[0]%state.backbenchers.length];
          const lines:Record<string,string[]>={"Sir Nodsalot":["Zzz… wait, someone said liar? Aye. Probably.","I was asleep for that number. It sounded suspicious."],"Baroness Slowclap":["👏 A 👏 deeply 👏 convincing 👏 claim.","How brave. A number with absolutely no supporting evidence."],"Sir Reginald Filibuster":["Before we call anyone a liar, a brief history of inaccurate figures…","I shall respond in three volumes. This is volume one."],"The Hon. Member for Shouting":["OUTRAGEOUS! THAT NUMBER IS LOUDLY WRONG!","LIAR? I DEMAND A LOUDER LIAR!"],"Minister Low-Battery":["sorry was that a lie or a group chat","one sec… checking if trust is on this app"],"The Paper-Tearer":["*tears up the claim*","This claim has been rejected by the paper shredder."],"Sir Point-of-Order":["POINT OF ORDER: define “trust” before proceeding.","Your accusation lacks a properly numbered appendix."],"Lord Ribbon-Cutter":["I propose a ribbon-cutting ceremony for this enormous number.","Imagine the headline. Imagine the scissors."]};
          const options=lines[pick.name]??["I have concerns about this claim. Very theatrical concerns."], reply={id:crypto.randomUUID(),playerId:pick.id,name:pick.name,text:options[crypto.getRandomValues(new Uint32Array(1))[0]%options.length],at:Date.now()};
          await channel.send({type:"broadcast",event:"chat-message",payload:reply});
        }
        if(busy) await channel.send({type:"broadcast",event:"chat-message",payload:{id:crypto.randomUUID(),playerId:"speaker-thunderbottom",name:"Speaker Thunderbottom",text:"ORDER! The House will stop shouting over its own shouting!",at:Date.now()}});
        return jsonResponse({message});
      } catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not send message."},500); }
    }
    return jsonResponse({error:"Unknown action."},400);
  }),
};