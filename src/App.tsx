
import { useEffect, useState } from 'react';
import {
  createRoom,
  joinRoom,
  getRoomPlayers,
  type RoomPlayer,
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
