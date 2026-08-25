import type { Rng } from '../core/types.js';
import { PALETTE, WORLD } from '../config.js';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  /** Scroll speed, in world units per second. */
  speed: number;
}

/**
 * A three-layer parallax starfield.
 *
 * Stars are generated once and scrolled, so the background costs no allocation
 * per frame. The layers move at different speeds, which is what sells depth.
 */
export class Starfield {
  private readonly stars: Star[] = [];

  constructor(rng: Rng) {
    const layers = [
      { count: 70, speed: 8, size: 1, color: PALETTE.starFar },
      { count: 40, speed: 20, size: 1.5, color: PALETTE.starMid },
      { count: 18, speed: 42, size: 2.2, color: PALETTE.starNear },
    ];

    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        this.stars.push({
          x: rng.range(0, WORLD.width),
          y: rng.range(0, WORLD.height),
          size: layer.size,
          color: layer.color,
          speed: layer.speed,
        });
      }
    }
  }

  update(dt: number): void {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > WORLD.height) {
        star.y -= WORLD.height;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.fillStyle = star.color;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }
}
