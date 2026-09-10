import type { Rng } from '../core/types.js';
import type { Particle } from './entities.js';
import type { Pool } from './pool.js';
import { PARTICLES } from '../config.js';
import { TAU } from '../core/math.js';

/** Emits a radial burst. Silently does less work when the pool is full. */
export function emitBurst(
  pool: Pool<Particle>,
  rng: Rng,
  x: number,
  y: number,
  count: number,
  colors: readonly string[],
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = rng.range(0, TAU);
    const speed = rng.range(PARTICLES.minSpeed, PARTICLES.maxSpeed);
    const life = rng.range(PARTICLES.minLife, PARTICLES.maxLife);
    const spawned = pool.spawn((p) => {
      p.x = x;
      p.y = y;
      p.px = x;
      p.py = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.r = 1;
      p.life = life;
      p.maxLife = life;
      p.size = rng.range(1.4, 3.4);
      p.color = colors.length > 0 ? rng.pick(colors) : '#ffffff';
    });
    if (spawned === null) return; // pool exhausted; drop the rest of the burst
  }
}

export function updateParticles(pool: Pool<Particle>, dt: number): void {
  const drag = Math.pow(PARTICLES.drag, dt * 60);
  pool.forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      return;
    }
    p.px = p.x;
    p.py = p.y;
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  pool.compact();
}
