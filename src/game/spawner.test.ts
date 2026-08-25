import { describe, expect, it } from 'vitest';
import { WORLD } from '../config.js';
import { createRng } from '../core/rng.js';
import { difficultyAt } from './difficulty.js';
import { makeAsteroidSpec, maybeMakePowerUpSpec, nextSpawnTime, shouldSpawn } from './spawner.js';

describe('shouldSpawn', () => {
  const difficulty = difficultyAt(30);

  it('waits until the scheduled time', () => {
    expect(shouldSpawn(500, 1000, 0, difficulty)).toBe(false);
    expect(shouldSpawn(1000, 1000, 0, difficulty)).toBe(true);
  });

  it('refuses once the field is at its active limit', () => {
    expect(shouldSpawn(9999, 0, difficulty.maxActive, difficulty)).toBe(false);
    expect(shouldSpawn(9999, 0, difficulty.maxActive - 1, difficulty)).toBe(true);
  });
});

describe('nextSpawnTime', () => {
  it('stays within the jitter band around the configured interval', () => {
    const difficulty = difficultyAt(10);
    const rng = createRng(4);
    for (let i = 0; i < 500; i += 1) {
      const delta = nextSpawnTime(0, difficulty, rng);
      expect(delta).toBeGreaterThan(difficulty.spawnIntervalMs * 0.7);
      expect(delta).toBeLessThan(difficulty.spawnIntervalMs * 1.3);
    }
  });
});

describe('makeAsteroidSpec', () => {
  it('always spawns fully inside the horizontal bounds', () => {
    const rng = createRng(11);
    for (const t of [0, 15, 60, 200]) {
      const difficulty = difficultyAt(t);
      for (let i = 0; i < 500; i += 1) {
        const spec = makeAsteroidSpec(difficulty, rng, WORLD.width);
        expect(spec.x - spec.r).toBeGreaterThanOrEqual(0);
        expect(spec.x + spec.r).toBeLessThanOrEqual(WORLD.width);
      }
    }
  });

  it('spawns just above the field and moves downward', () => {
    const rng = createRng(12);
    const difficulty = difficultyAt(30);
    for (let i = 0; i < 200; i += 1) {
      const spec = makeAsteroidSpec(difficulty, rng, WORLD.width);
      expect(spec.y).toBe(-spec.r);
      expect(spec.vy).toBeGreaterThanOrEqual(difficulty.speedMin);
      expect(spec.vy).toBeLessThanOrEqual(difficulty.speedMax);
      expect(spec.r).toBeGreaterThanOrEqual(difficulty.radiusMin);
      expect(spec.r).toBeLessThanOrEqual(difficulty.radiusMax);
    }
  });

  it('is fully determined by the seed', () => {
    const difficulty = difficultyAt(45);
    const a = createRng(2024);
    const b = createRng(2024);
    const first = Array.from({ length: 200 }, () => makeAsteroidSpec(difficulty, a, WORLD.width));
    const second = Array.from({ length: 200 }, () => makeAsteroidSpec(difficulty, b, WORLD.width));
    expect(first).toEqual(second);
  });
});

describe('maybeMakePowerUpSpec', () => {
  it('returns null most of the time and a valid spec otherwise', () => {
    const rng = createRng(77);
    const difficulty = difficultyAt(60);
    let spawned = 0;
    const trials = 4000;

    for (let i = 0; i < trials; i += 1) {
      const spec = maybeMakePowerUpSpec(difficulty, rng, WORLD.width);
      if (spec === null) continue;
      spawned += 1;
      expect(spec.x - 13).toBeGreaterThanOrEqual(0);
      expect(spec.x + 13).toBeLessThanOrEqual(WORLD.width);
      expect(spec.vy).toBeGreaterThan(0);
      expect(['shield', 'slowmo', 'life']).toContain(spec.kind);
    }

    const rate = spawned / trials;
    expect(rate).toBeGreaterThan(difficulty.powerUpChance * 0.7);
    expect(rate).toBeLessThan(difficulty.powerUpChance * 1.3);
  });

  it('eventually produces all three kinds', () => {
    const rng = createRng(5150);
    const difficulty = difficultyAt(120);
    const kinds = new Set<string>();
    for (let i = 0; i < 20000; i += 1) {
      const spec = maybeMakePowerUpSpec(difficulty, rng, WORLD.width);
      if (spec !== null) kinds.add(spec.kind);
    }
    expect([...kinds].sort()).toEqual(['life', 'shield', 'slowmo']);
  });
});
