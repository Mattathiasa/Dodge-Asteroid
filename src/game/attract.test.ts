import { describe, expect, it } from 'vitest';
import { WORLD } from '../config.js';
import { createWorld } from './world.js';
import { updateAttract } from './attract.js';

const DT = 1 / 60;

describe('updateAttract', () => {
  it('populates the field for the menu backdrop', () => {
    const world = createWorld(3);
    for (let i = 0; i < 600; i += 1) updateAttract(world, DT);
    expect(world.asteroids.active).toBeGreaterThan(0);
  });

  it('never exceeds the pool capacity over a long idle', () => {
    const world = createWorld(11);
    for (let i = 0; i < 20000; i += 1) {
      updateAttract(world, DT);
      expect(world.asteroids.active).toBeLessThanOrEqual(world.asteroids.capacity);
    }
  });

  it('retires meteors once they leave the field, so the pool never fills up', () => {
    const world = createWorld(5);
    for (let i = 0; i < 4000; i += 1) updateAttract(world, DT);
    world.asteroids.forEach((a) => {
      expect(a.y - a.r).toBeLessThanOrEqual(WORLD.height + 60);
    });
  });

  it('leaves the ship and the score completely alone', () => {
    const world = createWorld(9);
    const { x, y } = world.ship;
    for (let i = 0; i < 1200; i += 1) updateAttract(world, DT);
    expect(world.ship.x).toBe(x);
    expect(world.ship.y).toBe(y);
    expect(world.score.points).toBe(0);
    expect(world.elapsed).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const run = (seed: number): number[] => {
      const world = createWorld(seed);
      for (let i = 0; i < 900; i += 1) updateAttract(world, DT);
      const xs: number[] = [];
      world.asteroids.forEach((a) => xs.push(Math.round(a.x * 1000)));
      return xs;
    };
    expect(run(77)).toEqual(run(77));
  });
});
