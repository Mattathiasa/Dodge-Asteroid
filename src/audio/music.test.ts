import { describe, expect, it } from 'vitest';
import type { MusicMode, MusicVoice } from './music.js';
import { LAYER_AT, notesForStep, tempoFor } from './music.js';
import { streakPitch } from './audio.js';

/** Every voice that sounds anywhere in four bars. */
function voicesIn(mode: MusicMode, intensity: number): Set<MusicVoice> {
  const voices = new Set<MusicVoice>();
  for (let step = 0; step < 64; step += 1) {
    for (const note of notesForStep(step, mode, intensity)) voices.add(note.voice);
  }
  return voices;
}

describe('notesForStep', () => {
  it('is silent when off', () => {
    for (let step = 0; step < 64; step += 1) {
      expect(notesForStep(step, 'off', 1)).toEqual([]);
    }
  });

  it('keeps the menu bed to pads and a soft bass', () => {
    expect([...voicesIn('calm', 1)].sort()).toEqual(['bass', 'pad']);
  });

  it('adds layers one at a time as the run intensifies', () => {
    expect(voicesIn('run', 0).has('kick')).toBe(false);
    expect(voicesIn('run', LAYER_AT.kick).has('kick')).toBe(true);
    expect(voicesIn('run', LAYER_AT.hat - 0.01).has('hat')).toBe(false);
    expect(voicesIn('run', LAYER_AT.hat).has('hat')).toBe(true);
    expect(voicesIn('run', LAYER_AT.lead - 0.01).has('lead')).toBe(false);
    expect(voicesIn('run', LAYER_AT.lead).has('lead')).toBe(true);
  });

  it('never gets thinner as intensity rises', () => {
    let previous = 0;
    for (let intensity = 0; intensity <= 1; intensity += 0.05) {
      let count = 0;
      for (let step = 0; step < 64; step += 1) count += notesForStep(step, 'run', intensity).length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('only ever produces playable values', () => {
    for (const mode of ['calm', 'run'] as const) {
      for (let step = 0; step < 128; step += 1) {
        for (const note of notesForStep(step, mode, 1)) {
          expect(Number.isFinite(note.freq)).toBe(true);
          expect(note.freq).toBeGreaterThanOrEqual(0);
          expect(note.freq).toBeLessThan(4000);
          expect(note.steps).toBeGreaterThan(0);
          expect(note.gain).toBeGreaterThan(0);
          expect(note.gain).toBeLessThanOrEqual(0.35);
        }
      }
    }
  });

  it('loops every four bars', () => {
    for (let step = 0; step < 64; step += 1) {
      expect(notesForStep(step + 64, 'run', 0.8)).toEqual(notesForStep(step, 'run', 0.8));
    }
  });
});

describe('tempoFor', () => {
  it('tightens with intensity and stays in a sane range', () => {
    expect(tempoFor(1)).toBeGreaterThan(tempoFor(0));
    expect(tempoFor(-5)).toBe(tempoFor(0));
    expect(tempoFor(9)).toBe(tempoFor(1));
    expect(tempoFor(0)).toBeGreaterThan(80);
    expect(tempoFor(1)).toBeLessThan(160);
  });
});

describe('streakPitch', () => {
  it('climbs with each step of a streak and then holds', () => {
    expect(streakPitch(1)).toBe(1);
    for (let step = 2; step <= 11; step += 1) {
      expect(streakPitch(step)).toBeGreaterThan(streakPitch(step - 1));
    }
    expect(streakPitch(50)).toBe(streakPitch(11));
  });

  it('treats nonsense as the root', () => {
    expect(streakPitch(0)).toBe(1);
    expect(streakPitch(-4)).toBe(1);
  });
});
