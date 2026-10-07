import type { Asteroid } from './entities.js';
import type { DifficultyParams } from './difficulty.js';
import type { SimEventSink } from './events.js';
import type { SteerInput } from './movement.js';
import type { World } from './world.js';
import { DIFFICULTY, PALETTE, POWERUPS, SCORING, SHARDS, SHIP, WORLD } from '../config.js';
import { difficultyAt } from './difficulty.js';
import { circlesOverlap, isNearMiss, sweptCircleToi } from './collision.js';
import { clampToBounds, integrate, steerToward } from './movement.js';
import { applyDodge, applyNearMiss, applyShard, tickScore } from './scoring.js';
import { emitBurst, updateParticles } from './particles.js';
import { sectorAt, sectorInfo } from './sectors.js';
import {
  initAsteroid,
  makeHazardSpec,
  makeShardString,
  maybeMakePowerUpSpec,
  nextShardTime,
  nextSpawnTime,
  shouldSpawn,
} from './spawner.js';

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
 *
 * It keeps working after the ship is destroyed: the field carries on falling
 * while the explosion plays out, it just stops scoring and colliding.
 */
export function update(world: World, dt: number, input: FrameInput, events: SimEventSink): boolean {
  const { ship } = world;

  // Time dilation affects the world, but never the player's own responsiveness.
  const scale = ship.slowmoTime > 0 ? POWERUPS.slowmoFactor : 1;
  const worldDt = dt * scale;

  world.elapsed += dt;
  world.clockMs += dt * 1000;

  tickTimers(world, dt);

  if (ship.alive) {
    if (input.canSteer) steerToward(ship, input.steer, dt);
    integrate(ship, dt);
    clampToBounds(ship, WORLD);
    recordTrail(world);
  }

  const scaledElapsed = world.elapsed * world.difficultyScale;
  const difficulty = difficultyAt(scaledElapsed);

  // Nothing spawns during the opening grace period, so the player has a moment
  // to find the ship before anything is falling at it — and nothing new spawns
  // once the ship is gone, so a comet cannot sound its warning over the wreck.
  if (ship.alive && scaledElapsed >= DIFFICULTY.graceSeconds) {
    advanceSector(world, scaledElapsed, events);
    maybeSpawn(world, difficulty, events);
    maybeSpawnShards(world, difficulty);
  }

  advanceHazards(world, worldDt, events);
  advancePowerUps(world, worldDt, events);
  advanceShards(world, worldDt, events);
  updateParticles(world.particles, worldDt);

  if (ship.alive) {
    const before = world.score.points;
    tickScore(world.score, dt, world.clockMs);
    announceMilestone(before, world.score.points, events);
  }

  return ship.alive;
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

function advanceSector(world: World, scaledElapsed: number, events: SimEventSink): void {
  const sector = sectorAt(scaledElapsed);
  if (sector <= world.sector) return;
  world.sector = sector;
  events.emit({ type: 'sector', index: sector });
}

function maybeSpawn(world: World, difficulty: DifficultyParams, events: SimEventSink): void {
  if (!shouldSpawn(world.clockMs, world.nextSpawnAtMs, world.asteroids.active, difficulty)) {
    return;
  }

  const spec = makeHazardSpec(difficulty, world.rng, WORLD.width, sectorInfo(world.sector).skin);
  const spawned = world.asteroids.spawn((a) => initAsteroid(a, spec));
  if (spawned !== null && spec.comet) events.emit({ type: 'cometWarning', x: spec.x });

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

function maybeSpawnShards(world: World, difficulty: DifficultyParams): void {
  if (world.clockMs < world.nextShardAtMs) return;

  const spec = makeShardString(world.rng, WORLD.width);
  for (let i = 0; i < spec.count; i += 1) {
    const x = spec.x + spec.stepX * i;
    const y = -SHARDS.radius - SHARDS.spacing * i;
    world.shards.spawn((s) => {
      s.x = x;
      s.y = y;
      s.px = x;
      s.py = y;
      s.vx = 0;
      s.vy = SHARDS.fallSpeed;
      s.r = SHARDS.radius;
      s.age = i * 0.18;
    });
  }

  world.nextShardAtMs = nextShardTime(world.clockMs, difficulty, world.rng);
}

/** Moves asteroids, resolves impacts, and awards dodges and near misses. */
function advanceHazards(world: World, dt: number, events: SimEventSink): void {
  const { ship } = world;
  const shipDelta = { x: ship.x - ship.px, y: ship.y - ship.py };

  world.asteroids.forEach((a) => {
    // A comet holds still above the field while its lane is lit.
    if (a.warn > 0) {
      a.warn = Math.max(0, a.warn - dt);
      a.px = a.x;
      a.py = a.y;
      return;
    }

    a.px = a.x;
    a.py = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.rotSpeed * dt;

    if (ship.alive) {
      if (ship.shieldTime > 0) {
        if (circlesOverlap(ship, a)) {
          // The shield bubble vaporises anything it touches.
          ship.shieldTime = 0;
          a.alive = false;
          emitBurst(world.particles, world.fxRng, a.x, a.y, 30, [PALETTE.shield, PALETTE.asteroid]);
          events.emit({ type: 'shieldBreak', x: a.x, y: a.y, r: a.r, skin: a.skin });
          return;
        }
      } else if (ship.invulnTime <= 0) {
        // Continuous test against the previous positions, so nothing tunnels
        // through the ship between two fixed steps.
        const toi = sweptCircleToi(
          { x: ship.px, y: ship.py, r: ship.r },
          shipDelta,
          { x: a.px, y: a.py, r: a.r },
          { x: a.x - a.px, y: a.y - a.py },
        );
        if (toi !== null) {
          resolveImpact(world, a, events);
          a.alive = false;
          return;
        }
      }
      trackGraze(world, a, events);
    }

    // Scored once it has fully passed the bottom of the field.
    if (!a.scored && a.y - a.r > WORLD.height) {
      a.scored = true;
      if (ship.alive) {
        // A rock that leaves while still inside the margin has cleared the ship.
        if (a.grazing && !a.nearMissed) awardNearMiss(world, a, events);
        events.emit({ type: 'dodge', points: applyDodge(world.score, world.clockMs) });
      }
    }

    // Retire once well outside the field on any side.
    if (a.y - a.r > WORLD.height + 40 || a.x < -120 || a.x > WORLD.width + 120) {
      a.alive = false;
    }
  });

  world.asteroids.compact();
}

/**
 * Follows a rock through the near-miss margin.
 *
 * The bonus is paid when the rock *leaves* the margin without having touched
 * the ship. Paying on entry would pay out for a rock that is about to hit you,
 * and the run would end on a "+15".
 */
function trackGraze(world: World, a: Asteroid, events: SimEventSink): void {
  if (a.nearMissed) return;
  const { ship } = world;

  if (circlesOverlap(ship, a)) {
    // Passing through the ship while it is invulnerable is not skill.
    a.grazing = false;
    a.nearMissed = true;
    return;
  }

  if (isNearMiss(ship, a, SCORING.nearMissMargin)) {
    a.grazing = true;
  } else if (a.grazing) {
    awardNearMiss(world, a, events);
  }
}

function awardNearMiss(world: World, a: Asteroid, events: SimEventSink): void {
  const { ship, score } = world;
  a.nearMissed = true;
  a.grazing = false;
  const points = applyNearMiss(score, world.clockMs);
  events.emit({
    type: 'nearMiss',
    combo: score.combo,
    points,
    // Between the two, where the player is already looking.
    x: (ship.x + a.x) / 2,
    y: (ship.y + a.y) / 2,
  });
}

/** Spends a life, or ends the run. */
function resolveImpact(world: World, a: Asteroid, events: SimEventSink): void {
  const { ship } = world;

  if (ship.lives > 1) {
    ship.lives -= 1;
    ship.invulnTime = SHIP.invulnSeconds;
    emitBurst(world.particles, world.fxRng, a.x, a.y, 30, [PALETTE.asteroid, PALETTE.ship]);
    events.emit({
      type: 'lifeLost',
      x: a.x,
      y: a.y,
      livesLeft: ship.lives,
      r: a.r,
      skin: a.skin,
    });
    return;
  }

  ship.lives = 0;
  ship.alive = false;
  ship.vx = 0;
  ship.vy = 0;
  emitBurst(world.particles, world.fxRng, ship.x, ship.y, 46, [
    PALETTE.ship,
    PALETTE.shipGlow,
    PALETTE.asteroid,
  ]);
  events.emit({ type: 'destroyed', x: ship.x, y: ship.y, r: a.r, skin: a.skin });
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

    if (!ship.alive || !circlesOverlap(ship, p)) return;

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
    emitBurst(world.particles, world.fxRng, p.x, p.y, 20, [colorFor(p.kind)]);
    events.emit({ type: 'pickup', kind: p.kind, x: p.x, y: p.y });
  });

  world.powerUps.compact();
}

/**
 * Moves shards, pulls nearby ones toward the ship, and collects them.
 *
 * The pull steers a shard straight at the ship rather than accelerating it, so
 * it can never fall into an orbit around a ship that keeps moving.
 */
function advanceShards(world: World, dt: number, events: SimEventSink): void {
  const { ship } = world;
  const settle = Math.min(1, dt * 4);

  world.shards.forEach((s) => {
    s.px = s.x;
    s.py = s.y;
    s.age += dt;

    const dx = ship.x - s.x;
    const dy = ship.y - s.y;
    const distance = Math.hypot(dx, dy);
    if (ship.alive && distance < SHARDS.magnetRadius && distance > 0.001) {
      const speed = 220 + 760 * (1 - distance / SHARDS.magnetRadius);
      s.vx = (dx / distance) * speed;
      s.vy = (dy / distance) * speed;
    } else {
      // Ease back into the ordinary fall once out of reach.
      s.vx += (0 - s.vx) * settle;
      s.vy += (SHARDS.fallSpeed - s.vy) * settle;
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (ship.alive && circlesOverlap(ship, s)) {
      s.alive = false;
      collectShard(world, s.x, s.y, events);
      return;
    }

    if (s.y - s.r > WORLD.height + 20 || s.x < -40 || s.x > WORLD.width + 40) {
      s.alive = false;
    }
  });

  world.shards.compact();
}

function collectShard(world: World, x: number, y: number, events: SimEventSink): void {
  const now = world.clockMs;
  world.shardChain = now - world.lastShardAtMs <= SHARDS.chainWindowMs ? world.shardChain + 1 : 1;
  world.lastShardAtMs = now;

  const points = applyShard(world.score, now);
  emitBurst(world.particles, world.fxRng, x, y, 8, [PALETTE.shard, PALETTE.shardCore]);
  events.emit({ type: 'shard', points, chain: world.shardChain, x, y });
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
