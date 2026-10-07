import type { Rng } from '../core/types.js';
import { PALETTE, WORLD } from '../config.js';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  /** Scroll speed, in world units per second. */
  speed: number;
  /** Whether this star stretches into a streak when the field speeds up. */
  near: boolean;
}

/**
 * A three-layer parallax starfield.
 *
 * Stars are generated once and scrolled, so the background costs no allocation
 * per frame. The layers move at different speeds, which is what sells depth,
 * and the whole field speeds up with the run so the player feels the ramp
 * before they can measure it.
 */
export class Starfield {
  private readonly stars: Star[] = [];
  private pace = 1;

  constructor(rng: Rng) {
    const layers = [
      { count: 70, speed: 8, size: 1, color: PALETTE.starFar, near: false },
      { count: 40, speed: 20, size: 1.5, color: PALETTE.starMid, near: false },
      { count: 18, speed: 42, size: 2.2, color: PALETTE.starNear, near: true },
    ];

    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        this.stars.push({
          x: rng.range(0, WORLD.width),
          y: rng.range(0, WORLD.height),
          size: layer.size,
          color: layer.color,
          speed: layer.speed,
          near: layer.near,
        });
      }
    }
  }

  /** `pace` multiplies every layer's speed; it eases rather than jumping. */
  update(dt: number, pace = 1): void {
    this.pace += (pace - this.pace) * Math.min(1, dt * 2);
    for (const star of this.stars) {
      star.y += star.speed * this.pace * dt;
      if (star.y > WORLD.height) {
        star.y -= WORLD.height;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, streaks: boolean): void {
    // Near stars stretch along their motion once the field is moving fast.
    const stretch = streaks ? Math.max(0, this.pace - 1.3) * 6 : 0;
    for (const star of this.stars) {
      ctx.fillStyle = star.color;
      const length = star.near ? star.size + stretch : star.size;
      ctx.fillRect(star.x, star.y - length + star.size, star.size, length);
    }
  }
}
