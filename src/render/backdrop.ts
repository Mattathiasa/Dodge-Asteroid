import { PALETTE, WORLD } from '../config.js';
import { TAU } from '../core/math.js';

type Rgb = [number, number, number];

/**
 * Nebula colours for each sector, in the same order as `SECTOR_TABLE`.
 *
 * Each pair tints the field toward that sector's rock colour family, so a new
 * sector is visible at a glance rather than only announced.
 */
const NEBULAE: readonly (readonly [string, string])[] = [
  ['#3a1f7d', '#6d1b5e'],
  ['#5c1f2f', '#9a3a12'],
  ['#123a6b', '#1d6a86'],
  ['#163d2a', '#4a6614'],
  ['#2a1060', '#5b1f9a'],
  ['#5e1046', '#9c1d68'],
];

interface Cloud {
  x: number;
  y: number;
  radius: number;
  /** Scroll speed, world units per second. Slower than the slowest stars. */
  speed: number;
  /** Which of the two sector colours this cloud takes. */
  tone: 0 | 1;
  alpha: number;
}

function parse(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${String(Math.round(color[0]))}, ${String(Math.round(color[1]))}, ${String(
    Math.round(color[2]),
  )}, ${alpha.toFixed(3)})`;
}

function nebulaFor(sector: number): readonly [Rgb, Rgb] {
  const safe = Math.max(0, Math.floor(sector));
  // Past the table, cycle the coloured sectors the way `sectorInfo` names them.
  const index = safe < NEBULAE.length ? safe : 1 + ((safe - NEBULAE.length) % (NEBULAE.length - 1));
  const pair = NEBULAE[index] ?? NEBULAE[0] ?? ['#3a1f7d', '#6d1b5e'];
  return [parse(pair[0]), parse(pair[1])];
}

/**
 * The deep background: a slow nebula whose colour follows the sector, and a
 * glow that warms as the run intensifies.
 *
 * Colours blend over a couple of seconds rather than cutting, so a sector
 * change reads as flying into somewhere new rather than a palette swap.
 */
export class Backdrop {
  private readonly clouds: Cloud[] = [
    { x: 90, y: 160, radius: 300, speed: 3, tone: 0, alpha: 0.5 },
    { x: 400, y: 470, radius: 280, speed: 4.5, tone: 1, alpha: 0.42 },
    { x: 220, y: -240, radius: 340, speed: 2.4, tone: 1, alpha: 0.36 },
    { x: 360, y: 860, radius: 240, speed: 5.5, tone: 0, alpha: 0.4 },
  ];
  private readonly current: [Rgb, Rgb];
  private target: readonly [Rgb, Rgb];
  private intensity = 0;

  constructor() {
    const initial = nebulaFor(0);
    this.current = [[...initial[0]], [...initial[1]]];
    this.target = initial;
  }

  /**
   * Blends toward the sector's colours. `drift` moves the clouds; colour still
   * changes without it, since a change of colour is not motion.
   */
  update(dt: number, sector: number, intensity: number, drift = true): void {
    this.target = nebulaFor(sector);
    const blend = Math.min(1, dt * 0.9);
    for (let tone = 0; tone < 2; tone += 1) {
      const from = this.current[tone];
      const to = this.target[tone];
      if (from === undefined || to === undefined) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        from[channel] = (from[channel] ?? 0) + ((to[channel] ?? 0) - (from[channel] ?? 0)) * blend;
      }
    }
    this.intensity += (intensity - this.intensity) * Math.min(1, dt * 0.5);

    if (!drift) return;
    for (const cloud of this.clouds) {
      cloud.y += cloud.speed * dt;
      if (cloud.y - cloud.radius > WORLD.height) cloud.y = -cloud.radius;
    }
  }

  /** Snaps straight to a sector's colours, for a fresh run. */
  jumpTo(sector: number): void {
    const target = nebulaFor(sector);
    this.current[0] = [...target[0]];
    this.current[1] = [...target[1]];
    this.target = target;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const cx = WORLD.width / 2;
    const cy = WORLD.height * 0.35;
    const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, WORLD.height * 0.9);
    base.addColorStop(0, PALETTE.backgroundGlow);
    base.addColorStop(1, PALETTE.background);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    for (const cloud of this.clouds) {
      const color = this.current[cloud.tone];
      const gradient = ctx.createRadialGradient(
        cloud.x,
        cloud.y,
        0,
        cloud.x,
        cloud.y,
        cloud.radius,
      );
      gradient.addColorStop(0, rgba(color, cloud.alpha));
      gradient.addColorStop(0.55, rgba(color, cloud.alpha * 0.35));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, TAU);
      ctx.fill();
    }

    // Heat rising from the bottom of the field as the run intensifies.
    if (this.intensity > 0.02) {
      const heat = ctx.createLinearGradient(0, WORLD.height, 0, WORLD.height * 0.45);
      heat.addColorStop(0, rgba(this.current[1], 0.38 * this.intensity));
      heat.addColorStop(1, rgba(this.current[1], 0));
      ctx.fillStyle = heat;
      ctx.fillRect(0, WORLD.height * 0.45, WORLD.width, WORLD.height * 0.55);
    }
  }
}
