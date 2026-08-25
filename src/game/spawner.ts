import type { Rng } from '../core/types.js';
import type { DifficultyParams } from './difficulty.js';
import type { PowerUpKind } from './entities.js';
import { DIFFICULTY, POWERUPS, SPAWN } from '../config.js';

export interface AsteroidSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotSpeed: number;
  shape: number;
}

export interface PowerUpSpec {
  x: number;
  y: number;
  vy: number;
  kind: PowerUpKind;
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

export function makeAsteroidSpec(
  difficulty: DifficultyParams,
  rng: Rng,
  worldWidth: number,
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
  };
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
