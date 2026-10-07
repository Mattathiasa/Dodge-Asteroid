import type { Rng } from '../core/types.js';
import { TAU } from '../core/math.js';
import { createRng } from '../core/rng.js';

/**
 * A meteor's colour family.
 *
 * Each hazard is drawn as a glossy, cratered rock with a burning tail rather
 * than a flat circle, so the field reads as a real arcade game at a glance and
 * players can tell the variants apart by colour alone.
 */
export interface MeteorSkin {
  readonly name: string;
  readonly bodyLight: string;
  readonly bodyMid: string;
  readonly bodyDark: string;
  readonly outline: string;
  readonly crater: string;
  readonly craterLip: string;
  readonly trailHot: string;
  readonly trailCool: string;
  readonly glow: string;
}

export const METEOR_SKINS: readonly MeteorSkin[] = [
  {
    name: 'rust',
    bodyLight: '#ffbf94',
    bodyMid: '#e8673d',
    bodyDark: '#93300f',
    outline: '#3d1206',
    crater: '#a33d17',
    craterLip: '#ffb489',
    trailHot: '#ffeccc',
    trailCool: '#ff6a3d',
    glow: '#ff7c4d',
  },
  {
    name: 'sand',
    bodyLight: '#fff4d8',
    bodyMid: '#e3c184',
    bodyDark: '#97703c',
    outline: '#3a2a10',
    crater: '#b48d50',
    craterLip: '#fff1cc',
    trailHot: '#fffbf0',
    trailCool: '#eab865',
    glow: '#f5cf86',
  },
  {
    name: 'kelp',
    bodyLight: '#e6f59a',
    bodyMid: '#9fc33a',
    bodyDark: '#4c6b14',
    outline: '#1e2e06',
    crater: '#5e8519',
    craterLip: '#d7ef7f',
    trailHot: '#f4ffc8',
    trailCool: '#a6d23a',
    glow: '#b5df4a',
  },
  {
    name: 'urchin',
    bodyLight: '#e6ccff',
    bodyMid: '#9b63e8',
    bodyDark: '#4a2296',
    outline: '#1d0b42',
    crater: '#6233ad',
    craterLip: '#d6b3ff',
    trailHot: '#f6ebff',
    trailCool: '#a866ff',
    glow: '#b47aff',
  },
  {
    name: 'coral',
    bodyLight: '#ffd0de',
    bodyMid: '#ff6f96',
    bodyDark: '#b3264f',
    outline: '#4d0a1f',
    crater: '#c93460',
    craterLip: '#ffb6ca',
    trailHot: '#fff0f4',
    trailCool: '#ff5a86',
    glow: '#ff7da0',
  },
  // Comets only. White-hot with a tail in the warning-lane red, so the thing
  // that falls is visibly the thing the lane warned about.
  {
    name: 'comet',
    bodyLight: '#ffffff',
    bodyMid: '#ffe4ea',
    bodyDark: '#ff7d98',
    outline: '#4d0618',
    crater: '#ffb3c3',
    craterLip: '#ffffff',
    trailHot: '#fff4ec',
    trailCool: '#ff3d6e',
    glow: '#ff8ca4',
  },
] as const;

interface Crater {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly squash: number;
  readonly tilt: number;
}

interface Silhouette {
  /** Per-vertex radius multipliers, giving each rock its own lumpy outline. */
  readonly radii: readonly number[];
  readonly craters: readonly Crater[];
}

/** Rock shapes are generated once from a fixed seed, so they never change. */
export const SILHOUETTES: readonly Silhouette[] = buildSilhouettes(createRng(0xa57e401d), 6);

function buildSilhouettes(rng: Rng, count: number): Silhouette[] {
  return Array.from({ length: count }, () => {
    const vertices = rng.int(9, 12);
    const radii = Array.from({ length: vertices }, () => rng.range(0.86, 1.1));

    const craters: Crater[] = [];
    const craterCount = rng.int(3, 5);
    for (let i = 0; i < craterCount; i += 1) {
      // Keep craters inside the rim so none of them clip the outline.
      const angle = rng.range(0, TAU);
      const distance = rng.range(0.05, 0.5);
      craters.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        r: rng.range(0.13, 0.26),
        squash: rng.range(0.55, 0.85),
        tilt: rng.range(0, TAU),
      });
    }
    return { radii, craters };
  });
}

function traceRock(ctx: CanvasRenderingContext2D, r: number, radii: readonly number[]): void {
  ctx.beginPath();
  for (let i = 0; i < radii.length; i += 1) {
    const angle = (i / radii.length) * TAU;
    const radius = r * (radii[i] ?? 1);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draws the burning tail.
 *
 * Called with the context already rotated so the tail runs along -X, which
 * keeps the flame pointing opposite the direction of travel.
 */
function drawTail(
  ctx: CanvasRenderingContext2D,
  r: number,
  length: number,
  skin: MeteorSkin,
  flicker: number,
): void {
  // Three stacked layers, widest and coolest on the outside, narrowest and
  // hottest in the middle. That is what gives the reference art its depth,
  // rather than a single translucent wedge.
  const layers = [
    { width: 1.06, reach: 1, color: skin.trailCool, alpha: 0.72 },
    { width: 0.68, reach: 0.74, color: skin.trailCool, alpha: 0.85 },
    { width: 0.36, reach: 0.46, color: skin.trailHot, alpha: 0.95 },
  ];

  for (const layer of layers) {
    const reach = length * layer.reach;
    const half = r * layer.width;
    // A slight sway makes the flame feel alive without animating geometry.
    const sway = r * 0.22 * (flicker - 1) * 6;

    const gradient = ctx.createLinearGradient(0, 0, -reach, 0);
    gradient.addColorStop(0, layer.color);
    gradient.addColorStop(0.55, layer.color);
    gradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(r * 0.42, -half);
    ctx.bezierCurveTo(-reach * 0.3, -half * 1.02, -reach * 0.62, -half * 0.44 + sway, -reach, sway);
    ctx.bezierCurveTo(-reach * 0.62, half * 0.44 + sway, -reach * 0.3, half * 1.02, r * 0.42, half);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export interface MeteorDrawOptions {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly rotation: number;
  /** Direction of travel, radians. */
  readonly heading: number;
  /** 0..1, scales tail length. */
  readonly speedRatio: number;
  readonly shape: number;
  readonly skin: number;
  /** Animates the flame. */
  readonly time: number;
  readonly effects: boolean;
  /** Multiplies the tail length; comets burn longer. */
  readonly tailScale?: number;
}

export function drawMeteor(ctx: CanvasRenderingContext2D, o: MeteorDrawOptions): void {
  const skin = METEOR_SKINS[o.skin % METEOR_SKINS.length] ?? METEOR_SKINS[0];
  const silhouette = SILHOUETTES[o.shape % SILHOUETTES.length] ?? SILHOUETTES[0];
  if (skin === undefined || silhouette === undefined) return;

  const flicker = 1 + Math.sin(o.time * 14 + o.shape * 2.1) * 0.12;
  const tailLength = o.r * (3.6 + o.speedRatio * 5.2) * flicker * (o.tailScale ?? 1);

  ctx.save();
  ctx.translate(o.x, o.y);

  // Tail, drawn behind the rock in the frame of the direction of travel.
  ctx.save();
  ctx.rotate(o.heading);
  drawTail(ctx, o.r, tailLength, skin, flicker);
  ctx.restore();

  if (o.effects) {
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = o.r * 1.1;
  }

  ctx.rotate(o.rotation);

  // Body: lit from the upper left, dark at the lower right.
  const body = ctx.createRadialGradient(-o.r * 0.34, -o.r * 0.38, o.r * 0.12, 0, 0, o.r * 1.28);
  body.addColorStop(0, skin.bodyLight);
  body.addColorStop(0.45, skin.bodyMid);
  body.addColorStop(1, skin.bodyDark);

  traceRock(ctx, o.r, silhouette.radii);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineJoin = 'round';
  ctx.strokeStyle = skin.outline;
  ctx.lineWidth = Math.max(1.2, o.r * 0.15);
  ctx.stroke();

  // Craters, clipped to the rock so none of them spill over the rim.
  ctx.save();
  traceRock(ctx, o.r, silhouette.radii);
  ctx.clip();

  for (const crater of silhouette.craters) {
    const cx = crater.x * o.r;
    const cy = crater.y * o.r;
    const cr = crater.r * o.r;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(crater.tilt);

    ctx.fillStyle = skin.crater;
    ctx.beginPath();
    ctx.ellipse(0, 0, cr, cr * crater.squash, 0, 0, TAU);
    ctx.fill();

    // A lit lip along the lower edge reads as depth.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = skin.craterLip;
    ctx.lineWidth = Math.max(0.8, cr * 0.28);
    ctx.beginPath();
    ctx.ellipse(0, cr * 0.1, cr * 0.92, cr * crater.squash * 0.92, 0, 0.15 * TAU, 0.42 * TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // Gloss highlight.
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-o.r * 0.36, -o.r * 0.44, o.r * 0.3, o.r * 0.17, -0.6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
  ctx.restore();
}
