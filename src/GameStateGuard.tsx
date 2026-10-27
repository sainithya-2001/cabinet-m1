import type { ReactNode } from 'react';

export const GAME_PHASES = ['headline', 'clue', 'budget', 'vote', 'result', 'guess', 'finished'] as const;
export const GAME_STATUSES = ['playing', 'finished'] as const;

type Props = {
  status: string;
  phase: string;
  onReload: () => void;
  children: ReactNode;
};

export function GameStateGuard({ status, phase, onReload, children }: Props) {
  if (!(GAME_STATUSES as readonly string[]).includes(status) || !(GAME_PHASES as readonly string[]).includes(phase)) {
    return <section className="game-state-error" role="alert">
      <h2>Unknown game state: {status}/{phase}</h2>
      <p>The game received a state it cannot display.</p>
      <button className="primary-button" onClick={onReload}>Reload</button>
    </section>;
  }
  return <>{children}</>;
}
