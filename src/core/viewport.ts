import type { Vec2 } from './types.js';

/**
 * Device-pixel-ratio is capped so that a 3x phone display does not ask the
 * renderer to fill nine times the pixels for a difference nobody can see.
 */
export const DPR_CAP = 2;

/**
 * How the fixed-size world is mapped onto the canvas element.
 *
 * The world is a constant logical size, letterboxed into whatever space the
 * page gives it. Keeping that mapping in one pure function is what makes the
 * pointer land exactly on the ship — the original implementation applied a CSS
 * `translate(-50%, -50%)` *and* subtracted half the ship width in JavaScript,
 * so the ship rendered a full body-width away from the cursor.
 */
export interface Viewport {
  /** Canvas size in CSS pixels. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Canvas backing-store size in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpr: number;
  /** World units → CSS pixels. */
  readonly scale: number;
  /** Letterbox bars, in CSS pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export function computeViewport(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  worldWidth: number,
  worldHeight: number,
): Viewport {
  const dpr = Math.max(1, Math.min(devicePixelRatio, DPR_CAP));
  const scale = Math.min(cssWidth / worldWidth, cssHeight / worldHeight);
  const renderedWidth = worldWidth * scale;
  const renderedHeight = worldHeight * scale;

  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.round(cssWidth * dpr),
    pixelHeight: Math.round(cssHeight * dpr),
    dpr,
    scale,
    offsetX: (cssWidth - renderedWidth) / 2,
    offsetY: (cssHeight - renderedHeight) / 2,
  };
}

export interface ElementRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Converts a pointer/touch position in client coordinates into world
 * coordinates, undoing both the letterbox offset and the scale.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: ElementRect,
  worldWidth: number,
  worldHeight: number,
): Vec2 {
  const view = computeViewport(rect.width, rect.height, 1, worldWidth, worldHeight);
  if (view.scale === 0) return { x: worldWidth / 2, y: worldHeight / 2 };
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

/** Inverse of {@link screenToWorld}. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  rect: ElementRect,
  worldWidth: number,
  worldHeight: number,
): Vec2 {
  const view = computeViewport(rect.width, rect.height, 1, worldWidth, worldHeight);
  return {
    x: worldX * view.scale + view.offsetX + rect.left,
    y: worldY * view.scale + view.offsetY + rect.top,
  };
}
