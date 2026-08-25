import type { Camera } from './camera.js';
import type { Viewport } from '../core/viewport.js';
import type { World } from '../game/world.js';
import type { PowerUpKind } from '../game/entities.js';
import { DIFFICULTY, PALETTE, SHIP, WORLD } from '../config.js';
import { TAU, clamp, clamp01, lerp } from '../core/math.js';
import { Starfield } from './starfield.js';
import { createRng } from '../core/rng.js';
import { drawMeteor } from './meteors.js';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly starfield: Starfield;
  private time = 0;
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
    this.time += dt;
    this.starfield.update(dt);
  }

  draw(world: World, alpha: number, viewport: Viewport, camera: Camera, showShip = true): void {
    const { ctx } = this;

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.save();
    ctx.translate(camera.shakeX, camera.shakeY);

    this.drawBackdrop(ctx);
    this.starfield.draw(ctx);
    this.drawPowerUps(ctx, world, alpha);
    this.drawAsteroids(ctx, world, alpha);
    if (showShip) this.drawShip(ctx, world, alpha);
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

  private drawAsteroids(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.asteroids.forEach((a) => {
      drawMeteor(ctx, {
        x: lerp(a.px, a.x, alpha),
        y: lerp(a.py, a.y, alpha),
        r: a.r,
        rotation: a.rot,
        // The tail trails the direction of travel, so it follows the sideways
        // drift as well as the fall.
        heading: Math.atan2(a.vy, a.vx),
        speedRatio: clamp01(Math.hypot(a.vx, a.vy) / DIFFICULTY.absoluteMaxSpeed),
        shape: a.shape,
        skin: a.skin,
        time: this.time,
        effects: this.effectsEnabled,
      });
    });
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.powerUps.forEach((p) => {
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      const color = powerUpColor(p.kind);
      const bob = Math.sin(p.age * 3.4) * p.r * 0.14;
      const pulse = 1 + Math.sin(p.age * 6) * 0.07;

      ctx.save();
      ctx.translate(x, y + bob);
      ctx.scale(pulse, pulse);

      // Glossy capsule, so pickups read as rewards rather than hazards.
      if (this.effectsEnabled) {
        ctx.shadowColor = color;
        ctx.shadowBlur = p.r * 1.6;
      }

      const orb = ctx.createRadialGradient(-p.r * 0.32, -p.r * 0.36, p.r * 0.1, 0, 0, p.r * 1.15);
      orb.addColorStop(0, '#ffffff');
      orb.addColorStop(0.4, color);
      orb.addColorStop(1, shade(color));

      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, TAU);
      ctx.fillStyle = orb;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#0a1030';
      ctx.lineWidth = Math.max(1, p.r * 0.13);
      ctx.stroke();

      ctx.fillStyle = '#0a1030';
      drawPowerUpGlyph(ctx, p.kind, p.r);

      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-p.r * 0.34, -p.r * 0.42, p.r * 0.26, p.r * 0.15, -0.6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    });
  }

  private drawShip(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    const { ship } = world;
    if (!ship.alive) return;

    const x = lerp(ship.px, ship.x, alpha);
    const y = lerp(ship.py, ship.y, alpha);

    if (this.effectsEnabled) this.drawTrail(ctx, world);

    // Blink through post-hit invulnerability so the state is readable.
    const blinking = ship.invulnTime > 0 && Math.floor(ship.invulnTime * 12) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);
    // Bank into the direction of travel; it makes the craft feel like it has
    // mass rather than sliding around flat.
    ctx.rotate(clamp(ship.vx / SHIP.maxSpeed, -1, 1) * 0.42);

    if (!blinking) {
      this.drawEngineFlame(ctx, ship.r);
      this.drawHull(ctx, ship.r);
    }

    if (ship.shieldTime > 0) {
      const fading = ship.shieldTime < 1.5 && Math.floor(ship.shieldTime * 8) % 2 === 0;
      if (!fading) this.drawShieldBubble(ctx, ship.r);
    }

    ctx.restore();
  }

  private drawEngineFlame(ctx: CanvasRenderingContext2D, r: number): void {
    const flicker = 1 + Math.sin(this.time * 26) * 0.18;
    const length = r * 1.7 * flicker;

    const flame = ctx.createLinearGradient(0, r * 0.5, 0, r * 0.5 + length);
    flame.addColorStop(0, '#ffffff');
    flame.addColorStop(0.35, PALETTE.shipGlow);
    flame.addColorStop(1, 'transparent');

    if (this.effectsEnabled) {
      ctx.shadowColor = PALETTE.shipGlow;
      ctx.shadowBlur = r * 1.4;
    }
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.5 + length, 0, r * 0.5 + length);
    ctx.quadraticCurveTo(r * 0.2, r * 0.5 + length, r * 0.42, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private drawHull(ctx: CanvasRenderingContext2D, r: number): void {
    if (this.effectsEnabled) {
      ctx.shadowColor = PALETTE.shipGlow;
      ctx.shadowBlur = r * 1.6;
    }

    // Swept-back hull.
    const hull = ctx.createLinearGradient(0, -r * 1.3, 0, r);
    hull.addColorStop(0, '#ffffff');
    hull.addColorStop(0.45, PALETTE.ship);
    hull.addColorStop(1, '#1478a8');

    ctx.beginPath();
    ctx.moveTo(0, -r * 1.35);
    ctx.quadraticCurveTo(r * 0.72, -r * 0.1, r * 1.02, r * 0.72);
    ctx.quadraticCurveTo(r * 0.4, r * 0.42, 0, r * 0.6);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.42, -r * 1.02, r * 0.72);
    ctx.quadraticCurveTo(-r * 0.72, -r * 0.1, 0, -r * 1.35);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#06304a';
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.stroke();

    // Cockpit.
    ctx.fillStyle = '#0a2440';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.34, r * 0.3, r * 0.44, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#bff6ff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.09, -r * 0.46, r * 0.13, r * 0.2, -0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawShieldBubble(ctx: CanvasRenderingContext2D, r: number): void {
    const radius = r + 9;
    const bubble = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius);
    bubble.addColorStop(0, 'transparent');
    bubble.addColorStop(1, PALETTE.shield);

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    if (this.effectsEnabled) {
      ctx.shadowColor = PALETTE.shield;
      ctx.shadowBlur = 14;
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
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

/** Darkens a #rrggbb colour, for the shaded side of a glossy orb. */
function shade(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 0xff) * 0.45);
  const g = Math.round(((value >> 8) & 0xff) * 0.45);
  const b = Math.round((value & 0xff) * 0.45);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
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
