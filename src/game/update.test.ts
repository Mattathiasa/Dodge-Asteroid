import { describe, expect, it } from 'vitest';
import type { SimEvent } from './events.js';
import { SHIP, WORLD } from '../config.js';
import { createEventBuffer } from './events.js';
import { difficultyAt } from './difficulty.js';
import { createWorld, resetRun } from './world.js';
import { update } from './update.js';

const DT = 1 / 60;

/** Deterministic steering: a sine sweep across the field. */
function steerAt(tick: number) {
  return {
    target: {
      x: WORLD.width / 2 + Math.sin(tick / 45) * (WORLD.width / 2 - 40),
      y: WORLD.height * 0.78 + Math.cos(tick / 70) * 60,
    },
    axis: { x: 0, y: 0 },
  };
}

interface RunResult {
  ticks: number;
  points: number;
  survived: boolean;
  events: SimEvent[];
}

function simulate(seed: number, maxTicks: number, dt = DT): RunResult {
  const world = createWorld(seed);
  const buffer = createEventBuffer();
  const events: SimEvent[] = [];
  let ticks = 0;
  let survived = true;

  for (let i = 0; i < maxTicks; i += 1) {
    survived = update(world, dt, { steer: steerAt(i), canSteer: true }, buffer);
    events.push(...buffer.drain());
    ticks += 1;
    if (!survived) break;
  }

  return { ticks, points: world.score.points, survived, events };
}

describe('update', () => {
  it('is deterministic for a given seed', () => {
    const a = simulate(7, 3600);
    const b = simulate(7, 3600);
    expect(a.ticks).toBe(b.ticks);
    expect(a.points).toBe(b.points);
    expect(a.survived).toBe(b.survived);
    expect(a.events).toEqual(b.events);
  });

  it('produces different runs for different seeds', () => {
    const a = simulate(1, 3600);
    const b = simulate(999, 3600);
    expect([a.ticks, a.points]).not.toEqual([b.ticks, b.points]);
  });

  it('keeps every value finite across a long run', () => {
    const world = createWorld(42);
    const buffer = createEventBuffer();

    for (let i = 0; i < 5400; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();

      expect(Number.isFinite(world.ship.x)).toBe(true);
      expect(Number.isFinite(world.ship.y)).toBe(true);
      expect(Number.isFinite(world.ship.vx)).toBe(true);
      expect(Number.isFinite(world.ship.vy)).toBe(true);
      expect(Number.isFinite(world.score.points)).toBe(true);

      world.asteroids.forEach((a) => {
        expect(Number.isNaN(a.x)).toBe(false);
        expect(Number.isNaN(a.y)).toBe(false);
      });

      if (!alive) break;
    }
  });

  it('never lets the ship leave the field', () => {
    const world = createWorld(5);
    const buffer = createEventBuffer();
    for (let i = 0; i < 3600; i += 1) {
      // Steer hard into a corner to try to push it out.
      const alive = update(
        world,
        DT,
        { steer: { target: { x: -9999, y: -9999 }, axis: { x: 0, y: 0 } }, canSteer: true },
        buffer,
      );
      buffer.drain();
      expect(world.ship.x).toBeGreaterThanOrEqual(world.ship.r - 1e-6);
      expect(world.ship.y).toBeGreaterThanOrEqual(world.ship.r - 1e-6);
      expect(world.ship.x).toBeLessThanOrEqual(WORLD.width - world.ship.r + 1e-6);
      expect(world.ship.y).toBeLessThanOrEqual(WORLD.height - world.ship.r + 1e-6);
      if (!alive) break;
    }
  });

  it('respects the pool capacities and the active-asteroid limit', () => {
    const world = createWorld(31);
    const buffer = createEventBuffer();
    for (let i = 0; i < 7200; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
      expect(world.asteroids.active).toBeLessThanOrEqual(world.asteroids.capacity);
      expect(world.particles.active).toBeLessThanOrEqual(world.particles.capacity);
      expect(world.powerUps.active).toBeLessThanOrEqual(world.powerUps.capacity);
      // One over the cap is possible for a single tick, since the limit is
      // checked before the spawn rather than after it.
      expect(world.asteroids.active).toBeLessThanOrEqual(difficultyAt(world.elapsed).maxActive + 1);
      if (!alive) break;
    }
  });

  it('spawns nothing during the grace period', () => {
    const world = createWorld(3);
    const buffer = createEventBuffer();
    for (let i = 0; i < 60; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
    }
    expect(world.elapsed).toBeLessThan(2);
    expect(world.asteroids.active).toBe(0);
  });

  it('increases the score while the ship is alive', () => {
    const world = createWorld(17);
    const buffer = createEventBuffer();
    let previous = -1;
    for (let i = 0; i < 900; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
      if (!alive) break;
      expect(world.score.points).toBeGreaterThanOrEqual(previous);
      previous = world.score.points;
    }
    expect(world.score.points).toBeGreaterThan(0);
  });

  it('ends the run and emits a destroyed event when the ship is hit', () => {
    const world = createWorld(1);
    const buffer = createEventBuffer();

    // Park the ship right where a spawned asteroid will fall.
    let destroyed = false;
    for (let i = 0; i < 20000; i += 1) {
      const alive = update(
        world,
        DT,
        { steer: { target: null, axis: { x: 0, y: 0 } }, canSteer: false },
        buffer,
      );
      if (buffer.drain().some((e) => e.type === 'destroyed')) destroyed = true;
      if (!alive) break;
    }

    expect(destroyed).toBe(true);
    expect(world.ship.alive).toBe(false);
  });

  it('resetRun restores a fresh, identical starting state', () => {
    const world = createWorld(64);
    const buffer = createEventBuffer();
    for (let i = 0; i < 1200; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
    }

    resetRun(world, 64);
    expect(world.elapsed).toBe(0);
    expect(world.score.points).toBe(0);
    expect(world.asteroids.active).toBe(0);
    expect(world.particles.active).toBe(0);
    expect(world.ship.lives).toBe(SHIP.startingLives);
    expect(world.ship.alive).toBe(true);

    // And a run from the reset world matches a fresh one with the same seed.
    const fresh = simulate(64, 600);
    const buffer2 = createEventBuffer();
    let points = 0;
    for (let i = 0; i < 600; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer2);
      buffer2.drain();
      points = world.score.points;
      if (!alive) break;
    }
    expect(points).toBe(fresh.points);
  });
});
