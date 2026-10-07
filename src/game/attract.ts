import type { World } from './world.js';
import { WORLD } from '../config.js';
import { difficultyAt } from './difficulty.js';
import { initAsteroid, makeAsteroidSpec, nextSpawnTime, shouldSpawn } from './spawner.js';

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
  world.fieldMs += dt * 1000;

  const difficulty = difficultyAt(ATTRACT_TIME_SECONDS);

  if (shouldSpawn(world.fieldMs, world.nextSpawnAtMs, world.asteroids.active, difficulty)) {
    const spec = makeAsteroidSpec(difficulty, world.rng, WORLD.width);
    world.asteroids.spawn((a) => {
      initAsteroid(a, spec);
      a.scored = true;
    });
    world.nextSpawnAtMs = nextSpawnTime(world.fieldMs, difficulty, world.rng);
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
