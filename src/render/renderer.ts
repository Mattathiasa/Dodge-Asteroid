import type { Camera } from './camera.js';
import type { Viewport } from '../core/viewport.js';
import type { World } from '../game/world.js';
import type { PowerUpKind } from '../game/entities.js';
import { COMETS, DIFFICULTY, PALETTE, SHIP, WORLD } from '../config.js';
import { TAU, clamp, clamp01, lerp } from '../core/math.js';
import { Backdrop } from './backdrop.js';
import { Effects } from './effects.js';
import { Starfield } from './starfield.js';
import { comboRemaining } from '../game/scoring.js';
import { createRng } from '../core/rng.js';
import { drawMeteor } from './meteors.js';

/** What the frame is showing, beyond the world itself. */
export interface Scene {
  readonly showShip: boolean;
  /** 0..1 position on the difficulty curve; paces the starfield and heat. */
  readonly intensity: number;
  /** Which sector's colours the backdrop should be in. */
  readonly sector: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly starfield: Starfield;
  private readonly backdrop = new Backdrop();
  readonly fx = new Effects();
  private time = 0;
  private effects = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    seed: number,
  ) {
    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) throw new Error('2D canvas context is unavailable');
    this.ctx = context;
    this.starfield = new Starfield(createRng(seed));
  }

  get effectsEnabled(): boolean {
    return this.effects;
  }

  /** Glow, flicker, drift, shockwaves and flashes; off when motion is reduced. */
  set effectsEnabled(enabled: boolean) {
    this.effects = enabled;
    this.fx.motion = enabled;
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

  /**
   * Advances everything that animates but is not simulated: the backdrop, the
   * starfield and the effects layer. Skipped during a hit-stop, so the whole
   * frame holds still together.
   */
  update(dt: number, scene: Scene, slowmo: boolean): void {
    this.fx.update(dt);
    this.backdrop.update(dt, scene.sector, scene.intensity, this.effects);
    if (!this.effects) return;
    this.time += dt;
    this.starfield.update(dt, (1 + scene.intensity * 1.8) * (slowmo ? 0.45 : 1));
  }

  /** Starts a fresh run on the opening sector's colours, with no leftover effects. */
  resetScene(): void {
    this.backdrop.jumpTo(0);
    this.fx.clear();
  }

  draw(world: World, alpha: number, viewport: Viewport, camera: Camera, scene: Scene): void {
    const { ctx } = this;

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.save();
    ctx.translate(camera.shakeX, camera.shakeY);

    this.backdrop.draw(ctx);
    this.starfield.draw(ctx, this.effects);
    this.drawCometLanes(ctx, world);
    this.drawShards(ctx, world, alpha);
    this.drawPowerUps(ctx, world, alpha);
    this.drawAsteroids(ctx, world, alpha);
    if (scene.showShip) this.drawShip(ctx, world, alpha);
    this.drawParticles(ctx, world, alpha);
    this.fx.drawWorld(ctx);

    ctx.restore();

    if (scene.showShip && world.ship.slowmoTime > 0) this.drawSlowmoTint(ctx, world);
    this.fx.drawScreen(ctx, WORLD.width, WORLD.height);
  }

  /**
   * The lane a comet is about to fall down.
   *
   * It brightens and pulses faster as launch approaches, and the warning badge
   * sits below the HUD so a score chip can never hide it.
   */
  private drawCometLanes(ctx: CanvasRenderingContext2D, world: World): void {
    world.asteroids.forEach((a) => {
      if (!a.comet || a.warn <= 0) return;
      const progress = clamp01(1 - a.warn / COMETS.warnSeconds);
      const pulse = this.effects ? 0.5 + 0.5 * Math.sin(this.time * (10 + progress * 26)) : 0.5;
      const half = a.r * 1.6;

      ctx.save();
      ctx.fillStyle = PALETTE.danger;
      ctx.globalAlpha = 0.05 + progress * 0.13 + pulse * 0.06;
      ctx.fillRect(a.x - half, 0, half * 2, WORLD.height);

      ctx.globalAlpha = 0.35 + progress * 0.45;
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -this.time * 90;
      ctx.beginPath();
      ctx.moveTo(a.x - half, 0);
      ctx.lineTo(a.x - half, WORLD.height);
      ctx.moveTo(a.x + half, 0);
      ctx.lineTo(a.x + half, WORLD.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // A sticker-style warning badge.
      const size = 15 * (1 + pulse * 0.12);
      ctx.globalAlpha = 1;
      ctx.translate(a.x, 80);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 1.05, size * 0.75);
      ctx.lineTo(-size * 1.05, size * 0.75);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = PALETTE.ink;
      ctx.stroke();
      ctx.fillStyle = PALETTE.danger;
      ctx.fill();
      ctx.fillStyle = PALETTE.bone;
      ctx.font = `${String(Math.round(size * 0.95))}px 'Bungee', 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, size * 0.18);
      ctx.restore();
    });
  }

  /** Spinning gems: a different shape from every hazard and every pickup. */
  private drawShards(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.shards.forEach((s) => {
      const x = lerp(s.px, s.x, alpha);
      const y = lerp(s.py, s.y, alpha);
      // Drawn a touch larger than the pickup radius, so a reward reads as one.
      const r = s.r * 1.15;
      // Squashing the width reads as a gem turning on its vertical axis.
      const turn = this.effects ? 0.55 + Math.abs(Math.cos(s.age * 2.6)) * 0.45 : 1;

      ctx.save();
      ctx.translate(x, y);

      if (this.effects) {
        ctx.shadowColor = PALETTE.shard;
        ctx.shadowBlur = r * 1.8;
      }

      ctx.scale(turn, 1);
      const gem = ctx.createLinearGradient(-r, -r * 1.4, r, r * 1.4);
      gem.addColorStop(0, PALETTE.shardCore);
      gem.addColorStop(0.45, PALETTE.shard);
      gem.addColorStop(1, '#e09a2c');

      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.lineTo(r * 0.9, 0);
      ctx.lineTo(0, r * 1.4);
      ctx.lineTo(-r * 0.9, 0);
      ctx.closePath();
      ctx.fillStyle = gem;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = PALETTE.ink;
      ctx.stroke();

      // One facet in shadow gives it a cut edge.
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#7a3a00';
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.lineTo(r * 0.9, 0);
      ctx.lineTo(0, r * 1.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // A glint that comes and goes.
      const glint = this.effects ? Math.max(0, Math.sin(s.age * 3.1)) : 0.6;
      if (glint > 0.05) {
        ctx.save();
        ctx.globalAlpha = glint;
        ctx.fillStyle = '#ffffff';
        ctx.translate(x - r * 0.25, y - r * 0.55);
        const g = r * 0.55 * glint;
        ctx.beginPath();
        ctx.moveTo(0, -g);
        ctx.lineTo(g * 0.22, 0);
        ctx.lineTo(0, g);
        ctx.lineTo(-g * 0.22, 0);
        ctx.closePath();
        ctx.moveTo(-g, 0);
        ctx.lineTo(0, g * 0.22);
        ctx.lineTo(g, 0);
        ctx.lineTo(0, -g * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
  }

  /** A warm wash at the edges of the field while time is dilated. */
  private drawSlowmoTint(ctx: CanvasRenderingContext2D, world: World): void {
    const strength = clamp01(world.ship.slowmoTime / 0.6) * 0.26;
    const cx = WORLD.width / 2;
    const cy = WORLD.height / 2;
    const tint = ctx.createRadialGradient(cx, cy, WORLD.height * 0.28, cx, cy, WORLD.height * 0.72);
    tint.addColorStop(0, withAlpha(PALETTE.powerSlowmo, 0));
    tint.addColorStop(1, withAlpha(PALETTE.powerSlowmo, strength));
    ctx.save();
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.restore();
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    world.asteroids.forEach((a) => {
      // A comet still waiting above the field is shown by its lane alone.
      if (a.warn > 0) return;
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
        effects: this.effects,
        tailScale: a.comet ? 1.7 : 1,
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
      if (this.effects) {
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

      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = Math.max(1, p.r * 0.13);
      ctx.stroke();

      ctx.fillStyle = PALETTE.ink;
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

    if (this.effects) this.drawTrail(ctx, world);

    // Blink through post-hit invulnerability so the state is readable.
    const blinking = ship.invulnTime > 0 && Math.floor(ship.invulnTime * 12) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);

    this.drawComboRing(ctx, world);

    if (ship.shieldTime > 0) {
      const fading = ship.shieldTime < 1.5 && Math.floor(ship.shieldTime * 8) % 2 === 0;
      if (!fading) this.drawShieldBubble(ctx, ship.r, ship.shieldTime / SHIP.shieldSeconds);
    }

    // Bank into the direction of travel; it makes the craft feel like it has
    // mass rather than sliding around flat.
    ctx.rotate(clamp(ship.vx / SHIP.maxSpeed, -1, 1) * 0.42);

    if (!blinking) {
      this.drawEngineFlame(ctx, ship.r);
      this.drawHull(ctx, ship.r);
    }

    ctx.restore();
  }

  /**
   * The combo timer, drawn round the ship.
   *
   * The combo lapses if the next near miss does not come in time. Putting that
   * clock where the player is already looking makes it something they can play
   * against, rather than a number in a corner they never read.
   */
  private drawComboRing(ctx: CanvasRenderingContext2D, world: World): void {
    const remaining = comboRemaining(world.score, world.clockMs);
    if (remaining <= 0) return;
    const radius = world.ship.r + 15;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = PALETTE.combo;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = 0.95;
    if (this.effects) {
      ctx.shadowColor = PALETTE.combo;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + remaining * TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawEngineFlame(ctx: CanvasRenderingContext2D, r: number): void {
    const flicker = 1 + Math.sin(this.time * 26) * 0.18;
    const length = r * 1.7 * flicker;

    const flame = ctx.createLinearGradient(0, r * 0.5, 0, r * 0.5 + length);
    flame.addColorStop(0, '#ffffff');
    flame.addColorStop(0.35, PALETTE.shipGlow);
    flame.addColorStop(1, 'transparent');

    if (this.effects) {
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
    if (this.effects) {
      ctx.shadowColor = PALETTE.shipGlow;
      ctx.shadowBlur = r * 1.6;
    }

    // Swept-back hull.
    const hull = ctx.createLinearGradient(0, -r * 1.3, 0, r);
    hull.addColorStop(0, '#ffffff');
    hull.addColorStop(0.45, PALETTE.ship);
    hull.addColorStop(1, PALETTE.shipShade);

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
    ctx.strokeStyle = PALETTE.shipOutline;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.stroke();

    // Cockpit.
    ctx.fillStyle = PALETTE.shipCockpit;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.34, r * 0.3, r * 0.44, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#e2fff7';
    ctx.beginPath();
    ctx.ellipse(-r * 0.09, -r * 0.46, r * 0.13, r * 0.2, -0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** The bubble, with its rim drawn as a countdown of the time it has left. */
  private drawShieldBubble(ctx: CanvasRenderingContext2D, r: number, remaining: number): void {
    const radius = r + 9;
    const bubble = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius);
    bubble.addColorStop(0, 'transparent');
    bubble.addColorStop(1, PALETTE.shield);

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();

    if (this.effects) {
      ctx.shadowColor = PALETTE.shield;
      ctx.shadowBlur = 14;
    }
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + clamp01(remaining) * TAU);
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

  /**
   * Particles are drawn as sparks: short streaks along their velocity, added
   * onto what is behind them so overlapping sparks bloom instead of stacking.
   * Drag shortens each streak as the spark slows, for free.
   */
  private drawParticles(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
    ctx.save();
    if (this.effects) ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    world.particles.forEach((p) => {
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(x - p.vx * 0.035, y - p.vy * 0.035);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    ctx.restore();
  }
}

/** A #rrggbb colour at the given opacity. */
function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${alpha.toFixed(3)})`;
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
