import { SCORING, SHARDS } from '../config.js';

export interface ScoreState {
  /** Total displayed score: survival points plus bonuses. */
  points: number;
  dodges: number;
  combo: number;
  /** Simulated ms after which the combo lapses. */
  comboExpiresAt: number;
  /** Seconds survived, the basis for survival points. */
  survivalTime: number;
  /** Points awarded for dodges, near misses and shards. */
  bonusPoints: number;
  /** Near misses this run, for the run summary. */
  nearMisses: number;
  /** Highest combo reached this run. */
  bestCombo: number;
  /** Star shards collected this run. */
  shards: number;
}

export function createScoreState(): ScoreState {
  return {
    points: 0,
    dodges: 0,
    combo: 0,
    comboExpiresAt: 0,
    survivalTime: 0,
    bonusPoints: 0,
    nearMisses: 0,
    bestCombo: 0,
    shards: 0,
  };
}

/** Combo multiplier, capped so a long run cannot inflate the score without limit. */
export function comboMultiplier(combo: number): number {
  const steps = Math.min(combo, SCORING.comboMax);
  return 1 + steps * SCORING.comboStep;
}

/** Expires a lapsed combo. Separated so every scoring path can call it. */
export function expireCombo(state: ScoreState, nowMs: number): void {
  if (state.combo > 0 && nowMs >= state.comboExpiresAt) state.combo = 0;
}

/** Fraction of the combo window still remaining, 0 when there is no combo. */
export function comboRemaining(state: ScoreState, nowMs: number): number {
  if (state.combo === 0) return 0;
  return Math.max(0, Math.min(1, (state.comboExpiresAt - nowMs) / SCORING.comboWindowMs));
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

function award(state: ScoreState, base: number): number {
  const awarded = Math.round(base * comboMultiplier(state.combo));
  state.bonusPoints += awarded;
  recomputeTotal(state);
  return awarded;
}

/**
 * Awards survival points.
 *
 * The original counted asteroids *spawned* and called it "Level", so the number
 * went up whether or not the player did anything. Score here is time survived
 * plus what the player actually did.
 */
export function tickScore(state: ScoreState, dt: number, nowMs: number): void {
  expireCombo(state, nowMs);
  state.survivalTime += dt;
  recomputeTotal(state);
}

/** Records an asteroid that left the field without touching the ship. */
export function applyDodge(state: ScoreState, nowMs: number): number {
  expireCombo(state, nowMs);
  state.dodges += 1;
  return award(state, SCORING.pointsPerDodge);
}

/**
 * Records a near miss, the moment the rock clears the ship.
 *
 * This is awarded when the rock leaves the near-miss margin, not when it leaves
 * the screen. Paying out a second later, at the bottom edge, disconnects the
 * reward from the thing the player did to earn it.
 */
export function applyNearMiss(state: ScoreState, nowMs: number): number {
  expireCombo(state, nowMs);
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.nearMisses += 1;
  state.comboExpiresAt = nowMs + SCORING.comboWindowMs;
  return award(state, SCORING.nearMissBonus);
}

/** Records a collected shard. The combo multiplies it but is not extended by it. */
export function applyShard(state: ScoreState, nowMs: number): number {
  expireCombo(state, nowMs);
  state.shards += 1;
  return award(state, SHARDS.points);
}
