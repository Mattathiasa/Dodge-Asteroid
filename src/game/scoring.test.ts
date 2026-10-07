import { describe, expect, it } from 'vitest';
import { SCORING, SHARDS } from '../config.js';
import {
  applyDodge,
  applyNearMiss,
  applyShard,
  comboMultiplier,
  comboRemaining,
  createScoreState,
  expireCombo,
  tickScore,
} from './scoring.js';

describe('comboMultiplier', () => {
  it('starts at 1 and grows by the configured step', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBeCloseTo(1 + SCORING.comboStep, 10);
  });

  it('caps so a long run cannot inflate the score without limit', () => {
    const capped = comboMultiplier(SCORING.comboMax);
    expect(comboMultiplier(SCORING.comboMax + 50)).toBe(capped);
    expect(comboMultiplier(9999)).toBe(capped);
  });
});

describe('tickScore', () => {
  // Score is time survived, not the spawn counter the original called "Level".
  it('awards exactly the configured rate over ten seconds at 60Hz', () => {
    const state = createScoreState();
    for (let i = 0; i < 600; i += 1) tickScore(state, 1 / 60, i * (1000 / 60));
    expect(state.points).toBe(SCORING.pointsPerSecond * 10);
  });

  it('is frame-rate independent', () => {
    const at60 = createScoreState();
    for (let i = 0; i < 600; i += 1) tickScore(at60, 1 / 60, i * (1000 / 60));

    const at30 = createScoreState();
    for (let i = 0; i < 300; i += 1) tickScore(at30, 1 / 30, i * (1000 / 30));

    expect(at30.points).toBe(at60.points);
  });
});

describe('applyDodge', () => {
  it('awards the base value and does not build combo', () => {
    const state = createScoreState();
    const awarded = applyDodge(state, 0);
    expect(awarded).toBe(SCORING.pointsPerDodge);
    expect(state.combo).toBe(0);
    expect(state.dodges).toBe(1);
  });

  it('is multiplied by a live combo', () => {
    const state = createScoreState();
    applyNearMiss(state, 0);
    applyNearMiss(state, 100);
    expect(applyDodge(state, 200)).toBe(Math.round(SCORING.pointsPerDodge * comboMultiplier(2)));
  });
});

describe('applyNearMiss', () => {
  it('awards the near-miss bonus and builds combo', () => {
    const state = createScoreState();
    const awarded = applyNearMiss(state, 0);
    expect(state.combo).toBe(1);
    expect(state.nearMisses).toBe(1);
    expect(awarded).toBe(Math.round(SCORING.nearMissBonus * comboMultiplier(1)));
  });

  it('escalates while near misses keep landing inside the window', () => {
    const state = createScoreState();
    let now = 0;
    const awards: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      awards.push(applyNearMiss(state, now));
      now += SCORING.comboWindowMs / 2;
    }
    expect(state.combo).toBe(5);
    for (let i = 1; i < awards.length; i += 1) {
      expect(awards[i]!).toBeGreaterThan(awards[i - 1]!);
    }
  });

  it('lets the combo lapse once the window passes', () => {
    const state = createScoreState();
    applyNearMiss(state, 0);
    expect(state.combo).toBe(1);
    expireCombo(state, SCORING.comboWindowMs + 1);
    expect(state.combo).toBe(0);
  });

  it('remembers the best combo after the live one lapses', () => {
    const state = createScoreState();
    for (let i = 0; i < 4; i += 1) applyNearMiss(state, i * 100);
    applyNearMiss(state, 100 + SCORING.comboWindowMs * 2);
    expect(state.combo).toBe(1);
    expect(state.bestCombo).toBe(4);
    expect(state.nearMisses).toBe(5);
  });
});

describe('applyShard', () => {
  it('counts the shard and pays its value, multiplied by the combo', () => {
    const state = createScoreState();
    expect(applyShard(state, 0)).toBe(SHARDS.points);
    expect(state.shards).toBe(1);

    applyNearMiss(state, 10);
    expect(applyShard(state, 20)).toBe(Math.round(SHARDS.points * comboMultiplier(1)));
  });

  it('neither builds nor extends the combo', () => {
    const state = createScoreState();
    applyNearMiss(state, 0);
    const expiry = state.comboExpiresAt;
    applyShard(state, 100);
    expect(state.combo).toBe(1);
    expect(state.comboExpiresAt).toBe(expiry);
  });
});

describe('comboRemaining', () => {
  it('is zero with no combo, full on a fresh one, and drains with time', () => {
    const state = createScoreState();
    expect(comboRemaining(state, 0)).toBe(0);
    applyNearMiss(state, 0);
    expect(comboRemaining(state, 0)).toBe(1);
    expect(comboRemaining(state, SCORING.comboWindowMs / 2)).toBeCloseTo(0.5, 6);
    expect(comboRemaining(state, SCORING.comboWindowMs * 2)).toBe(0);
  });
});

describe('totals', () => {
  it('is always survival points plus every bonus awarded', () => {
    const state = createScoreState();
    let bonus = 0;
    for (let i = 0; i < 300; i += 1) {
      const now = i * (1000 / 60);
      tickScore(state, 1 / 60, now);
      if (i % 40 === 0) bonus += applyNearMiss(state, now);
      if (i % 25 === 0) bonus += applyShard(state, now);
      if (i % 30 === 0) bonus += applyDodge(state, now);
    }
    expect(state.points).toBe(SCORING.pointsPerSecond * 5 + bonus);
  });
});
