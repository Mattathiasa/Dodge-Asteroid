import type { Rng } from '../core/types.js';
import type { Asteroid, Particle, PowerUp, Shard, Ship } from './entities.js';
import type { ScoreState } from './scoring.js';
import {
  createAsteroid,
  createParticle,
  createPowerUp,
  createShard,
  createShip,
} from './entities.js';
import { createScoreState } from './scoring.js';
import { Pool } from './pool.js';
import { PARTICLES, SHARDS, SHIP, SPAWN, WORLD } from '../config.js';
import { createRng } from '../core/rng.js';

export interface World {
  readonly ship: Ship;
  readonly asteroids: Pool<Asteroid>;
  readonly powerUps: Pool<PowerUp>;
  readonly particles: Pool<Particle>;
  readonly shards: Pool<Shard>;
  readonly score: ScoreState;
  /** Drives every spawn. Nothing the player does draws from it. */
  rng: Rng;
  /**
   * Drives cosmetic randomness such as particle bursts. Kept separate so that
   * collecting a pickup or losing a life cannot shift what spawns next.
   */
  fxRng: Rng;
  seed: number;
  /** Seconds of simulated time since the run began. */
  elapsed: number;
  /** Simulated milliseconds, used for spawn and combo deadlines. */
  clockMs: number;
  nextSpawnAtMs: number;
  nextShardAtMs: number;
  /** Current sector index; see `sectorAt`. */
  sector: number;
  /** Shards collected in the current quick succession. */
  shardChain: number;
  lastShardAtMs: number;
  /** Seconds left on the pre-run countdown. */
  countdown: number;
  /**
   * Multiplies the time fed to the difficulty curve, so a difficulty mode
   * stretches or compresses the same ramp rather than needing its own curve.
   */
  difficultyScale: number;
}

export function createWorld(seed: number): World {
  const world: World = {
    ship: createShip(WORLD.width / 2, WORLD.height * 0.78, SHIP.radius),
    asteroids: new Pool(createAsteroid, SPAWN.asteroidCapacity),
    powerUps: new Pool(createPowerUp, SPAWN.powerUpCapacity),
    particles: new Pool(createParticle, PARTICLES.capacity),
    shards: new Pool(createShard, SHARDS.capacity),
    score: createScoreState(),
    rng: createRng(seed),
    fxRng: createRng(fxSeed(seed)),
    seed,
    elapsed: 0,
    clockMs: 0,
    nextSpawnAtMs: 0,
    nextShardAtMs: 0,
    sector: 0,
    shardChain: 0,
    lastShardAtMs: -Infinity,
    countdown: 0,
    difficultyScale: 1,
  };
  resetRun(world, seed);
  return world;
}

/** Returns the world to the start of a fresh run. Allocates nothing. */
export function resetRun(world: World, seed: number): void {
  const { ship, score } = world;

  ship.x = WORLD.width / 2;
  ship.y = WORLD.height * 0.78;
  ship.px = ship.x;
  ship.py = ship.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.r = SHIP.radius;
  ship.alive = true;
  ship.lives = SHIP.startingLives;
  ship.shieldTime = 0;
  ship.invulnTime = 0;
  ship.slowmoTime = 0;
  ship.trail.length = 0;

  world.asteroids.clear();
  world.powerUps.clear();
  world.particles.clear();
  world.shards.clear();

  score.points = 0;
  score.dodges = 0;
  score.combo = 0;
  score.comboExpiresAt = 0;
  score.survivalTime = 0;
  score.bonusPoints = 0;
  score.nearMisses = 0;
  score.bestCombo = 0;
  score.shards = 0;

  world.rng = createRng(seed);
  world.fxRng = createRng(fxSeed(seed));
  world.seed = seed;
  world.elapsed = 0;
  world.clockMs = 0;
  world.nextSpawnAtMs = 0;
  world.nextShardAtMs = 0;
  world.sector = 0;
  world.shardChain = 0;
  world.lastShardAtMs = -Infinity;
  world.countdown = 0;
}

/** A second stream derived from the run seed, so one seed still fixes the run. */
function fxSeed(seed: number): number {
  return (seed ^ 0x9e3779b9) >>> 0;
}
