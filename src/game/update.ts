import type { SimEventSink } from './events.js';
import type { SteerInput } from './movement.js';
import type { World } from './world.js';
import { DIFFICULTY, PALETTE, POWERUPS, SCORING, SHIP, WORLD } from '../config.js';
import { difficultyAt } from './difficulty.js';
import { circlesOverlap, isNearMiss, sweptCircleToi } from './collision.js';
import { clampToBounds, integrate, steerToward } from './movement.js';
import { applyDodge, tickScore } from './scoring.js';
import { emitBurst, updateParticles } from './particles.js';
import { makeAsteroidSpec, maybeMakePowerUpSpec, nextSpawnTime, shouldSpawn } from './spawner.js';

const MILESTONE_STEP = 500;

export interface FrameInput {
  readonly steer: SteerInput;
  /** Whether the player may steer this tick. */
  readonly canSteer: boolean;
}

/**
 * Advances the simulation by one fixed step.
 *
 * Returns `true` while the ship is still alive. Everything here is a function
 * of the world, the input and the world's seeded RNG — no clocks, no DOM, no
 * audio — which is what makes a whole run reproducible and testable.
 */
export function update(
  world: World,
  dt: number,
  input: FrameInput,
  events: SimEventSink,
): boolean {
  const { ship } = world;

  // Time dilation affects the world, but never the player's own responsiveness.
  const scale = ship.slowmoTime > 0 ? POWERUPS.slowmoFactor : 1;
  const worldDt = dt * scale;

  world.elapsed += dt;
  world.clockMs += dt * 1000;

  tickTimers(world, dt);

  if (input.canSteer) {
    steerToward(ship, input.steer, dt);
  }
  integrate(ship, dt);
  clampToBounds(ship, WORLD);
  recordTrail(world);

  const difficulty = difficultyAt(world.elapsed * world.difficultyScale);
  maybeSpawn(world, difficulty);
  const survived = advanceHazards(world, worldDt, events);

  advancePowerUps(world, worldDt, events);
  updateParticles(world.particles, worldDt);

  if (survived) {
    const before = world.score.points;
    tickScore(world.score, dt, world.clockMs);
    announceMilestone(before, world.score.points, events);
  }

  return survived;
}

function tickTimers(world: World, dt: number): void {
  const { ship } = world;
  if (ship.shieldTime > 0) ship.shieldTime = Math.max(0, ship.shieldTime - dt);
  if (ship.invulnTime > 0) ship.invulnTime = Math.max(0, ship.invulnTime - dt);
  if (ship.slowmoTime > 0) ship.slowmoTime = Math.max(0, ship.slowmoTime - dt);
}

function recordTrail(world: World): void {
  const { trail } = world.ship;
  trail.push(world.ship.x, world.ship.y);
  const maxEntries = SHIP.trailLength * 2;
  if (trail.length > maxEntries) trail.splice(0, trail.length - maxEntries);
}

function maybeSpawn(world: World, difficulty: ReturnType<typeof difficultyAt>): void {
  // Nothing spawns during the opening grace period, so the player has a moment
  // to find the ship before anything is falling at it.
  if (world.elapsed * world.difficultyScale < DIFFICULTY.graceSeconds) return;
  if (!shouldSpawn(world.clockMs, world.nextSpawnAtMs, world.asteroids.active, difficulty)) {
    return;
  }

  const spec = makeAsteroidSpec(difficulty, world.rng, WORLD.width);
  world.asteroids.spawn((a) => {
    a.x = spec.x;
    a.y = spec.y;
    a.px = spec.x;
    a.py = spec.y;
    a.vx = spec.vx;
    a.vy = spec.vy;
    a.r = spec.r;
    a.rot = 0;
    a.rotSpeed = spec.rotSpeed;
    a.shape = spec.shape;
    a.scored = false;
    a.nearMissed = false;
  });

  const pickup = maybeMakePowerUpSpec(difficulty, world.rng, WORLD.width);
  if (pickup !== null) {
    world.powerUps.spawn((p) => {
      p.x = pickup.x;
      p.y = pickup.y;
      p.px = pickup.x;
      p.py = pickup.y;
      p.vx = 0;
      p.vy = pickup.vy;
      p.r = POWERUPS.radius;
      p.kind = pickup.kind;
      p.age = 0;
    });
  }

  world.nextSpawnAtMs = nextSpawnTime(world.clockMs, difficulty, world.rng);
}

/** Moves asteroids, resolves impacts, and awards dodges. Returns survival. */
function advanceHazards(world: World, dt: number, events: SimEventSink): boolean {
  const { ship } = world;
  const shipDelta = { x: ship.x - ship.px, y: ship.y - ship.py };
  let survived = true;

  world.asteroids.forEach((a) => {
    a.px = a.x;
    a.py = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.rotSpeed * dt;

    const asteroidDelta = { x: a.x - a.px, y: a.y - a.py };

    // Continuous test against the previous positions, so nothing tunnels
    // through the ship between two fixed steps.
    const invulnerable = ship.invulnTime > 0 || ship.shieldTime > 0;
    if (survived && !invulnerable) {
      const toi = sweptCircleToi(
        { x: ship.px, y: ship.py, r: ship.r },
        shipDelta,
        { x: a.px, y: a.py, r: a.r },
        asteroidDelta,
      );
      if (toi !== null) {
        survived = resolveImpact(world, a.x, a.y, events);
        a.alive = false;
        return;
      }
    } else if (survived && ship.shieldTime > 0 && circlesOverlap(ship, a)) {
      // The shield bubble vaporises anything it touches.
      ship.shieldTime = 0;
      a.alive = false;
      emitBurst(world.particles, world.rng, a.x, a.y, 30, [
        PALETTE.shield,
        PALETTE.asteroid,
      ]);
      events.emit({ type: 'shieldBreak', x: a.x, y: a.y });
      return;
    }

    if (!a.nearMissed && isNearMiss(ship, a, SCORING.nearMissMargin)) {
      a.nearMissed = true;
    }

    // Scored once it has fully passed the bottom of the field.
    if (!a.scored && a.y - a.r > WORLD.height) {
      a.scored = true;
      const points = applyDodge(world.score, world.clockMs, a.nearMissed);
      events.emit({ type: 'dodge', points });
      if (a.nearMissed) {
        events.emit({ type: 'nearMiss', combo: world.score.combo, x: a.x, y: a.y });
      }
    }

    // Retire once well outside the field on any side.
    if (a.y - a.r > WORLD.height + 40 || a.x < -120 || a.x > WORLD.width + 120) {
      a.alive = false;
    }
  });

  world.asteroids.compact();
  return survived;
}

/** Spends a life, or ends the run. Returns whether the ship survived. */
function resolveImpact(world: World, x: number, y: number, events: SimEventSink): boolean {
  const { ship } = world;

  if (ship.lives > 1) {
    ship.lives -= 1;
    ship.invulnTime = SHIP.invulnSeconds;
    emitBurst(world.particles, world.rng, x, y, 30, [PALETTE.asteroid, PALETTE.ship]);
    events.emit({ type: 'lifeLost', x, y, livesLeft: ship.lives });
    return true;
  }

  ship.lives = 0;
  ship.alive = false;
  emitBurst(world.particles, world.rng, ship.x, ship.y, 46, [
    PALETTE.ship,
    PALETTE.shipGlow,
    PALETTE.asteroid,
  ]);
  events.emit({ type: 'destroyed', x: ship.x, y: ship.y });
  return false;
}

function advancePowerUps(world: World, dt: number, events: SimEventSink): void {
  const { ship } = world;

  world.powerUps.forEach((p) => {
    p.px = p.x;
    p.py = p.y;
    p.y += p.vy * dt;
    p.age += dt;

    if (p.age > POWERUPS.lifetimeSeconds || p.y - p.r > WORLD.height + 40) {
      p.alive = false;
      return;
    }

    if (!circlesOverlap(ship, p)) return;

    p.alive = false;
    switch (p.kind) {
      case 'shield':
        ship.shieldTime = SHIP.shieldSeconds;
        break;
      case 'slowmo':
        ship.slowmoTime = POWERUPS.slowmoSeconds;
        break;
      case 'life':
        ship.lives = Math.min(ship.lives + 1, SHIP.maxLives);
        break;
    }
    emitBurst(world.particles, world.rng, p.x, p.y, 20, [colorFor(p.kind)]);
    events.emit({ type: 'pickup', kind: p.kind, x: p.x, y: p.y });
  });

  world.powerUps.compact();
}

function colorFor(kind: 'shield' | 'slowmo' | 'life'): string {
  if (kind === 'shield') return PALETTE.powerShield;
  if (kind === 'slowmo') return PALETTE.powerSlowmo;
  return PALETTE.powerLife;
}

function announceMilestone(before: number, after: number, events: SimEventSink): void {
  if (Math.floor(after / MILESTONE_STEP) > Math.floor(before / MILESTONE_STEP)) {
    events.emit({ type: 'milestone', points: after });
  }
}
