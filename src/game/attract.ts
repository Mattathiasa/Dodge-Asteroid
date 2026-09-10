import type { World } from './world.js';
import { WORLD } from '../config.js';
import { difficultyAt } from './difficulty.js';
import { makeAsteroidSpec, nextSpawnTime, shouldSpawn } from './spawner.js';

/**
 * Where on the difficulty curve the menu backdrop sits.
 *
 * Reusing the real curve means the attract screen shows the game at a
 * representative density rather than needing its own tuning constants.
 */
const ATTRACT_TIME_SECONDS = 24;

/**
 * Advances the decorative meteor field shown behind the menus.
 *
 * This is the same spawner and the same motion as a real run, with no ship, no
 * collisions and no scoring — so the title screen looks like the game instead
 * of an empty starfield.
 */
export function updateAttract(world: World, dt: number): void {
  world.clockMs += dt * 1000;

  const difficulty = difficultyAt(ATTRACT_TIME_SECONDS);

  if (shouldSpawn(world.clockMs, world.nextSpawnAtMs, world.asteroids.active, difficulty)) {
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
      a.skin = spec.skin;
      a.scored = true;
      a.nearMissed = false;
    });
    world.nextSpawnAtMs = nextSpawnTime(world.clockMs, difficulty, world.rng);
  }

  world.asteroids.forEach((a) => {
    a.px = a.x;
    a.py = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.rotSpeed * dt;

    if (a.y - a.r > WORLD.height + 60 || a.x < -140 || a.x > WORLD.width + 140) {
      a.alive = false;
    }
  });
  world.asteroids.compact();
}
