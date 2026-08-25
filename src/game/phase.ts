/**
 * The game's formal states.
 *
 * The original tracked three overlapping booleans (`isGameRunning`,
 * `isGamePaused`, `isAnimationPaused`) that could disagree with each other.
 * One explicit union plus a pure transition function removes that class of bug.
 */
export type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameOver';

export type GameEvent =
  | { type: 'START' }
  | { type: 'COUNTDOWN_ELAPSED' }
  | { type: 'TOGGLE_PAUSE' }
  /** Also emitted when the tab is hidden or the window loses focus. */
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'DIE' }
  | { type: 'RESTART' }
  | { type: 'TO_MENU' };

/**
 * Pure transition. Any (phase, event) pair that is not meaningful returns the
 * phase unchanged rather than throwing, so a stray keypress can never break a
 * run.
 */
export function reduce(phase: Phase, event: GameEvent): Phase {
  switch (event.type) {
    case 'START':
      return phase === 'menu' || phase === 'gameOver' ? 'countdown' : phase;
    case 'COUNTDOWN_ELAPSED':
      return phase === 'countdown' ? 'playing' : phase;
    case 'TOGGLE_PAUSE':
      if (phase === 'playing' || phase === 'countdown') return 'paused';
      if (phase === 'paused') return 'playing';
      return phase;
    case 'PAUSE':
      return phase === 'playing' || phase === 'countdown' ? 'paused' : phase;
    case 'RESUME':
      return phase === 'paused' ? 'playing' : phase;
    case 'DIE':
      return phase === 'playing' ? 'gameOver' : phase;
    case 'RESTART':
      return phase === 'gameOver' || phase === 'paused' ? 'countdown' : phase;
    case 'TO_MENU':
      return phase === 'gameOver' || phase === 'paused' ? 'menu' : phase;
  }
}

/** Whether the simulation should advance in this phase. */
export function isSimulating(phase: Phase): boolean {
  return phase === 'playing' || phase === 'countdown';
}

/** Whether the player may steer in this phase. */
export function acceptsSteering(phase: Phase): boolean {
  return phase === 'playing' || phase === 'countdown';
}
