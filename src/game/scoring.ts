import { SCORING } from '../config.js';

export interface ScoreState {
  /** Total displayed score: survival points plus dodge bonuses. */
  points: number;
  dodges: number;
  combo: number;
  /** Simulated ms after which the combo lapses. */
  comboExpiresAt: number;
  /** Seconds survived, the basis for survival points. */
  survivalTime: number;
  /** Points awarded for dodges and near misses. */
  bonusPoints: number;
}

export function createScoreState(): ScoreState {
  return { points: 0, dodges: 0, combo: 0, comboExpiresAt: 0, survivalTime: 0, bonusPoints: 0 };
}

/** Combo multiplier, capped so a long run cannot inflate the score without limit. */
export function comboMultiplier(combo: number): number {
  const steps = Math.min(combo, SCORING.comboMax);
  return 1 + steps * SCORING.comboStep;
}

/** Expires a lapsed combo. Separated so both scoring paths can call it. */
export function expireCombo(state: ScoreState, nowMs: number): void {
  if (state.combo > 0 && nowMs >= state.comboExpiresAt) state.combo = 0;
}

/**
 * Recomputes the total from the two independent components.
 *
 * Survival points are derived from accumulated time rather than accumulated
 * *points*, so the total depends only on how long the run lasted and not on how
 * many steps it was split into. The epsilon absorbs the float drift of summing
 * a step like 1/60 several thousand times.
 */
function recomputeTotal(state: ScoreState): void {
  const survival = Math.floor(state.survivalTime * SCORING.pointsPerSecond + 1e-9);
  state.points = survival + state.bonusPoints;
}

/**
 * Awards survival points.
 *
 * The original counted asteroids *spawned* and called it "Level", so the number
 * went up whether or not the player did anything. Score here is time survived
 * plus what the player actually dodged.
 */
export function tickScore(state: ScoreState, dt: number, nowMs: number): void {
  expireCombo(state, nowMs);
  state.survivalTime += dt;
  recomputeTotal(state);
}

/** Records a dodged asteroid. Returns the points awarded. */
export function applyDodge(state: ScoreState, nowMs: number, nearMiss: boolean): number {
  expireCombo(state, nowMs);
  state.dodges += 1;

  if (nearMiss) {
    state.combo += 1;
    state.comboExpiresAt = nowMs + SCORING.comboWindowMs;
  }

  const base = SCORING.pointsPerDodge + (nearMiss ? SCORING.nearMissBonus : 0);
  const awarded = Math.round(base * comboMultiplier(state.combo));
  state.bonusPoints += awarded;
  recomputeTotal(state);
  return awarded;
}
