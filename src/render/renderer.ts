import type { Camera } from './camera.js';
import type { Viewport } from '../core/viewport.js';
import type { World } from '../game/world.js';
import type { PowerUpKind } from '../game/entities.js';
import { PALETTE, SHIP, SPAWN, WORLD } from '../config.js';
import { TAU, lerp } from '../core/math.js';
import { Starfield } from './starfield.js';
import { createRng } from '../core/rng.js';

/** Pre-generated asteroid silhouettes: per-shape radius multipliers. */
const SHAPES: readonly (readonly number[])[] = buildShapes();

function buildShapes(): number[][] {
  const rng = createRng(0xa57e401d);
  return Array.from({ length: SPAWN.shapeCount }, () => {
    const points = rng.int(7, 10);
    return Array.from({ length: points }, () => rng.range(0.76, 1.16));
  });
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly starfield: Starfield;
  effectsEnabled = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    seed: number,
  ) {
    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) throw new Error('2D canvas context is unavailable');
    this.ctx = context;
    this.starfield = new Starfield(createRng(seed));
  }

  /**
   * Sizes the backing store to device pixels.
   *
   * Without this the canvas is upscaled by the browser and looks soft on any
   * high-density display, which is the fastest way to make a game look cheap.
   */
  resize(viewport: Viewport): void {
    if (this.canvas.width !== viewport.pixelWidth) this.canvas.width = viewport.pixelWidth;
    if (this.canvas.height !== viewport.pixelHeight) this.canvas.height = viewport.pixelHeight;
  }

  updateBackground(dt: number): void {
    this.starfield.update(dt);
  }

  draw(world: World, alpha: number, viewport: Viewport, camera: Camera): void {
    const { ctx } = this;

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, viewport.cssWidth, viewport.cssHeight);

    ctx.save();
    ctx.translate(viewport.offsetX + camera.shakeX, viewport.offsetY + camera.shakeY);
    ctx.scale(viewport.scale, viewport.scale);

    // Clip to the play field so nothing bleeds into the letterbox bars.
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.width, WORLD.height);
    ctx.clip();

    this.drawBackdrop(ctx);
    this.starfield.draw(ctx);
    this.drawPowerUps(ctx, world, alpha);
    this.drawAsteroids(ctx, world, alpha);
    this.drawShip(ctx, world, alpha);
    this.drawParticles(ctx, world, alpha);

    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createRadialGradient(
      WORLD.width / 2,
      WORLD.height * 0.35,
      0,
      WORLD.width / 2,
      WORLD.height * 0.35,
      WORLD.height * 0.9,
    );
    gradient.addColorStop(0, PALETTE.backgroundGlow);
    gradient.addColorStop(1, PALETTE.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  private glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
    if (!this.effectsEnabled) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  private clearGlow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowBlur = 0;
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.asteroids.forEach((a) => {
      const x = lerp(a.px, a.x, alpha);
      const y = lerp(a.py, a.y, alpha);
      const shape = SHAPES[a.shape % SHAPES.length] ?? [1];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.rot);

      ctx.beginPath();
      for (let i = 0; i < shape.length; i += 1) {
        const angle = (i / shape.length) * TAU;
        const radius = a.r * (shape[i] ?? 1);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = PALETTE.asteroidCore;
      ctx.fill();

      this.glow(ctx, PALETTE.asteroidGlow, 14);
      ctx.strokeStyle = PALETTE.asteroid;
      ctx.lineWidth = 2;
      ctx.stroke();
      this.clearGlow(ctx);

      ctx.restore();
    });
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.powerUps.forEach((p) => {
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      const color = powerUpColor(p.kind);
      const pulse = 1 + Math.sin(p.age * 6) * 0.08;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);

      this.glow(ctx, color, 18);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, TAU);
      ctx.stroke();
      this.clearGlow(ctx);

      ctx.fillStyle = color;
      drawPowerUpGlyph(ctx, p.kind, p.r);

      ctx.restore();
    });
  }

  private drawShip(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    const { ship } = world;
    const x = lerp(ship.px, ship.x, alpha);
    const y = lerp(ship.py, ship.y, alpha);

    if (!ship.alive) return;

    if (this.effectsEnabled) this.drawTrail(ctx, world);

    // Blink through post-hit invulnerability so the state is readable.
    const blinking = ship.invulnTime > 0 && Math.floor(ship.invulnTime * 12) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);

    if (!blinking) {
      this.glow(ctx, PALETTE.shipGlow, 20);
      ctx.fillStyle = PALETTE.ship;
      ctx.beginPath();
      ctx.arc(0, 0, ship.r, 0, TAU);
      ctx.fill();
      this.clearGlow(ctx);

      ctx.fillStyle = PALETTE.background;
      ctx.beginPath();
      ctx.arc(0, 0, ship.r * 0.45, 0, TAU);
      ctx.fill();
    }

    if (ship.shieldTime > 0) {
      const fading = ship.shieldTime < 1.5 && Math.floor(ship.shieldTime * 8) % 2 === 0;
      if (!fading) {
        this.glow(ctx, PALETTE.shield, 16);
        ctx.strokeStyle = PALETTE.shield;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, ship.r + 9, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.clearGlow(ctx);
      }
    }

    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D, world: World): void {
    const { trail } = world.ship;
    if (trail.length < 4) return;

    ctx.save();
    ctx.strokeStyle = PALETTE.shipTrail;
    ctx.lineCap = 'round';
    const segments = trail.length / 2 - 1;
    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      ctx.globalAlpha = t * 0.5;
      ctx.lineWidth = SHIP.radius * 0.9 * t;
      ctx.beginPath();
      ctx.moveTo(trail[i * 2] ?? 0, trail[i * 2 + 1] ?? 0);
      ctx.lineTo(trail[i * 2 + 2] ?? 0, trail[i * 2 + 3] ?? 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    ctx.save();
    world.particles.forEach((p) => {
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    });
    ctx.restore();
  }
}

function powerUpColor(kind: PowerUpKind): string {
  if (kind === 'shield') return PALETTE.powerShield;
  if (kind === 'slowmo') return PALETTE.powerSlowmo;
  return PALETTE.powerLife;
}

/** A small distinguishing mark, so the three pickups are not just colours. */
function drawPowerUpGlyph(ctx: CanvasRenderingContext2D, kind: PowerUpKind, r: number): void {
  const s = r * 0.5;
  ctx.beginPath();
  if (kind === 'shield') {
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.8, -s * 0.3);
    ctx.lineTo(s * 0.8, s * 0.4);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.8, s * 0.4);
    ctx.lineTo(-s * 0.8, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'slowmo') {
    ctx.arc(0, 0, s * 0.85, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.background;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(s * 0.42, s * 0.18);
    ctx.stroke();
  } else {
    // A heart-ish diamond for the extra life.
    ctx.moveTo(0, s * 0.9);
    ctx.lineTo(-s, -s * 0.15);
    ctx.lineTo(-s * 0.45, -s * 0.85);
    ctx.lineTo(0, -s * 0.35);
    ctx.lineTo(s * 0.45, -s * 0.85);
    ctx.lineTo(s, -s * 0.15);
    ctx.closePath();
    ctx.fill();
  }
}
