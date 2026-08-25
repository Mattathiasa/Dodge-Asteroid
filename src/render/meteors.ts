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
    name: 'ember',
    bodyLight: '#ffc46b',
    bodyMid: '#f2792a',
    bodyDark: '#a8330d',
    outline: '#54160a',
    crater: '#a33a12',
    craterLip: '#ffb15e',
    trailHot: '#fff1a8',
    trailCool: '#ff5f1a',
    glow: '#ff8a2b',
  },
  {
    name: 'ice',
    bodyLight: '#dcf6ff',
    bodyMid: '#5cc4ef',
    bodyDark: '#1c6ba1',
    outline: '#0b2f4d',
    crater: '#2b7ba8',
    craterLip: '#a9e6ff',
    trailHot: '#eafcff',
    trailCool: '#31c6ff',
    glow: '#5ad2ff',
  },
  {
    name: 'toxic',
    bodyLight: '#e4ff8f',
    bodyMid: '#8fcf2f',
    bodyDark: '#3f7a12',
    outline: '#1d3a08',
    crater: '#4f8c17',
    craterLip: '#cdf76c',
    trailHot: '#f6ffc0',
    trailCool: '#8ade1f',
    glow: '#a8e93a',
  },
  {
    name: 'void',
    bodyLight: '#e0c4ff',
    bodyMid: '#9a5ce0',
    bodyDark: '#4b2091',
    outline: '#1f0b45',
    crater: '#5f2ea8',
    craterLip: '#d1a9ff',
    trailHot: '#f7e9ff',
    trailCool: '#a45cff',
    glow: '#b06bff',
  },
  {
    name: 'rose',
    bodyLight: '#ffc9ec',
    bodyMid: '#ff5fb4',
    bodyDark: '#b81a76',
    outline: '#4e0733',
    crater: '#c22585',
    craterLip: '#ffb0e0',
    trailHot: '#fff0fa',
    trailCool: '#ff4fb5',
    glow: '#ff6ec2',
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
}

export function drawMeteor(ctx: CanvasRenderingContext2D, o: MeteorDrawOptions): void {
  const skin = METEOR_SKINS[o.skin % METEOR_SKINS.length] ?? METEOR_SKINS[0];
  const silhouette = SILHOUETTES[o.shape % SILHOUETTES.length] ?? SILHOUETTES[0];
  if (skin === undefined || silhouette === undefined) return;

  const flicker = 1 + Math.sin(o.time * 14 + o.shape * 2.1) * 0.12;
  const tailLength = o.r * (3.6 + o.speedRatio * 5.2) * flicker;

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
