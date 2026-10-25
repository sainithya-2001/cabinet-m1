
import { useState } from 'react';

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

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
            maxLength={24}
          />

          <button
            className="primary-button"
            onClick={() =>
              alert(
                `Welcome${playerName.trim() ? `, ${playerName.trim()}` : ''}! Multiplayer setup is coming next.`,
              )
            }
          >
            Create a game <span>→</span>
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
              placeholder="e.g. CAB-482"
              maxLength={12}
            />
            <button
              className="secondary-button"
              onClick={() => alert('Room joining will be enabled when multiplayer is connected.')}
            >
              Join →
            </button>
          </div>

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
