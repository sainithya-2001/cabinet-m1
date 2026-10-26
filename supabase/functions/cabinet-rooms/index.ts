import { createInitialState, resolveYear } from "../../../src/engine/economy.ts";
import { makeCrisis, CRISIS_TEMPLATES } from "../../../src/engine/crises.ts";
import type { Budget, CountryState, YearInputs } from "../../../src/engine/types.ts";
import { withSupabase } from "@supabase/server";

type RequestBody = {
  action?: unknown; roomCode?: unknown; playerName?: unknown; roomId?: unknown;
  playerToken?: unknown; ready?: unknown; phaseAction?: unknown; payload?: unknown;
};
type Db = any;
type PlayerRow = { id: string; player_name: string; joined_at: string; player_token_hash: string };
type GamePlayer = { id: string; name: string; seat: number; isBot: boolean; ministry: string; isMole: boolean; ready: boolean };
type LiteState = {
  version: number; status: "waiting" | "playing" | "finished"; createdAt: number;
  phase: string; phaseStartedAt: number; phaseDeadline: number | null; year: number;
  players: GamePlayer[]; privateByPlayer: Record<string, { ministry: string; isMole: boolean; clue: string }>;
  readyByPlayer: Record<string, boolean>; chat: Array<{playerId:string;name:string;text:string;at:number}>;
  budgetDraft: Record<string, number> | null; votes: Record<string, boolean>; result: unknown;
  lastActionAt: Record<string, number>;
  country: CountryState | null;
  lastPassedBudget: Budget | null;
  failedVotes: 0 | 1;
  pendingBudget: Budget | null;
  voteChoices: Record<string, boolean>;
  crisisId: string | null;
  yearResolution: unknown;
  primeMinisterId: string | null;
  guesses: Record<string, string>;
  botPlan: Record<string, unknown>;
};
function jsonResponse(body: Record<string, unknown>, status = 200): Response { return Response.json(body, { status }); }
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
function publicState(state: LiteState) {
  const { privateByPlayer: _private, readyByPlayer: _ready, lastActionAt: _rateLimit, ...visible } = state;
  return { ...visible, players: visible.players.map(({ isMole: _mole, ...player }) => player) };
}
async function findPlayer(db: Db, roomId: string, token: string) {
  const tokenHash = await hashToken(token);
  const { data: player, error } = await db.from("game_players").select("id,player_name,joined_at,player_token_hash").eq("room_id", roomId).eq("player_token_hash", tokenHash).maybeSingle();
  if (error) throw new Error("Could not verify player access.");
  if (!player) throw new Error("Invalid player token.");
  return player as PlayerRow;
}
function initialLiteState(players: PlayerRow[]): LiteState {
  if (players.length < 2 || players.length > 6) throw new Error("Cabinet Lite requires 2–6 human players to start.");
  const seatRows = shuffle(players.map((p) => ({ row: p, isBot: false })));
  const botNames = ["Ada", "Boris", "Cleo", "Dmitri", "Elsie", "Felix"];
  while (seatRows.length < 5) seatRows.push({ row: { id: "bot-" + (seatRows.length + 1), player_name: botNames[seatRows.length] ?? "Bot", joined_at: new Date().toISOString(), player_token_hash: "" }, isBot: true });
  const ministries = shuffle(["Finance", "Health", "Defense", "Education", "Environment", "Economy", "Infrastructure", "Intelligence"]).slice(0, seatRows.length);
  const moleIndex = crypto.getRandomValues(new Uint32Array(1))[0] % seatRows.length;
  const humanCount = players.length;
  const gamePlayers: GamePlayer[] = seatRows.map((item, seat) => ({
    id: item.row.id, name: item.row.player_name, seat, isBot: item.isBot,
    ministry: ministries[seat], isMole: seat === moleIndex, ready: false,
  }));
  const privateByPlayer: LiteState["privateByPlayer"] = {};
  for (const player of gamePlayers) privateByPlayer[player.id] = {
    ministry: player.ministry, isMole: player.isMole,
    clue: player.isMole ? "You are the Mole. Secretly undermine the government without revealing yourself." : makePrivateClue(player.ministry),
  };
  // The first human is PM first; bots only rotate in after every human has had a turn.
  const humans = gamePlayers.filter((p) => !p.isBot);
  const bots = gamePlayers.filter((p) => p.isBot);
  const first = crypto.getRandomValues(new Uint32Array(1))[0] % humans.length;
  const ordered = [...humans.slice(first), ...humans.slice(0, first), ...bots].map((p, seat) => ({...p, seat}));
  return {
    version: 1, status: "playing", createdAt: Date.now(), phase: "headline",
    phaseStartedAt: Date.now(), phaseDeadline: Date.now() + 4000, year: 1,
    players: ordered, privateByPlayer, readyByPlayer: {}, chat: [],
    budgetDraft: null, votes: {}, result: null, lastActionAt: {},
    country: createInitialState(), lastPassedBudget: null, failedVotes: 0,
    pendingBudget: null, voteChoices: {}, crisisId: CRISIS_TEMPLATES[crypto.getRandomValues(new Uint32Array(1))[0] % CRISIS_TEMPLATES.length].id, yearResolution: null,
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
        const { data: room, error } = await db.from("game_rooms").insert({room_code: roomCode,host_name: playerName,host_token_hash: tokenHash,game_state: {},status:"waiting"}).select("id").single();
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
      if(room.status!=="waiting")return jsonResponse({error:"This game has already started."},409);
      const {data:rows,error}=await db.from("game_players").select("id,player_name,joined_at,player_token_hash").eq("room_id",room.id).order("joined_at",{ascending:true});
      if(error)return jsonResponse({error:"Could not load players."},500);
      try {
        const next=initialLiteState((rows??[]) as PlayerRow[]);
        const {error:updateError}=await db.from("game_rooms").update({game_state:next,status:"playing"}).eq("id",room.id).eq("status","waiting");
        if(updateError)return jsonResponse({error:"Could not start game."},500);
        return jsonResponse({state:publicState(next),private:{...next.privateByPlayer[player.id],playerId:player.id}});
      } catch(e) { return jsonResponse({error:e instanceof Error?e.message:"Could not start game."},400); }
    }
    if(body.action==="state") {
      if(!state)return jsonResponse({state:null,status:room.status});
      const now=Date.now();
      let next=state;
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
            const resolution=resolveYear(state.country,state.pendingBudget,{revenueTradeModifier:0,interestRate:0.05,crisis});
            next={...state,country:resolution.state,lastPassedBudget:state.pendingBudget,failedVotes:0,yearResolution:resolution,phase:"result",phaseStartedAt:now,phaseDeadline:resolution.state.collapsed?null:now+(state.year===1?15000:10000),status:resolution.state.collapsed?"finished":"playing",result:{passed:true,yes,no,resolution},pendingBudget:null,voteChoices:{},votes:{},budgetDraft:null,version:state.version+1};
          } else if(state.failedVotes===0) {
            const humans=state.players.filter(p=>!p.isBot);
            const pm=humans.find(p=>p.id===state.primeMinisterId) ?? humans[0];
            next={...state,failedVotes:1,primeMinisterId:pm?.id ?? null,phase:"budget",phaseStartedAt:now,phaseDeadline:now+20000,pendingBudget:null,budgetDraft:null,voteChoices:{},votes:{},result:{passed:false,yes,no,redraftBy:pm?.id},version:state.version+1};
          } else {
            const fallback=state.lastPassedBudget ?? {shares:{health:20,education:14,security:14,infrastructure:16,environment:10,industry:14,debtRepayment:12},borrowing:0};
            const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[0].id,2);
            const resolution=resolveYear(state.country,fallback,{revenueTradeModifier:0,interestRate:0.05,crisis,shutdown:true});
            next={...state,country:resolution.state,lastPassedBudget:fallback,yearResolution:resolution,phase:"result",phaseStartedAt:now,phaseDeadline:resolution.state.collapsed?null:now+(state.year===1?15000:10000),status:resolution.state.collapsed?"finished":"playing",result:{passed:false,shutdown:true,yes,no,resolution},pendingBudget:null,failedVotes:0,voteChoices:{},votes:{},budgetDraft:null,version:state.version+1};
          }
        } else if(state.phase==="budget") {
          // A PM who misses the drafting deadline triggers the same fallback path as a failed vote.
          const fallback=state.lastPassedBudget ?? {shares:{health:20,education:14,security:14,infrastructure:16,environment:10,industry:14,debtRepayment:12},borrowing:0};
          const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[0].id,2);
          const resolution=resolveYear(state.country ?? createInitialState(),fallback,{revenueTradeModifier:0,interestRate:0.05,crisis,shutdown:true});
          next={...state,country:resolution.state,lastPassedBudget:fallback,yearResolution:resolution,phase:"result",phaseStartedAt:now,phaseDeadline:resolution.state.collapsed?null:now+(state.year===1?15000:10000),status:resolution.state.collapsed?"finished":"playing",result:{passed:false,shutdown:true,reason:"Budget deadline expired",resolution},pendingBudget:null,failedVotes:0,voteChoices:{},votes:{},budgetDraft:null,version:state.version+1};
        } else if(state.phase==="result") {
          if(year>=3) { next={...state,phase:"guess",phaseStartedAt:now,phaseDeadline:now+30000,readyByPlayer:{},version:state.version+1}; }
          else {
            year++;
            const humans=state.players.filter(p=>!p.isBot);
            const currentIndex=humans.findIndex(p=>p.id===state.primeMinisterId);
            const nextPm=humans[(currentIndex+1+humans.length)%humans.length];
            next={...state,year,primeMinisterId:nextPm?.id ?? humans[0]?.id ?? null,phase:"headline",phaseStartedAt:now,phaseDeadline:now+4000,readyByPlayer:{},budgetDraft:null,votes:{},voteChoices:{},pendingBudget:null,failedVotes:0,version:state.version+1};
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
        const {error:updateError}=await db.from("game_rooms").update({game_state:next,status:next.status}).eq("id",room.id).eq("status","playing");
        if(updateError)return jsonResponse({error:"Could not advance game phase."},500);
      }
      return jsonResponse({state:publicState(next),status:next.status});
    }
    if(body.action==="private") {
      if(!state)return jsonResponse({private:null});
      return jsonResponse({private:state.privateByPlayer?.[player.id]?{...state.privateByPlayer[player.id],playerId:player.id}:null});
    }
    if(body.action==="ready") {
      if(!state||state.status!=="playing")return jsonResponse({error:"The game has not started."},409);
      const readyByPlayer={...state.readyByPlayer,[player.id]:true};
      const next={...state,readyByPlayer,version:state.version+1};
      const {error}=await db.from("game_rooms").update({game_state:next}).eq("id",room.id).eq("status","playing");
      if(error)return jsonResponse({error:"Could not save ready status."},500);
      return jsonResponse({state:publicState(next)});
    }
    if(body.action==="budget") {
      if(!state || state.status!=="playing") return jsonResponse({error:"The game has not started."},409);
      if(state.phase!=="budget") return jsonResponse({error:"Budget drafts are only accepted during the budget phase."},409);
      if(state.primeMinisterId !== player.id) return jsonResponse({error:"Only the current Prime Minister can submit the budget."},403);
      if(!state.players.filter(p=>!p.isBot).length) return jsonResponse({error:"No human ministers found."},409);
      const payload=body.payload as Record<string,unknown>|undefined;
      if(!payload || typeof payload!=="object") return jsonResponse({error:"Budget payload is required."},400);
      const draft=payload as Record<string,unknown>;
      const lines=["health","education","security","environment","economy"];
      if(lines.some(k=>!Number.isInteger(draft[k]) || Number(draft[k])<0 || Number(draft[k])>10) || lines.reduce((sum,k)=>sum+Number(draft[k]??0),0)!==10 || ![0,10,20].includes(Number(draft.borrowing))) return jsonResponse({error:"Allocate exactly ten whole coins and choose borrowing 0, 10 or 20."},400);
      const shares={health:Number(draft.health)*10,education:Number(draft.education)*10,security:Number(draft.security)*10,environment:Number(draft.environment)*10,infrastructure:Number(draft.economy)*5,industry:Number(draft.economy)*5,debtRepayment:0};
      const budget:Budget={shares,borrowing:Number(draft.borrowing)};
      const botChoices:Record<string,boolean>={};
      for (const bot of state.players.filter(p=>p.isBot)) {
        // Precompute each bot's vote when the phase opens; no vote changes during the phase.
        botChoices[bot.id]=crypto.getRandomValues(new Uint32Array(1))[0] % 100 < (bot.isMole ? 35 : 70);
      }
      const next={...state,budgetDraft:draft,pendingBudget:budget,phase:"vote",phaseStartedAt:Date.now(),phaseDeadline:Date.now()+(state.year===1?15000:10000),votes:botChoices,voteChoices:botChoices,readyByPlayer:{},version:state.version+1};
      const {error}=await db.from("game_rooms").update({game_state:next}).eq("id",room.id).eq("status","playing");
      if(error)return jsonResponse({error:"Could not submit budget."},500);
      return jsonResponse({state:publicState(next)});
    }
    if(body.action==="vote") {
      if(!state || state.status!=="playing" || state.phase!=="vote" || !state.pendingBudget || !state.country) return jsonResponse({error:"There is no active budget vote."},409);
      const payload=body.payload as Record<string,unknown>|undefined;
      if(typeof payload?.yes!=="boolean")return jsonResponse({error:"Choose yes or no."},400);
      if(state.voteChoices[player.id]!==undefined)return jsonResponse({error:"You have already voted."},409);
      const voteChoices={...state.voteChoices,[player.id]:payload.yes};
      const humans=state.players.filter(p=>!p.isBot);
      const allVoted=humans.every(p=>voteChoices[p.id]!==undefined);
      const now=Date.now();
      let next={...state,voteChoices,votes:voteChoices,version:state.version+1};
      if(allVoted || (state.phaseDeadline!==null && now>=state.phaseDeadline)) {
        const yes=Object.values(voteChoices).filter(Boolean).length;
        const no=Object.values(voteChoices).filter(v=>!v).length;
        if(yes>no) {
          const crisisId=state.crisisId ?? CRISIS_TEMPLATES[crypto.getRandomValues(new Uint32Array(1))[0] % CRISIS_TEMPLATES.length].id;
          const crisis=makeCrisis(crisisId,2);
          const inputs:YearInputs={revenueTradeModifier:0,interestRate:0.05,crisis};
          const resolution=resolveYear(state.country,state.pendingBudget,inputs);
          next={...next,country:resolution.state,lastPassedBudget:state.pendingBudget,failedVotes:0,yearResolution:resolution,phase:"result",phaseStartedAt:now,phaseDeadline:now+(state.year===1?15000:10000),result:{passed:true,yes,no,resolution},pendingBudget:null,voteChoices:{},votes:{},budgetDraft:null,version:next.version+1};
          if(resolution.state.collapsed)next={...next,status:"finished",phase:"finished",phaseDeadline:null};
        } else if(state.failedVotes===0) {
          const pm=state.players.find(p=>p.id===state.players.filter(x=>!x.isBot)[(state.year)%humans.length]?.id) ?? humans[0];
          next={...next,failedVotes:1,phase:"budget",phaseStartedAt:now,phaseDeadline:now+20000,pendingBudget:null,budgetDraft:null,voteChoices:{},votes:{},result:{passed:false,yes,no,redraftBy:pm?.id},version:next.version+1};
        } else {
          const fallback=state.lastPassedBudget ?? {shares:{health:20,education:14,security:14,infrastructure:16,environment:10,industry:14,debtRepayment:12},borrowing:0};
          const crisis=makeCrisis(state.crisisId ?? CRISIS_TEMPLATES[crypto.getRandomValues(new Uint32Array(1))[0] % CRISIS_TEMPLATES.length].id,2);
          const resolution=resolveYear(state.country,fallback,{revenueTradeModifier:0,interestRate:0.05,crisis,shutdown:true});
          next={...next,country:resolution.state,lastPassedBudget:fallback,yearResolution:resolution,phase:"result",phaseStartedAt:now,phaseDeadline:now+(state.year===1?15000:10000),result:{passed:false,shutdown:true,yes,no,resolution},pendingBudget:null,failedVotes:0,voteChoices:{},votes:{},budgetDraft:null,version:next.version+1};
          if(resolution.state.collapsed)next={...next,status:"finished",phase:"finished",phaseDeadline:null};
        }
      }
      const {error}=await db.from("game_rooms").update({game_state:next,status:next.status}).eq("id",room.id);
      if(error)return jsonResponse({error:"Could not save vote."},500);
      return jsonResponse({state:publicState(next)});
    }
    if(body.action==="guess") {
      if(!state || state.status!=="playing" || state.phase!=="guess") return jsonResponse({error:"Mole guesses are only open at the end of Year 3."},409);
      const payload=body.payload as Record<string,unknown>|undefined;
      if(typeof payload?.playerId!=="string")return jsonResponse({error:"Choose a player to accuse."},400);
      const target=state.players.find(p=>p.id===payload.playerId && !p.isBot);
      if(!target)return jsonResponse({error:"Choose a human player."},400);
      if(state.guesses[player.id])return jsonResponse({error:"You have already guessed."},409);
      const guesses={...state.guesses,[player.id]:target.id};
      const humans=state.players.filter(p=>!p.isBot);
      const allGuessed=humans.every(p=>guesses[p.id]);
      const now=Date.now();
      let next={...state,guesses,version:state.version+1};
      if(allGuessed || (state.phaseDeadline!==null && now>=state.phaseDeadline)) {
        const mole=state.players.find(p=>p.isMole);
        const correct=humans.filter(p=>guesses[p.id]===mole?.id).length;
        const incorrect=humans.length-correct;
        const moleWins=!!mole && incorrect>correct;
        next={...next,status:"finished",phase:"finished",phaseDeadline:null,result:{outcome:moleWins?"Mole wins":"Cabinet wins",moleName:mole?.name,correctGuesses:correct,incorrectGuesses:incorrect,guesses},version:next.version+1};
      }
      const {error}=await db.from("game_rooms").update({game_state:next,status:next.status}).eq("id",room.id);
      if(error)return jsonResponse({error:"Could not save Mole guess."},500);
      return jsonResponse({state:publicState(next)});
    }
    if(body.action==="chat") {
      if(!state||state.status!=="playing")return jsonResponse({error:"The game has not started."},409);
      if(["vote","result","finished"].includes(state.phase))return jsonResponse({error:"Chat is closed during voting and results."},409);
      if(typeof body.payload!=="object"||body.payload===null||typeof (body.payload as Record<string,unknown>).text!=="string")return jsonResponse({error:"Message text is required."},400);
      const text=((body.payload as Record<string,string>).text).trim();
      if(!text||text.length>140)return jsonResponse({error:"Messages must be 1–140 characters."},400);
      const now=Date.now(),last=state.lastActionAt[player.id]??0;
      if(now-last<1000)return jsonResponse({error:"Please wait before sending another message."},429);
      const chat=[...state.chat,{playerId:player.id,name:player.player_name,text,at:now}].slice(-100);
      const next={...state,chat,lastActionAt:{...state.lastActionAt,[player.id]:now},version:state.version+1};
      const {error}=await db.from("game_rooms").update({game_state:next}).eq("id",room.id);
      if(error)return jsonResponse({error:"Could not send message."},500);
      return jsonResponse({state:publicState(next)});
    }
    return jsonResponse({error:"Unknown action."},400);
  }),
};
