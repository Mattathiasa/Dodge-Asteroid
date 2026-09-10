import type { Rng } from '../core/types.js';
import type { Asteroid, Particle, PowerUp, Ship } from './entities.js';
import type { ScoreState } from './scoring.js';
import { createAsteroid, createParticle, createPowerUp, createShip } from './entities.js';
import { createScoreState } from './scoring.js';
import { Pool } from './pool.js';
import { PARTICLES, SHIP, SPAWN, WORLD } from '../config.js';
import { createRng } from '../core/rng.js';

export interface World {
  readonly ship: Ship;
  readonly asteroids: Pool<Asteroid>;
  readonly powerUps: Pool<PowerUp>;
  readonly particles: Pool<Particle>;
  readonly score: ScoreState;
  rng: Rng;
  seed: number;
  /** Seconds of simulated time since the run began. */
  elapsed: number;
  /** Simulated milliseconds, used for spawn and combo deadlines. */
  clockMs: number;
  nextSpawnAtMs: number;
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
    score: createScoreState(),
    rng: createRng(seed),
    seed,
    elapsed: 0,
    clockMs: 0,
    nextSpawnAtMs: 0,
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

  score.points = 0;
  score.dodges = 0;
  score.combo = 0;
  score.comboExpiresAt = 0;
  score.survivalTime = 0;
  score.bonusPoints = 0;

  world.rng = createRng(seed);
  world.seed = seed;
  world.elapsed = 0;
  world.clockMs = 0;
  world.nextSpawnAtMs = 0;
  world.countdown = 0;
}
