import { describe, expect, it } from 'vitest';
import type { GameEvent, Phase } from './phase.js';
import { acceptsSteering, isSimulating, reduce } from './phase.js';

describe('reduce', () => {
  const cases: ReadonlyArray<[Phase, GameEvent, Phase]> = [
    ['menu', { type: 'START' }, 'countdown'],
    ['gameOver', { type: 'START' }, 'countdown'],
    ['countdown', { type: 'COUNTDOWN_ELAPSED' }, 'playing'],
    ['playing', { type: 'TOGGLE_PAUSE' }, 'paused'],
    ['paused', { type: 'TOGGLE_PAUSE' }, 'playing'],
    ['countdown', { type: 'TOGGLE_PAUSE' }, 'paused'],
    ['playing', { type: 'PAUSE' }, 'paused'],
    ['paused', { type: 'RESUME' }, 'playing'],
    ['playing', { type: 'DIE' }, 'dying'],
    ['dying', { type: 'DEATH_ELAPSED' }, 'gameOver'],
    ['gameOver', { type: 'RESTART' }, 'countdown'],
    ['paused', { type: 'RESTART' }, 'countdown'],
    ['gameOver', { type: 'TO_MENU' }, 'menu'],
    ['paused', { type: 'TO_MENU' }, 'menu'],
  ];

  it.each(cases)('%s + %o -> %s', (from, event, expected) => {
    expect(reduce(from, event)).toBe(expected);
  });

  // A stray keypress in the wrong phase must never corrupt a run.
  const noOps: ReadonlyArray<[Phase, GameEvent]> = [
    ['menu', { type: 'DIE' }],
    ['menu', { type: 'PAUSE' }],
    ['menu', { type: 'TOGGLE_PAUSE' }],
    ['menu', { type: 'RESTART' }],
    ['gameOver', { type: 'DIE' }],
    ['gameOver', { type: 'TOGGLE_PAUSE' }],
    ['playing', { type: 'START' }],
    ['playing', { type: 'RESUME' }],
    ['playing', { type: 'COUNTDOWN_ELAPSED' }],
    ['paused', { type: 'DIE' }],
    ['countdown', { type: 'DIE' }],
    ['playing', { type: 'DEATH_ELAPSED' }],
    // Once the ship is gone there is nothing to pause, restart or abandon:
    // the explosion plays out and the run-over screen follows.
    ['dying', { type: 'PAUSE' }],
    ['dying', { type: 'TOGGLE_PAUSE' }],
    ['dying', { type: 'RESTART' }],
    ['dying', { type: 'TO_MENU' }],
    ['dying', { type: 'DIE' }],
  ];

  it.each(noOps)('%s is unchanged by %o', (from, event) => {
    expect(reduce(from, event)).toBe(from);
  });
});

describe('phase predicates', () => {
  it('simulates only while counting down, playing or dying', () => {
    expect(isSimulating('playing')).toBe(true);
    expect(isSimulating('countdown')).toBe(true);
    expect(isSimulating('dying')).toBe(true);
    expect(isSimulating('menu')).toBe(false);
    expect(isSimulating('paused')).toBe(false);
    expect(isSimulating('gameOver')).toBe(false);
  });

  it('accepts steering only while counting down or playing', () => {
    expect(acceptsSteering('playing')).toBe(true);
    expect(acceptsSteering('countdown')).toBe(true);
    expect(acceptsSteering('paused')).toBe(false);
    expect(acceptsSteering('dying')).toBe(false);
  });
});
