import type { Rng } from '../core/types.js';
import type { DifficultyParams } from './difficulty.js';
import type { Asteroid, PowerUpKind } from './entities.js';
import { COMETS, DIFFICULTY, POWERUPS, SECTORS, SHARDS, SPAWN } from '../config.js';

export interface AsteroidSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotSpeed: number;
  shape: number;
  skin: number;
  comet: boolean;
  /** Seconds of lane warning before it moves. Zero for ordinary rocks. */
  warn: number;
}

/** A diagonal or vertical string of shards, laid out from its first shard. */
export interface ShardStringSpec {
  x: number;
  count: number;
  /** Sideways offset between consecutive shards. */
  stepX: number;
}

export interface PowerUpSpec {
  x: number;
  y: number;
  vy: number;
  kind: PowerUpKind;
}

/** Resets a pooled asteroid from a spec. */
export function initAsteroid(a: Asteroid, spec: AsteroidSpec): void {
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
  a.skin = spec.skin;
  a.scored = false;
  a.grazing = false;
  a.nearMissed = false;
  a.comet = spec.comet;
  a.warn = spec.warn;
}

/** Whether a spawn is due, respecting the active-count pressure valve. */
export function shouldSpawn(
  nowMs: number,
  nextSpawnAtMs: number,
  activeCount: number,
  difficulty: DifficultyParams,
): boolean {
  if (activeCount >= difficulty.maxActive) return false;
  return nowMs >= nextSpawnAtMs;
}

/** Schedules the next spawn, with jitter so waves never feel metronomic. */
export function nextSpawnTime(nowMs: number, difficulty: DifficultyParams, rng: Rng): number {
  const jitter = 1 + rng.range(-DIFFICULTY.spawnJitter, DIFFICULTY.spawnJitter);
  return nowMs + difficulty.spawnIntervalMs * jitter;
}

/**
 * An ordinary rock.
 *
 * `biasSkin` is the current sector's colour family. Most rocks take it, so a
 * sector reads as a place; the rest stay mixed so the field never goes flat.
 */
export function makeAsteroidSpec(
  difficulty: DifficultyParams,
  rng: Rng,
  worldWidth: number,
  biasSkin: number | null = null,
): AsteroidSpec {
  const r = rng.range(difficulty.radiusMin, difficulty.radiusMax);
  return {
    // Spawned fully inside the horizontal bounds so nothing clips the wall.
    x: rng.range(r, worldWidth - r),
    y: -r,
    vx: rng.range(-difficulty.driftX, difficulty.driftX),
    vy: rng.range(difficulty.speedMin, difficulty.speedMax),
    r,
    rotSpeed: rng.range(-2.2, 2.2),
    shape: rng.int(0, SPAWN.shapeCount - 1),
    skin:
      biasSkin !== null && rng.chance(SECTORS.skinBias)
        ? biasSkin
        : rng.int(0, SPAWN.skinCount - 1),
    comet: false,
    warn: 0,
  };
}

/**
 * A telegraphed comet.
 *
 * It waits just above the field while its lane is lit, then falls straight
 * down at speed. Straight down matters: the warning is a column, so the comet
 * has to stay in it, or the warning would be a lie.
 */
export function makeCometSpec(rng: Rng, worldWidth: number): AsteroidSpec {
  const r = rng.range(COMETS.radiusMin, COMETS.radiusMax);
  return {
    x: rng.range(r, worldWidth - r),
    y: -r * 3,
    vx: 0,
    vy: COMETS.speed,
    r,
    rotSpeed: rng.range(-6, 6),
    shape: rng.int(0, SPAWN.shapeCount - 1),
    skin: COMETS.skin,
    comet: true,
    warn: COMETS.warnSeconds,
  };
}

/** Picks a rock or a comet for this spawn. */
export function makeHazardSpec(
  difficulty: DifficultyParams,
  rng: Rng,
  worldWidth: number,
  biasSkin: number | null = null,
): AsteroidSpec {
  if (difficulty.cometChance > 0 && rng.chance(difficulty.cometChance)) {
    return makeCometSpec(rng, worldWidth);
  }
  return makeAsteroidSpec(difficulty, rng, worldWidth, biasSkin);
}

/** Schedules the next string of shards. */
export function nextShardTime(nowMs: number, difficulty: DifficultyParams, rng: Rng): number {
  return nowMs + difficulty.shardIntervalMs * rng.range(0.8, 1.2);
}

/** A string of shards that fits entirely inside the field from first to last. */
export function makeShardString(rng: Rng, worldWidth: number): ShardStringSpec {
  const count = rng.int(SHARDS.countMin, SHARDS.countMax);
  const stepX = rng.chance(0.4) ? 0 : rng.range(-SHARDS.maxStepX, SHARDS.maxStepX);
  const span = stepX * (count - 1);
  const margin = SHARDS.radius + 6;
  const minX = margin + Math.max(0, -span);
  const maxX = worldWidth - margin - Math.max(0, span);
  return { x: rng.range(minX, maxX), count, stepX };
}

const KIND_TABLE: readonly PowerUpKind[] = buildKindTable();

function buildKindTable(): PowerUpKind[] {
  const table: PowerUpKind[] = [];
  const push = (kind: PowerUpKind, weight: number): void => {
    for (let i = 0; i < weight; i += 1) table.push(kind);
  };
  push('shield', POWERUPS.weights.shield);
  push('slowmo', POWERUPS.weights.slowmo);
  push('life', POWERUPS.weights.life);
  return table;
}

/** Returns a pickup spec, or `null` when this spawn does not roll one. */
export function maybeMakePowerUpSpec(
  difficulty: DifficultyParams,
  rng: Rng,
  worldWidth: number,
): PowerUpSpec | null {
  if (!rng.chance(difficulty.powerUpChance)) return null;
  const r = POWERUPS.radius;
  return {
    x: rng.range(r, worldWidth - r),
    y: -r,
    vy: POWERUPS.fallSpeed,
    kind: rng.pick(KIND_TABLE),
  };
}
