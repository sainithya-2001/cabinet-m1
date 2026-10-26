
import { useEffect, useState } from 'react';
import {
  createRoom,
  joinRoom,
  getRoomPlayers,
  type RoomPlayer,
  startGame, getGameState, getPrivateGameInfo, markReady, sendRoomChat, submitLiteBudget, castBudgetVote, submitMoleGuess,
  type PublicGameState, type PrivateGameInfo,
} from './room-service.js';
type RoomInfo = {
  roomCode: string;
  roomId: string;
  playerToken: string;
};

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
const [players, setPlayers] = useState<RoomPlayer[]>([]);
const [gameState, setGameState] = useState<PublicGameState | null>(null);
const [privateInfo, setPrivateInfo] = useState<PrivateGameInfo | null>(null);
const [chatText, setChatText] = useState('');
const [budgetDraft, setBudgetDraft] = useState({health:2,education:2,security:2,environment:2,economy:2,borrowing:0 as 0|10|20});


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
    if (!room) { setGameState(null); setPrivateInfo(null); return; }
    let active = true;
    async function refreshGame() {
      try {
        const [g, p] = await Promise.all([getGameState(room!.roomId, room!.playerToken), getPrivateGameInfo(room!.roomId, room!.playerToken)]);
        if (active) { setGameState(g.state); setPrivateInfo(p.private); }
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
    try { const r = await startGame(room.roomId, room.playerToken); setGameState(r.state); setPrivateInfo(r.private); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not start game.'); }
    finally { setLoading(false); }
  }
  async function handleReady() {
    if (!room) return;
    try { const r = await markReady(room.roomId, room.playerToken); setGameState(r.state); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not mark ready.'); }
  }
  async function handleSendChat() {
    if (!room) return;
    try { const r = await sendRoomChat(room.roomId, room.playerToken, chatText); setGameState(r.state); setChatText(''); }
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
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <span className="brand-icon">C</span>
          CABINET
        </div>
        <span className="topbar-label">THE POLITICAL STRATEGY GAME</span>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="status-dot" />
          DEMOCRACY IS A TEAM SPORT
        </div>

        <h1>
          Every decision
          <br />
          <span>has a consequence.</span>
        </h1>

        <p className="hero-copy">
          Lead a government, negotiate with rivals, and keep your country
          standing. Your choices shape the story.
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
            placeholder="What should Parliament call you?"
            maxLength={30}
          />

          <button
            className="primary-button"
            onClick={handleCreateRoom}
            disabled={loading}
          >
            {loading ? 'Please wait…' : 'Create a game'} <span>→</span>
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

          {message && (
            <p className="helper-text" role="status">
              {message}
            </p>
          )}

          {room && (
            <div className="room-details">
              <p>Your room code</p>
              <h2>{room.roomCode}</h2>
              <button
                className="secondary-button"
                onClick={() => {
                  void navigator.clipboard.writeText(room.roomCode);
                  setMessage('Room code copied! Share it with another player.');
                }}
              >
                Copy room code
              </button>

{!gameState && <button className="primary-button" onClick={handleStartGame} disabled={loading}>{loading ? 'Starting…' : 'Start game'}</button>}
{gameState && <section className="live-game" aria-live="polite">
  <span className="section-kicker">YEAR {gameState.year} OF 3</span><h2>{gameState.phase.toUpperCase()}</h2>
  <p>Game status: {gameState.status}</p>
  {privateInfo && <div className="private-role"><h3>Your private role</h3><p>Ministry: <strong>{privateInfo.ministry}</strong></p><p>Secret: <strong>{privateInfo.isMole ? 'Mole' : 'Cabinet member'}</strong></p><p>{privateInfo.clue}</p></div>}
  {gameState.phase === 'guess' && <div className="mole-guess"><h3>Who is the Mole?</h3><p>Choose the player you suspect. Your guess is final.</p>{gameState.players.filter(p=>!p.isBot).map(p=><button key={p.id} className="secondary-button" onClick={()=>handleGuess(p.id)}>{p.name}</button>)}</div>}
  {gameState.phase === 'finished' && <div className="game-result"><h3>Game over</h3><pre>{JSON.stringify(gameState.result,null,2)}</pre></div>}
  {gameState.phase === 'budget' && <div className="lite-budget">
    <h3>Draft the ten-coin budget</h3>
    {(['health','education','security','environment','economy'] as const).map(line => <label key={line} style={{display:'flex',justifyContent:'space-between',gap:12,margin:'8px 0',textTransform:'capitalize'}}>{line}<select value={budgetDraft[line]} onChange={e=>setBudgetDraft(d=>({...d,[line]:Number(e.target.value)}))}>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n} coin{n===1?'':'s'}</option>)}</select></label>)}
    <p>Coins allocated: {budgetDraft.health+budgetDraft.education+budgetDraft.security+budgetDraft.environment+budgetDraft.economy} / 10</p>
    <label>Borrowing <select value={budgetDraft.borrowing} onChange={e=>setBudgetDraft(d=>({...d,borrowing:Number(e.target.value) as 0|10|20}))}><option value={0}>0</option><option value={10}>10</option><option value={20}>20</option></select></label>
    <button className="primary-button" onClick={handleSubmitBudget} disabled={budgetDraft.health+budgetDraft.education+budgetDraft.security+budgetDraft.environment+budgetDraft.economy!==10}>Submit budget</button>
  </div>}
  {gameState.phase === 'vote' && <div><h3>Vote on the budget</h3><button className="primary-button" onClick={()=>handleVote(true)}>Approve</button> <button className="secondary-button" onClick={()=>handleVote(false)}>Reject</button><p>Votes cast: {Object.keys(gameState.votes).length}</p></div>}
  <h3>Cabinet seats</h3><ul>{gameState.players.map(p => <li key={p.id}>{p.name}{p.isBot ? ' · AI' : ''} — {p.ministry}</li>)}</ul>
  <button className="secondary-button" onClick={handleReady}>Ready</button>
  <h3>Cabinet chat</h3><ul>{gameState.chat.map(m => <li key={m.at + m.playerId}><strong>{m.name}:</strong> {m.text}</li>)}</ul>
  {!['vote','result','finished'].includes(gameState.phase) && <div className="join-row"><input value={chatText} maxLength={140} onChange={e=>setChatText(e.target.value)} placeholder="Message (140 characters max)"/><button className="secondary-button" onClick={handleSendChat} disabled={!chatText.trim()}>Send</button></div>}
</section>}
<div className="room-players">
  <h3>Players in this room ({players.length})</h3>
  <ul>
    {players.map((player) => (
      <li key={`${player.player_name}-${player.joined_at}`}>
        {player.player_name}
        {player.player_name === playerName.trim() ? ' (you)' : ''}
      </li>
    ))}
  </ul>
</div>
            </div>
          )}

          <p className="helper-text">
            Gather your allies. Challenge your opponents. Try not to collapse
            the economy.
          </p>
        </div>

        <div className="feature-row">
          <div>
            <span className="feature-icon">♙</span>
            <span>PLAY TOGETHER</span>
          </div>
          <div>
            <span className="feature-icon">⚖</span>
            <span>MAKE HARD CHOICES</span>
          </div>
          <div>
            <span className="feature-icon">◎</span>
            <span>CHANGE THE COUNTRY</span>
          </div>
        </div>
      </section>

      <footer>
        <span>CABINET © 2026</span>
        <span>POWER IS TEMPORARY. CONSEQUENCES AREN'T.</span>
      </footer>
    </main>
  );
}
