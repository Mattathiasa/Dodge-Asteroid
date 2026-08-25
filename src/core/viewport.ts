import type { Vec2 } from './types.js';

/**
 * Device-pixel-ratio is capped so that a 3x phone display does not ask the
 * renderer to fill nine times the pixels for a difference nobody can see.
 */
export const DPR_CAP = 2;

/**
 * How the fixed-size world maps onto the canvas element.
 *
 * The canvas backing store is always the world's own aspect ratio, and CSS
 * scales the element to fit whatever space the page gives it. That removes the
 * letterbox arithmetic entirely: the renderer draws in world coordinates, and
 * the frame the player sees is exactly the play field on any screen shape.
 */
export interface Viewport {
  /** Displayed canvas size in CSS pixels. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Canvas backing-store size in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpr: number;
  /** World units per CSS pixel of the displayed element. */
  readonly scale: number;
}

export function computeViewport(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  worldWidth: number,
  worldHeight: number,
): Viewport {
  const dpr = Math.max(1, Math.min(devicePixelRatio, DPR_CAP));
  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.round(worldWidth * dpr),
    pixelHeight: Math.round(worldHeight * dpr),
    dpr,
    scale: cssWidth > 0 ? worldWidth / cssWidth : 1,
  };
}

/**
 * Fits the world into the available box, preserving its aspect ratio.
 *
 * Done here rather than in CSS because a percentage `max-height` does not
 * resolve against an auto-height parent, so the pure-CSS version overflowed on
 * short windows. One tested function beats an arrangement that silently breaks
 * on some screen shapes.
 */
export function fitDisplaySize(
  availableWidth: number,
  availableHeight: number,
  worldWidth: number,
  worldHeight: number,
): { width: number; height: number } {
  if (availableWidth <= 0 || availableHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  return { width: worldWidth * scale, height: worldHeight * scale };
}

export interface ElementRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Converts a pointer or touch position into world coordinates.
 *
 * The original game rendered the ship a full body-width from the cursor: the
 * stylesheet applied `translate(-50%, -50%)` while the script also subtracted
 * half its width. Keeping the mapping in one tested function is what stops that
 * class of bug.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: ElementRect,
  worldWidth: number,
  worldHeight: number,
): Vec2 {
  if (rect.width === 0 || rect.height === 0) {
    return { x: worldWidth / 2, y: worldHeight / 2 };
  }
  return {
    x: ((clientX - rect.left) / rect.width) * worldWidth,
    y: ((clientY - rect.top) / rect.height) * worldHeight,
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
  return {
    x: (worldX / worldWidth) * rect.width + rect.left,
    y: (worldY / worldHeight) * rect.height + rect.top,
  };
}
