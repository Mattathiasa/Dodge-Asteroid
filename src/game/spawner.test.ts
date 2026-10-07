import { describe, expect, it } from 'vitest';
import { COMETS, SECTORS, SHARDS, WORLD } from '../config.js';
import { createRng } from '../core/rng.js';
import { difficultyAt } from './difficulty.js';
import {
  makeAsteroidSpec,
  makeCometSpec,
  makeHazardSpec,
  makeShardString,
  maybeMakePowerUpSpec,
  nextSpawnTime,
  shouldSpawn,
} from './spawner.js';

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

describe('makeAsteroidSpec sector bias', () => {
  it('leans toward the sector colour without making the field monochrome', () => {
    const rng = createRng(808);
    const difficulty = difficultyAt(40);
    const trials = 6000;
    let matching = 0;
    const seen = new Set<number>();
    for (let i = 0; i < trials; i += 1) {
      const spec = makeAsteroidSpec(difficulty, rng, WORLD.width, 3);
      seen.add(spec.skin);
      if (spec.skin === 3) matching += 1;
    }
    // The biased share, plus its fair share of the unbiased remainder.
    const expected = SECTORS.skinBias + (1 - SECTORS.skinBias) / 5;
    expect(matching / trials).toBeGreaterThan(expected - 0.04);
    expect(matching / trials).toBeLessThan(expected + 0.04);
    expect(seen.size).toBe(5);
  });

  it('never produces a comet', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i += 1) {
      const spec = makeAsteroidSpec(difficultyAt(200), rng, WORLD.width, 2);
      expect(spec.comet).toBe(false);
      expect(spec.warn).toBe(0);
    }
  });
});

describe('makeCometSpec', () => {
  it('waits above the field, then falls straight down its lane', () => {
    const rng = createRng(31337);
    for (let i = 0; i < 400; i += 1) {
      const spec = makeCometSpec(rng, WORLD.width);
      expect(spec.comet).toBe(true);
      expect(spec.warn).toBe(COMETS.warnSeconds);
      expect(spec.y + spec.r).toBeLessThan(0);
      // Straight down, or the lit lane would be a lie.
      expect(spec.vx).toBe(0);
      expect(spec.vy).toBe(COMETS.speed);
      expect(spec.x - spec.r).toBeGreaterThanOrEqual(0);
      expect(spec.x + spec.r).toBeLessThanOrEqual(WORLD.width);
      expect(spec.skin).toBe(COMETS.skin);
    }
  });
});

describe('makeHazardSpec', () => {
  it('never sends a comet before the field has warmed up', () => {
    const rng = createRng(9);
    const early = difficultyAt(3);
    expect(early.cometChance).toBe(0);
    for (let i = 0; i < 2000; i += 1) {
      expect(makeHazardSpec(early, rng, WORLD.width).comet).toBe(false);
    }
  });

  it('sends comets at roughly the configured rate once it has', () => {
    const rng = createRng(10);
    const late = difficultyAt(400);
    const trials = 8000;
    let comets = 0;
    for (let i = 0; i < trials; i += 1) {
      if (makeHazardSpec(late, rng, WORLD.width).comet) comets += 1;
    }
    expect(comets / trials).toBeGreaterThan(late.cometChance * 0.8);
    expect(comets / trials).toBeLessThan(late.cometChance * 1.2);
  });
});

describe('makeShardString', () => {
  it('fits every shard of the string inside the field', () => {
    const rng = createRng(4242);
    for (let i = 0; i < 2000; i += 1) {
      const spec = makeShardString(rng, WORLD.width);
      expect(spec.count).toBeGreaterThanOrEqual(SHARDS.countMin);
      expect(spec.count).toBeLessThanOrEqual(SHARDS.countMax);
      expect(Math.abs(spec.stepX)).toBeLessThanOrEqual(SHARDS.maxStepX);
      const first = spec.x;
      const last = spec.x + spec.stepX * (spec.count - 1);
      for (const x of [first, last]) {
        expect(x - SHARDS.radius).toBeGreaterThanOrEqual(0);
        expect(x + SHARDS.radius).toBeLessThanOrEqual(WORLD.width);
      }
    }
  });

  it('makes both straight and diagonal strings', () => {
    const rng = createRng(77);
    let straight = 0;
    let diagonal = 0;
    for (let i = 0; i < 500; i += 1) {
      if (makeShardString(rng, WORLD.width).stepX === 0) straight += 1;
      else diagonal += 1;
    }
    expect(straight).toBeGreaterThan(0);
    expect(diagonal).toBeGreaterThan(0);
  });
});
