import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameStateGuard, GAME_PHASES } from './GameStateGuard.tsx';

describe('game screen phase rendering', () => {
  it.each(GAME_PHASES)('renders visible game content for phase %s', (phase) => {
    const markup = renderToStaticMarkup(
      <GameStateGuard status={phase === 'finished' ? 'finished' : 'playing'} phase={phase} onReload={() => {}}>
        <main className="live-game"><h2>Visible phase: {phase}</h2></main>
      </GameStateGuard>,
    );
    expect(markup).toContain('live-game');
    expect(markup).toContain(`Visible phase: ${phase}`);
  });

  it.each([
    ['mystery-status', 'clue'],
    ['playing', 'mystery-phase'],
  ])('shows a visible recovery message for unknown state %s/%s', (status, phase) => {
    const markup = renderToStaticMarkup(
      <GameStateGuard status={status} phase={phase} onReload={() => {}}>
        <main className="live-game">This should not be shown</main>
      </GameStateGuard>,
    );
    expect(markup).toContain(`Unknown game state: ${status}/${phase}`);
    expect(markup).toContain('Reload');
    expect(markup).not.toContain('This should not be shown');
  });
});
