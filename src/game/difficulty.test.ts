import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../config.js';
import { difficultyAt, intensityAt } from './difficulty.js';

const PLATEAU_AT = DIFFICULTY.graceSeconds + DIFFICULTY.rampSeconds;

describe('intensityAt', () => {
  it('is zero throughout the grace period', () => {
    expect(intensityAt(0)).toBe(0);
    expect(intensityAt(DIFFICULTY.graceSeconds)).toBe(0);
  });

  it('reaches and stays at full intensity', () => {
    expect(intensityAt(PLATEAU_AT)).toBe(1);
    expect(intensityAt(PLATEAU_AT * 4)).toBe(1);
    expect(intensityAt(100000)).toBe(1);
  });

  it('is monotonically non-decreasing', () => {
    let previous = -1;
    for (let t = 0; t <= 400; t += 0.5) {
      const value = intensityAt(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('difficultyAt', () => {
  it('starts exactly at the configured start values', () => {
    const d = difficultyAt(0);
    expect(d.spawnIntervalMs).toBe(DIFFICULTY.spawnIntervalMs.start);
    expect(d.speedMin).toBe(DIFFICULTY.speedMin.start);
    expect(d.speedMax).toBe(DIFFICULTY.speedMax.start);
    expect(d.maxActive).toBe(DIFFICULTY.maxActive.start);
  });

  it('reaches the configured peak values at the plateau', () => {
    const d = difficultyAt(PLATEAU_AT);
    expect(d.spawnIntervalMs).toBeCloseTo(DIFFICULTY.spawnIntervalMs.peak, 6);
    expect(d.maxActive).toBe(DIFFICULTY.maxActive.peak);
  });

  // The original ramped without any bound and became unplayable in ~30s.
  it('never exceeds the absolute speed cap, even after an hour', () => {
    for (const t of [0, 60, 300, 900, 3600, 100000]) {
      const d = difficultyAt(t);
      expect(d.speedMin).toBeLessThanOrEqual(DIFFICULTY.absoluteMaxSpeed);
      expect(d.speedMax).toBeLessThanOrEqual(DIFFICULTY.absoluteMaxSpeed);
    }
  });

  it('keeps every parameter finite and sanely ordered at all times', () => {
    for (let t = 0; t <= 900; t += 1) {
      const d = difficultyAt(t);
      expect(Number.isFinite(d.spawnIntervalMs)).toBe(true);
      expect(d.spawnIntervalMs).toBeGreaterThan(0);
      expect(d.speedMin).toBeLessThanOrEqual(d.speedMax);
      expect(d.radiusMin).toBeLessThanOrEqual(d.radiusMax);
      expect(d.radiusMin).toBeGreaterThan(0);
      expect(d.maxActive).toBeGreaterThan(0);
      expect(d.powerUpChance).toBeGreaterThanOrEqual(0);
      expect(d.powerUpChance).toBeLessThanOrEqual(1);
    }
  });

  it('spawn interval falls monotonically and speed rises monotonically', () => {
    let previousInterval = Infinity;
    let previousSpeed = -Infinity;
    for (let t = 0; t <= PLATEAU_AT; t += 0.5) {
      const d = difficultyAt(t);
      expect(d.spawnIntervalMs).toBeLessThanOrEqual(previousInterval + 1e-9);
      expect(d.speedMax).toBeGreaterThanOrEqual(previousSpeed - 1e-9);
      previousInterval = d.spawnIntervalMs;
      previousSpeed = d.speedMax;
    }
  });

  it('spawn interval is flat after the plateau', () => {
    expect(difficultyAt(PLATEAU_AT + 100).spawnIntervalMs).toBeCloseTo(
      difficultyAt(PLATEAU_AT).spawnIntervalMs,
      6,
    );
  });
});
