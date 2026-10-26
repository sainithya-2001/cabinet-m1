import './cabinet-lite.css';

import { useEffect, useMemo, useState } from 'react';
import { projectYear } from './engine/economy.ts';
import { makeCrisis } from './engine/crises.ts';
import { sectorNeeds } from './engine/economy.ts';
import { toEngineBudget, type LiteBudgetDraft } from './engine/lite-budget.ts';
import type { CountryState, Indicator } from './engine/types.ts';
import {
  createRoom,
  joinRoom,
  getRoomPlayers,
  type RoomPlayer,
  startGame, getGameState, getPrivateGameInfo, markReady, sendRoomChat, submitLiteBudget, castBudgetVote, submitMoleGuess,
  type PublicGameState, type PrivateGameInfo, type RoomChatMessage, subscribeRoomChat, publishMyClue, subscribeBudgetPreview, sendBudgetPreview,
} from './room-service.ts';
type ResultResolutionView = { changes: Record<Indicator, { before: number; after: number; lines: Array<{ cause: string; rounded: number }> }>; state: Record<Indicator, number>; spending: Record<string, number>; effectiveBudget: { shares: Record<string, number>; borrowing: number }; interest: number; revenue: number };
type RoomInfo = {
  roomCode: string;
  roomId: string;
  playerToken: string;
};

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '');
const soloMode = new URLSearchParams(window.location.search).get('solo') === '1';
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
const [players, setPlayers] = useState<RoomPlayer[]>([]);
const [gameState, setGameState] = useState<PublicGameState | null>(null);
const [privateInfo, setPrivateInfo] = useState<PrivateGameInfo | null>(null);
const [chatText, setChatText] = useState('');
const [clueDraft, setClueDraft] = useState<number | null>(null);
const [budgetPreview, setBudgetPreview] = useState<PublicGameState['budgetDraft']>(null);
const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
const [budgetDraft, setBudgetDraft] = useState({health:2,education:2,security:2,environment:2,economy:2,borrowing:0 as 0|10|20});
const [showRules, setShowRules] = useState(false);
const [clockNow, setClockNow] = useState(Date.now());
useEffect(() => {
  const id = window.setInterval(() => setClockNow(Date.now()), 500);
  return () => window.clearInterval(id);
}, []);
const phaseCopy: Record<string, {title:string; instruction:string; order:string}> = {
  headline: { title: 'The Speaker has the floor', instruction: 'Read the crisis bulletin. Your cabinet must act fast.', order: 'The House will hear the crisis bulletin!' },
  clue: { title: 'Trade clues and accusations', instruction: 'Read your private report, share what you know in chat, and challenge suspicious claims.', order: 'The cabinet will now trade clues!' },
  budget: { title: 'The Prime Minister must allocate 10 coins', instruction: 'The PM drafts the budget. Everyone else: make your demands known.', order: 'Ten coins. Five ministries. No excuses!' },
  vote: { title: 'The cabinet must decide', instruction: 'Vote yes to pass this budget, or no to reject it.', order: 'The vote is OPEN!' },
  result: { title: 'The consequences are in', instruction: 'Review what your budget did to Veloria before the next year.', order: 'The numbers have spoken. Unfortunately.' },
  guess: { title: 'Unmask the Mole', instruction: 'Choose the minister you suspect. Your accusation is final.', order: 'Name the Mole, and make it quick!' },
  finished: { title: 'The Veloria Times', instruction: 'Read the final verdict and see who spotted the liar.', order: 'The House demands a reckoning!' },
};
const secondsLeft = gameState?.phaseDeadline == null ? null : Math.max(0, Math.ceil((gameState.phaseDeadline - clockNow) / 1000));
const shownBudget = privateInfo?.playerId === gameState?.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState?.budgetDraft ?? budgetDraft);
const projectedEffects = useMemo(() => {
  if (gameState?.phase !== 'budget' || !gameState.country || !gameState.crisisId) return null;
  try {
    const engineBudget = toEngineBudget({
      health: Number(shownBudget.health), education: Number(shownBudget.education),
      security: Number(shownBudget.security), environment: Number(shownBudget.environment),
      economy: Number(shownBudget.economy), borrowing: Number(shownBudget.borrowing) as 0 | 10 | 20,
    } as LiteBudgetDraft);
    const range = projectYear(gameState.country as CountryState, engineBudget, {
      revenueMin: 60, revenueMax: 140,
      baseInputs: { revenueTradeModifier: 0, interestRate: 0.05 },
      crisisForSeverity: severity => makeCrisis(gameState.crisisId!, severity),
    });
    const indicators: Indicator[] = ['economy', 'happiness', 'stability', 'environment', 'debt'];
    return Object.fromEntries(indicators.map(indicator => [
      indicator,
      { min: Math.round(range.min[indicator] - gameState.country![indicator]), max: Math.round(range.max[indicator] - gameState.country![indicator]) },
    ])) as Record<Indicator, { min: number; max: number }>;
  } catch { return null; }
}, [gameState?.phase, gameState?.year, gameState?.country, gameState?.crisisId, shownBudget.health, shownBudget.education, shownBudget.security, shownBudget.environment, shownBudget.economy, shownBudget.borrowing]);
useEffect(() => { if (gameState?.phase !== 'budget') setBudgetPreview(gameState?.budgetDraft ?? null); }, [gameState?.phase, gameState?.year]);


  useEffect(() => {
    if (!room) {
      setPlayers([]);
      return;
    }

    let active = true;

    async function refreshPlayers() {
      try {
        const currentPlayers = await getRoomPlayers(
          room!.roomId,
          room!.playerToken,
        );

        if (active) {
          setPlayers(currentPlayers);
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not refresh the player list.',
          );
        }
      }
    }

    void refreshPlayers();

    const intervalId = window.setInterval(() => {
      void refreshPlayers();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [room]);


  useEffect(() => {
    setChatMessages([]);
    if (!room) return;
    const unsubscribeChat = subscribeRoomChat(room.roomId, message => {
      setChatMessages(current => current.some(item => item.id === message.id) ? current : [...current, message].slice(-100));
    });
    const unsubscribeBudget = subscribeBudgetPreview(room.roomId, draft => setBudgetPreview(draft));
    return () => { unsubscribeChat(); unsubscribeBudget(); };
  }, [room]);

  useEffect(() => {
    if (!room) { setGameState(null); setPrivateInfo(null); return; }
    let active = true;
    async function refreshGame() {
      try {
        const [g, p] = await Promise.all([getGameState(room!.roomId, room!.playerToken), getPrivateGameInfo(room!.roomId, room!.playerToken)]);
        if (active) { setGameState(g.state); setPrivateInfo(p.private); if (g.state?.budgetDraft) setBudgetPreview(g.state.budgetDraft); if (p.private && clueDraft === null) setClueDraft(p.private.trueValue); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Could not refresh game state.'); }
    }
    void refreshGame();
    const id = window.setInterval(() => { void refreshGame(); }, 2000);
    return () => { active = false; window.clearInterval(id); };
  }, [room]);

  async function handleGuess(playerId: string) {
    if (!room) return;
    try { const r = await submitMoleGuess(room.roomId, room.playerToken, playerId); setGameState(r.state); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not submit guess.'); }
  }

  async function handleSubmitBudget() {
    if (!room) return;
    try { const r = await submitLiteBudget(room.roomId, room.playerToken, budgetDraft); setGameState(r.state); setMessage('Budget submitted for a vote.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not submit budget.'); }
  }
  async function handleVote(yes: boolean) {
    if (!room) return;
    try { const r = await castBudgetVote(room.roomId, room.playerToken, yes); setGameState(r.state); setMessage('Vote recorded.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not record vote.'); }
  }

  async function handleStartGame() {
    if (!room) return; setLoading(true); setMessage('');
    try { const r = await startGame(room.roomId, room.playerToken, soloMode); setGameState(r.state); setPrivateInfo(r.private); setClueDraft(r.private.trueValue); setBudgetPreview(r.state.budgetDraft); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not start game.'); }
    finally { setLoading(false); }
  }
  async function handleReady() {
    if (!room) return;
    try { const r = await markReady(room.roomId, room.playerToken); setGameState(r.state); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not mark ready.'); }
  }
  async function handlePublishClue() {
    if (!room || clueDraft === null) return;
    try {
      const r = await publishMyClue(room.roomId, room.playerToken, clueDraft);
      setGameState(r.state);
      setClueDraft(null);
      if (r.message) setChatMessages(current => current.some(item => item.id === r.message.id) ? current : [...current, r.message].slice(-100));
      setMessage('Clue published to cabinet chat.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not publish clue.'); }
  }
  async function handleBudgetDraftChange(next: typeof budgetDraft | ((current: typeof budgetDraft) => typeof budgetDraft)) {
    const resolved = typeof next === 'function' ? next(budgetDraft) : next;
    setBudgetDraft(resolved);
    if (room && gameState?.phase === 'budget' && privateInfo?.playerId === gameState.primeMinisterId) {
      void sendBudgetPreview(room.roomId, room.playerToken, resolved).catch(() => undefined);
    }
  }
  async function handleSendChat() {
    if (!room) return;
    try { const r = await sendRoomChat(room.roomId, room.playerToken, chatText); setChatMessages(current => current.some(item => item.id === r.message.id) ? current : [...current, r.message].slice(-100)); setChatText(''); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not send message.'); }
  }

  async function handleCreateRoom() {
    if (!playerName.trim()) {
      setMessage('Enter your player name first.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const created = await createRoom(playerName.trim());
      const result = { ...created };
      setRoom(result);
      setRoomCode(result.roomCode);
      setMessage(`Room ${result.roomCode} created! Invite another player to join.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the room.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    if (!playerName.trim()) {
      setMessage('Enter your player name first.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const joined = await joinRoom(roomCode, playerName);
      setRoom(joined);
      setMessage(`You joined room ${joined.roomCode}!`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join the room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`app-shell${gameState ? " in-game" : ""}`}>
      <nav className="topbar">
        <div className="brand">
          <span className="brand-icon">C</span>
          CABINET
        </div>
        <div className="topbar-tools">{gameState && room && <span className="room-code-chip">ROOM {room.roomCode}</span>}<span className="topbar-label">THE POLITICAL STRATEGY GAME</span><button className="rules-trigger" onClick={() => setShowRules(true)} aria-label="How to play">? How to play</button></div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="status-dot" />
          DEMOCRACY IS A TEAM SPORT
        </div>

        <h1>
          Run the country.
          <br />
          <span>Find the liar.</span>
        </h1>

        <p className="hero-copy">
          A satirical cabinet crisis game. Make the numbers add up. Decide who is telling the truth.
        </p>

        <div className="game-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">YOUR NEXT MOVE</span>
              <h2>Enter the Cabinet</h2>
            </div>
            <span className="panel-symbol">♜</span>
          </div>

          <label htmlFor="playerName">YOUR PLAYER NAME</label>
          <input
            id="playerName"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Enter your name"
            maxLength={30}
          />

          <button
            className="primary-button"
            onClick={handleCreateRoom}
            disabled={loading}
          >
            {loading ? 'Please wait…' : 'Play now'} <span>→</span>
          </button>

          <div className="join-divider">
            <span />
            OR JOIN AN EXISTING GAME
            <span />
          </div>

          <label htmlFor="roomCode">ROOM CODE</label>
          <div className="join-row">
            <input
              id="roomCode"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="e.g. A7K9PQ"
              maxLength={6}
            />
            <button
              className="secondary-button"
              onClick={handleJoinRoom}
              disabled={loading}
            >
              Join →
            </button>
          </div>

          {!gameState && message && (
            <p className="helper-text" role="status">
              {message}
            </p>
          )}

          {room && (
            <div className="room-details">
              {!gameState && <><p>Your room code</p><h2>{room.roomCode}</h2><button
                className="secondary-button"
                onClick={() => {
                  const inviteUrl = new URL(window.location.href);
                  inviteUrl.searchParams.set('room', room.roomCode);
                  void navigator.clipboard.writeText(inviteUrl.toString());
                  setMessage('Invite link copied. Friends only need to enter their name.');
                }}
              >
                Copy invite link
              </button></>}

{!gameState && <button className="primary-button" onClick={handleStartGame} disabled={loading}>{loading ? 'Starting…' : 'Start game'}</button>}
{gameState && <section className="live-game" aria-live="polite">
  <div className="speaker-banner"><strong>ORDER!</strong><span>{phaseCopy[gameState.phase]?.order ?? "The House will come to order!"}</span><b>Speaker Thunderbottom</b></div><div className="phase-status"><div><span className="section-kicker">YEAR {gameState.year} OF 3 · {gameState.phase.toUpperCase()}</span><h2>{phaseCopy[gameState.phase]?.title ?? 'Cabinet in session'}</h2><p>{phaseCopy[gameState.phase]?.instruction ?? 'Follow the cabinet proceedings.'}</p></div><div className="phase-clock" aria-live="polite">{secondsLeft === null ? '—' : `${secondsLeft}s`}<span>LEFT</span></div></div>
  {gameState.crisisId && <div className="crisis-headline"><span className="section-kicker">NATIONAL HEADLINE</span><h3>{({'outbreak':'Disease outbreak','floods':'Severe flooding','border-tension':'Border tensions','recession':'Economic recession','heatwave':'Extreme heatwave','teacher-strike':'Teachers on strike','cyberattack':'National cyberattack','housing-shortage':'Housing shortage','energy-price-spike':'Energy price spike','protests':'Nationwide protests','export-boom':'Export boom','tech-breakthrough':'Technology breakthrough'} as Record<string,string>)[gameState.crisisId] ?? 'Breaking national news'}</h3></div>}
  <p><strong>Prime Minister:</strong> {gameState.players.find(p=>p.id===gameState.primeMinisterId)?.name ?? '—'}{privateInfo?.playerId===gameState.primeMinisterId ? ' (you)' : ''}</p>
  {gameState.country && <div className="country-indicators"><h3>Country indicators</h3><p>Economy {Math.round(gameState.country.economy)} · Happiness {Math.round(gameState.country.happiness)} · Stability {Math.round(gameState.country.stability)} · Environment {Math.round(gameState.country.environment)} · Debt {Math.round(gameState.country.debt)}</p></div>}
  {privateInfo && <div className="private-role classified-dossier"><h3>Your private dossier <span>CLASSIFIED</span></h3><p className="clue-report">{privateInfo.ministry === 'Finance' ? <>Treasury report: revenue is <strong>{privateInfo.trueValue}</strong>.</> : privateInfo.ministry === 'Health' ? <>Hospital report: {privateInfo.trueValue * 10} patients in corridors. Health needs <strong>{privateInfo.trueValue}</strong>.</> : privateInfo.ministry === 'Defense' ? <>Security briefing: Defense needs <strong>{privateInfo.trueValue}</strong>.</> : privateInfo.ministry === 'Education' ? <>School report: Education needs <strong>{privateInfo.trueValue}</strong>.</> : privateInfo.ministry === 'Environment' ? <>Climate report: Environment needs <strong>{privateInfo.trueValue}</strong>.</> : <>Industry report: Economy needs <strong>{privateInfo.trueValue}</strong>.</>}</p><p>Ministry: <strong>{privateInfo.ministry}</strong></p><p>Secret: <strong>{privateInfo.isMole ? 'Mole' : 'Cabinet member'}</strong></p>{gameState.phase === 'clue' && !gameState.publishedClues?.some(c => c.playerId === privateInfo.playerId && c.year === gameState.year) && <div className="publish-clue"><label htmlFor="clue-value">Publish my clue</label><input id="clue-value" type="number" min={privateInfo.ministry === 'Finance' ? 60 : 0} max={privateInfo.ministry === 'Finance' ? 140 : 60} value={clueDraft ?? privateInfo.trueValue} onChange={e=>setClueDraft(Number(e.target.value))}/><button className="secondary-button" onClick={handlePublishClue} disabled={clueDraft === null || !Number.isInteger(clueDraft)}>Publish clue</button></div>}</div>}
  {gameState.phase === 'guess' && <div className="mole-guess"><h3>Who is the Mole?</h3><p>Choose the player you suspect. Your guess is final.</p>{gameState.players.filter(p=>!p.isBot && p.id !== privateInfo?.playerId).map(p=><button key={p.id} className="secondary-button" onClick={()=>handleGuess(p.id)}>{p.name}</button>)}</div>}
  {(gameState.phase === 'result' || gameState.phase === 'finished') && (() => {
    const result = gameState.result as { passed?: boolean; shutdown?: boolean; resolution?: ResultResolutionView } | null;
    const resolution = (result?.resolution ?? gameState.yearResolution) as ResultResolutionView | null;
    if (!resolution?.changes) return gameState.phase === 'finished' ? <div className="game-result"><h3>Game over</h3><pre>{JSON.stringify(gameState.result,null,2)}</pre></div> : null;
    const indicators: Array<[Indicator, string]> = [['economy','Economy'],['happiness','Happiness'],['stability','Stability'],['environment','Environment'],['debt','Debt']];
    const allLines = indicators.flatMap(([key]) => resolution.changes[key]?.lines ?? []);
    const biggest = allLines.filter(line => line.rounded !== 0).sort((a,b) => Math.abs(b.rounded)-Math.abs(a.rounded))[0];
    const headline = result?.shutdown ? 'GOVERNMENT SHUTDOWN: THE COUNTRY PAYS THE PRICE' : biggest ? biggest.cause.toUpperCase() + ' SHAPES THIS YEAR\'S OUTCOME' : 'VELORIA HOLDS ITS BREATH';
    const crisis = gameState.crisisId ?? '';
    const budgetShares = resolution.effectiveBudget?.shares ?? {};
    const needs = sectorNeeds({ revenueTradeModifier: 0, interestRate: 0.05, crisis: makeCrisis(crisis || 'protests', 2) });
    const underfundedCrisis =
      (crisis === 'outbreak' && resolution.spending.health < needs.health) ||
      (crisis === 'floods' && resolution.spending.infrastructure < needs.infrastructure) ||
      ((crisis === 'border-tension' || crisis === 'cyberattack' || crisis === 'protests') && resolution.spending.security < needs.security) ||
      (crisis === 'teacher-strike' && resolution.spending.education < needs.education) ||
      (crisis === 'heatwave' && resolution.spending.environment < needs.environment) ||
      (crisis === 'energy-price-spike' && resolution.spending.industry < needs.industry);
    const environmentLines = resolution.changes.environment?.lines ?? [];
    const pollution = environmentLines.find(line => line.cause === 'Industry pollution');
    const otherEnvironmentDamage = environmentLines.filter(line => line.cause !== 'Industry pollution').reduce((sum,line) => sum + Math.max(0,-line.rounded),0);
    const note = result?.shutdown ? 'When governments cannot agree on a budget, services are cut while they argue.' :
      underfundedCrisis ? 'Crises cost more when the system was already stretched: preparedness matters.' :
      resolution.effectiveBudget?.borrowing > 0 ? 'Borrowing helps now, but interest takes money from future budgets.' :
      resolution.interest > 5 ? 'The interest bill is now competing with hospitals and schools.' :
      pollution && -pollution.rounded > otherEnvironmentDamage ? 'Pollution is a real cost that is not on the factory’s bill.' :
      resolution.spending.education > needs.education ? 'Education pays back, but years later, which makes it easy to cut.' :
      Object.keys(needs).some(sector => resolution.spending[sector] > needs[sector as keyof typeof needs] * 1.5) ? 'Each extra coin did less than the last: funding has diminishing returns.' :
      resolution.revenue < 90 || resolution.revenue > 110 ? 'Governments budget with forecasts, not certainties: revenue can differ from expectations.' :
      'Governments budget with forecasts, not certainties: revenue and needs can vary.';
    return <div className="game-result">
      <h3>{gameState.phase === 'finished' ? 'Game over' : 'What changed — and why'}</h3><h4 className="result-headline">{headline}</h4>
      {indicators.map(([key,label]) => {
        const change = resolution.changes[key]; const delta = change.after - change.before;
        return <section className="indicator-breakdown" key={key}>
          <h4>{label} {delta > 0 ? '+' : ''}{delta} <span>({change.before} → {change.after})</span></h4>
          <ul>{change.lines.map((line,index) => <li key={line.cause + index}>{line.cause}: {line.rounded > 0 ? '+' : ''}{line.rounded}</li>)}</ul>
          <p>Cause total: {change.lines.reduce((sum,line)=>sum+line.rounded,0)} (change: {delta})</p>
        </section>;
      })}
      <section className="real-world-note"><h4>Real world note</h4><p>{note}</p></section>
    </div>;
  })()}
  {gameState.phase === 'budget' && <div className="lite-budget">
    <h3>Draft the ten-coin budget</h3>
    {privateInfo?.playerId !== gameState.primeMinisterId && <p>Only the current Prime Minister can submit the budget.</p>}
    {(['health','education','security','environment','economy'] as const).map(line => { const pm = privateInfo?.playerId === gameState.primeMinisterId; const shown = pm ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft); const total = shown.health+shown.education+shown.security+shown.environment+shown.economy; return <div className="coin-row" key={line}><span>{line}</span><div className="coin-controls">{pm ? <><button type="button" className="coin-button" aria-label={`Remove one ${line} coin`} onClick={()=>handleBudgetDraftChange({...budgetDraft,[line]:Math.max(0,budgetDraft[line]-1)})} disabled={budgetDraft[line]===0}>−</button><strong aria-live="polite">{shown[line]}</strong><button type="button" className="coin-button" aria-label={`Add one ${line} coin`} onClick={()=>handleBudgetDraftChange(d=>{const sum=d.health+d.education+d.security+d.environment+d.economy;return sum>=10?d:{...d,[line]:d[line]+1}})} disabled={total>=10}>+</button></> : <strong aria-live="polite">{shown[line]}</strong>}</div></div>})}
    <p>Coins allocated: {(privateInfo?.playerId === gameState.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft)).health+(privateInfo?.playerId === gameState.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft)).education+(privateInfo?.playerId === gameState.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft)).security+(privateInfo?.playerId === gameState.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft)).environment+(privateInfo?.playerId === gameState.primeMinisterId ? budgetDraft : (budgetPreview ?? gameState.budgetDraft ?? budgetDraft)).economy} / 10</p>
    {privateInfo?.playerId === gameState.primeMinisterId ? <label>Borrowing <select value={budgetDraft.borrowing} onChange={e=>handleBudgetDraftChange({...budgetDraft,borrowing:Number(e.target.value) as 0|10|20})}><option value={0}>0</option><option value={10}>10</option><option value={20}>20</option></select></label> : <p>Borrowing: {(budgetPreview ?? gameState.budgetDraft ?? budgetDraft).borrowing ?? 0}</p>}
    <div className="predicted-effects"><h4>Predicted indicator effects (ranges)</h4>{projectedEffects ? Object.entries({economy:'Economy',happiness:'Happiness',stability:'Stability',environment:'Environment',debt:'Debt'} as Record<Indicator,string>).map(([key,label])=>{const range=projectedEffects[key as Indicator];return <p key={key}>{label}: {range.min>0?'+':''}{range.min} to {range.max>0?'+':''}{range.max}</p>}) : <p>Projection unavailable for this draft.</p>}<small>Engine projection across public revenue, crisis-severity and interest-rate ranges.</small></div>
    <button className="primary-button" onClick={handleSubmitBudget} disabled={privateInfo?.playerId !== gameState.primeMinisterId || budgetDraft.health+budgetDraft.education+budgetDraft.security+budgetDraft.environment+budgetDraft.economy!==10}>Submit budget</button>
  </div>}
  {gameState.phase === 'vote' && <div><h3>Vote on the budget</h3>{gameState.voteChoices?.[privateInfo?.playerId ?? ''] !== undefined ? <p>Your vote is recorded.</p> : <><button className="primary-button" onClick={()=>handleVote(true)}>Approve</button> <button className="secondary-button" onClick={()=>handleVote(false)}>Reject</button></>}<p>Votes cast: {Object.keys(gameState.votes).length}</p></div>}
  <section className="chamber-scene" aria-label="Parliament chamber"><div className="chamber-arch"><span>THE PARLIAMENT OF VELORIA</span></div><div className="speaker-throne"><div className="portrait-disc speaker-portrait">♟</div><strong>Speaker Thunderbottom</strong><small>KEEPING ORDER (ISH)</small></div>
<div className="cabinet-seats">{gameState.players.map((p,index)=><article className={"cabinet-seat seat-"+(index+1)} key={p.id}><div className={"portrait-disc "+(p.isBot?"bot-portrait":"human-portrait")} aria-hidden="true">{p.isBot?({"Sir Nodsalot":"😴","Baroness Slowclap":"👏","Sir Reginald Filibuster":"📜","The Hon. Member for Shouting":"😡","Minister Low-Battery":"📱","The Paper-Tearer":"📄","Sir Point-of-Order":"☝️","Lord Ribbon-Cutter":"✂️"} as Record<string,string>)[p.name]??"🎩":p.name.trim().slice(0,1).toUpperCase()}</div><strong className="seat-name">{p.name}</strong><span className="seat-ministry">{p.ministry}</span>{p.id===privateInfo?.playerId&&<em>You</em>}{gameState.phase==="vote"&&gameState.voteChoices?.[p.id]!==undefined&&<b className={"vote-placard "+(gameState.voteChoices[p.id]?"aye":"no")}>{gameState.voteChoices[p.id]?"AYE":"NO"}</b>}{chatMessages.filter(m=>m.playerId===p.id).slice(-1).map(m=><div className="seat-speech" key={m.id}>{m.text}</div>)}</article>)}</div>
<div className="dispatch-box"><span>PRIME MINISTER</span><strong>{gameState.players.find(p=>p.id===gameState.primeMinisterId)?.name??"Awaiting PM"}{privateInfo?.playerId===gameState.primeMinisterId?" · YOU":""}</strong></div>
{gameState.backbenchers?.length>0&&<div className="backbench-row"><span>BACK BENCHES</span>{gameState.backbenchers.map(p=><div className="backbench-person" key={p.id}><span className="backbench-avatar">{({"sir-nodsalot":"😴","baroness-slowclap":"👏","sir-reginald-fil ibuster":"📜","hon-member-for-shouting":"😡","minister-low-battery":"📱","the-paper-tearer":"📄","sir-point-of-order":"☝️","lord-ribbon-cutter":"✂️"} as Record<string,string>)[p.portrait]??"🎩"}</span><small>{p.name}</small></div>)}</div>}</section>
  <button className="secondary-button ready-button" onClick={handleReady}>Ready — move on when everyone is ready</button>
  <section className="chamber-chat"><h3>Chamber chat</h3><div className="chat-log" aria-live="polite">{chatMessages.map(m=><article className="chat-entry" key={m.id}><strong>{m.name}</strong><p>{m.kind==='clue'&&<span className="chat-clue-badge">Clue</span>}{m.text}</p></article>)}</div></section>
  {!['vote','result','finished'].includes(gameState.phase) && <div className="join-row"><input value={chatText} maxLength={140} onChange={e=>setChatText(e.target.value)} placeholder="Message (140 characters max)"/><button className="secondary-button" onClick={handleSendChat} disabled={!chatText.trim()}>Send</button></div>}
</section>}

{!gameState && <div className="room-players">
  <h3>Players in this room ({players.length})</h3>
  <ul>
    {players.map((player) => (
      <li key={`${player.player_name}-${player.joined_at}`}>
        {player.player_name}
        {player.player_name === playerName.trim() ? ' (you)' : ''}
      </li>
    ))}
  </ul>
</div>}
            </div>
          )}

          {!gameState && <p className="helper-text">
            Gather your allies. Challenge your opponents. Try not to collapse
            the economy.
          </p>}
        </div>

        {!gameState && <div className="feature-row spec-rules">
          <article><span className="feature-icon">01</span><h3>Get a secret clue.</h3><p>A crisis hits. Only you know one number, and you can tell the truth or lie.</p></article>
          <article><span className="feature-icon">02</span><h3>Argue, then vote.</h3><p>The Prime Minister splits 10 budget coins, and the cabinet votes yes or no.</p></article>
          <article><span className="feature-icon">03</span><h3>Survive and unmask.</h3><p>Keep Veloria alive for 3 years, then name the Mole.</p></article>
        </div>}
        {!gameState && <p className="refresh-note">Refreshing reconnects you.</p>}
      </section>

      {showRules && <div className="rules-backdrop" role="presentation" onClick={() => setShowRules(false)}><section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={event => event.stopPropagation()}><button className="rules-close" onClick={() => setShowRules(false)} aria-label="Close rules">×</button><span className="section-kicker">THE RULES OF VELORIA</span><h2 id="rules-title">Three steps to government</h2><ol className="rules-list"><li><strong>Get a secret clue.</strong><p>A crisis hits. Only you know one number, and you can tell the truth or lie.</p></li><li><strong>Argue, then vote.</strong><p>The Prime Minister splits 10 budget coins, and the cabinet votes yes or no.</p></li><li><strong>Survive and unmask.</strong><p>Keep Veloria alive for 3 years, then name the Mole.</p></li></ol><p className="helper-text">Refreshing reconnects you.</p></section></div>}

      <footer>
        <span>CABINET © 2026</span>
        <span>POWER IS TEMPORARY. CONSEQUENCES AREN'T.</span>
      </footer>
    </main>
  );
}
