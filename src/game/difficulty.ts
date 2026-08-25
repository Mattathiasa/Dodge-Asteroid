import { DIFFICULTY } from '../config.js';
import { clamp01, smoothstep } from '../core/math.js';

export interface DifficultyParams {
  /** 0 at the start of a run, 1 once the ramp has plateaued. */
  readonly intensity: number;
  readonly spawnIntervalMs: number;
  readonly speedMin: number;
  readonly speedMax: number;
  readonly radiusMin: number;
  readonly radiusMax: number;
  readonly driftX: number;
  readonly maxActive: number;
  readonly powerUpChance: number;
}

interface Range {
  readonly start: number;
  readonly peak: number;
}

/** Interpolates a tuning range. Works whether `peak` is above or below `start`. */
function ramp(range: Range, intensity: number): number {
  return range.start + (range.peak - range.start) * intensity;
}

/**
 * Difficulty as a function of time survived.
 *
 * The original multiplied the fall speed by a constant on every spawn with no
 * upper bound, which made the game mathematically unplayable about thirty
 * seconds in. This is a bounded `smoothstep` ramp instead: flat at the start,
 * steepest in the middle, and flat again once it tops out.
 */
export function intensityAt(elapsedSeconds: number): number {
  return smoothstep(
    clamp01((elapsedSeconds - DIFFICULTY.graceSeconds) / DIFFICULTY.rampSeconds),
  );
}

export function difficultyAt(elapsedSeconds: number): DifficultyParams {
  const intensity = intensityAt(elapsedSeconds);

  // A very slow speed drift after the plateau, so an expert run still ends.
  const overtime = Math.max(
    0,
    elapsedSeconds - DIFFICULTY.graceSeconds - DIFFICULTY.rampSeconds,
  );
  const endless = 1 + DIFFICULTY.endlessSpeedPerSecond * overtime;
  const cap = DIFFICULTY.absoluteMaxSpeed;

  return {
    intensity,
    spawnIntervalMs: ramp(DIFFICULTY.spawnIntervalMs, intensity),
    speedMin: Math.min(ramp(DIFFICULTY.speedMin, intensity) * endless, cap),
    speedMax: Math.min(ramp(DIFFICULTY.speedMax, intensity) * endless, cap),
    radiusMin: ramp(DIFFICULTY.radiusMin, intensity),
    radiusMax: ramp(DIFFICULTY.radiusMax, intensity),
    driftX: ramp(DIFFICULTY.driftX, intensity),
    maxActive: Math.round(ramp(DIFFICULTY.maxActive, intensity)),
    powerUpChance: ramp(DIFFICULTY.powerUpChance, intensity),
  };
}
