import { describe, expect, it } from 'vitest';
import { SCORING } from '../config.js';
import { applyDodge, comboMultiplier, createScoreState, expireCombo, tickScore } from './scoring.js';

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
  it('awards the base value for an ordinary dodge and does not build combo', () => {
    const state = createScoreState();
    const awarded = applyDodge(state, 0, false);
    expect(awarded).toBe(SCORING.pointsPerDodge);
    expect(state.combo).toBe(0);
    expect(state.dodges).toBe(1);
  });

  it('awards the near-miss bonus and builds combo', () => {
    const state = createScoreState();
    const awarded = applyDodge(state, 0, true);
    expect(state.combo).toBe(1);
    expect(awarded).toBe(
      Math.round((SCORING.pointsPerDodge + SCORING.nearMissBonus) * comboMultiplier(1)),
    );
  });

  it('escalates while near misses keep landing inside the window', () => {
    const state = createScoreState();
    let now = 0;
    const awards: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      awards.push(applyDodge(state, now, true));
      now += SCORING.comboWindowMs / 2;
    }
    expect(state.combo).toBe(5);
    for (let i = 1; i < awards.length; i += 1) {
      expect(awards[i]!).toBeGreaterThan(awards[i - 1]!);
    }
  });

  it('lets the combo lapse once the window passes', () => {
    const state = createScoreState();
    applyDodge(state, 0, true);
    expect(state.combo).toBe(1);
    expireCombo(state, SCORING.comboWindowMs + 1);
    expect(state.combo).toBe(0);
  });
});
