import type { Rng } from '../core/types.js';
import { TAU, clamp01 } from '../core/math.js';
import { Pool } from '../game/pool.js';
import { createRng } from '../core/rng.js';
import { METEOR_SKINS } from './meteors.js';
import { PALETTE } from '../config.js';

/** A short label that pops where something happened, then rises and fades. */
interface Floater {
  alive: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

/** An expanding shockwave. */
interface Ring {
  alive: boolean;
  x: number;
  y: number;
  from: number;
  to: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

/** A tumbling fragment of rock, in the colours of the rock it came from. */
interface Chunk {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  life: number;
  maxLife: number;
  fill: string;
  outline: string;
  /** Per-vertex radius multipliers, so no two chunks are the same shape. */
  a: number;
  b: number;
  c: number;
}

const FONT = "'Bungee', 'Outfit', system-ui, sans-serif";

/**
 * Presentation-only effects: score popups, shockwaves, debris and flashes.
 *
 * These live outside the simulation on purpose. They are a reaction to what
 * the simulation reported, they never influence it, and they use their own
 * random stream — so turning every one of them off cannot change a run.
 */
export class Effects {
  private readonly floaters = new Pool<Floater>(
    () => ({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '', size: 0 }),
    24,
  );
  private readonly rings = new Pool<Ring>(
    () => ({
      alive: false,
      x: 0,
      y: 0,
      from: 0,
      to: 0,
      life: 0,
      maxLife: 1,
      color: '',
      width: 0,
    }),
    24,
  );
  private readonly chunks = new Pool<Chunk>(
    () => ({
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      spin: 0,
      size: 0,
      life: 0,
      maxLife: 1,
      fill: '',
      outline: '',
      a: 1,
      b: 1,
      c: 1,
    }),
    96,
  );
  private readonly rng: Rng = createRng(0xf1a5);
  private flashColor = '#ffffff';
  private flashAlpha = 0;

  /** Motion-heavy effects (shockwaves, debris, flashes) honour reduced motion. */
  motion = true;

  floater(x: number, y: number, text: string, color: string, size = 15): void {
    this.floaters.spawn((f) => {
      f.x = x;
      f.y = y;
      f.life = 0.9;
      f.maxLife = 0.9;
      f.text = text;
      f.color = color;
      f.size = size;
    });
  }

  ring(
    x: number,
    y: number,
    from: number,
    to: number,
    color: string,
    seconds = 0.45,
    width = 3,
  ): void {
    if (!this.motion) return;
    this.rings.spawn((r) => {
      r.x = x;
      r.y = y;
      r.from = from;
      r.to = to;
      r.life = seconds;
      r.maxLife = seconds;
      r.color = color;
      r.width = width;
    });
  }

  /** Breaks a rock into chunks in its own colours. */
  debris(x: number, y: number, radius: number, skin: number, count: number): void {
    if (!this.motion) return;
    const palette = METEOR_SKINS[skin % METEOR_SKINS.length] ?? METEOR_SKINS[0];
    if (palette === undefined) return;
    const { rng } = this;
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, TAU);
      const speed = rng.range(60, 260);
      const spawned = this.chunks.spawn((c) => {
        c.x = x + Math.cos(angle) * radius * 0.4;
        c.y = y + Math.sin(angle) * radius * 0.4;
        c.vx = Math.cos(angle) * speed;
        c.vy = Math.sin(angle) * speed - 40;
        c.rot = rng.range(0, TAU);
        c.spin = rng.range(-9, 9);
        c.size = rng.range(radius * 0.18, radius * 0.38);
        c.life = rng.range(0.55, 1.1);
        c.maxLife = c.life;
        c.fill = rng.chance(0.5) ? palette.bodyMid : palette.bodyLight;
        c.outline = palette.outline;
        c.a = rng.range(0.7, 1.2);
        c.b = rng.range(0.7, 1.2);
        c.c = rng.range(0.7, 1.2);
      });
      if (spawned === null) return;
    }
  }

  /**
   * Tints the whole field for an instant. Kept faint and single: a strong or
   * repeated full-screen flash is a photosensitivity hazard, not polish.
   */
  flash(color: string, strength: number): void {
    if (!this.motion) return;
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, Math.min(strength, 0.25));
  }

  clear(): void {
    this.floaters.clear();
    this.rings.clear();
    this.chunks.clear();
    this.flashAlpha = 0;
  }

  update(dt: number): void {
    this.floaters.forEach((f) => {
      f.life -= dt;
      if (f.life <= 0) f.alive = false;
    });
    this.floaters.compact();

    this.rings.forEach((r) => {
      r.life -= dt;
      if (r.life <= 0) r.alive = false;
    });
    this.rings.compact();

    const drag = Math.pow(0.08, dt);
    this.chunks.forEach((c) => {
      c.life -= dt;
      if (c.life <= 0) {
        c.alive = false;
        return;
      }
      c.vx *= drag;
      c.vy = c.vy * drag + 160 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.spin * dt;
    });
    this.chunks.compact();

    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
  }

  /** Draws everything that lives in the world, inside the camera transform. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    this.drawRings(ctx);
    this.drawChunks(ctx);
    this.drawFloaters(ctx);
  }

  /** Draws full-field overlays, outside the camera transform. */
  drawScreen(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.flashAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flashAlpha;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawRings(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.rings.forEach((r) => {
      const t = 1 - r.life / r.maxLife;
      const eased = 1 - (1 - t) * (1 - t);
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.from + (r.to - r.from) * eased, 0, TAU);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawChunks(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineJoin = 'round';
    this.chunks.forEach((c) => {
      ctx.globalAlpha = clamp01((c.life / c.maxLife) * 1.6);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.beginPath();
      ctx.moveTo(c.size * c.a, 0);
      ctx.lineTo(-c.size * 0.6 * c.b, c.size * 0.8 * c.c);
      ctx.lineTo(-c.size * 0.7 * c.c, -c.size * 0.7 * c.a);
      ctx.closePath();
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = Math.max(1, c.size * 0.22);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    this.floaters.forEach((f) => {
      const age = f.maxLife - f.life;
      // Pop in slightly oversized, settle, then rise and fade.
      const pop = this.motion ? 1 + Math.max(0, 0.12 - age) * 3.2 : 1;
      const rise = this.motion ? (1 - Math.pow(1 - clamp01(age / f.maxLife), 2)) * 34 : 0;
      ctx.globalAlpha = clamp01((f.life / f.maxLife) * 2.4);
      ctx.font = `${String(Math.round(f.size * pop))}px ${FONT}`;
      ctx.lineWidth = Math.max(3, f.size * 0.36);
      ctx.strokeStyle = PALETTE.ink;
      ctx.strokeText(f.text, f.x, f.y - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - rise);
    });
    ctx.restore();
  }
}
