import type { Vec2 } from '../core/types.js';
import type { Body, Ship } from './entities.js';
import { SHIP } from '../config.js';

export interface SteerInput {
  /** Pointer/touch target in world coordinates, or `null` when steering by key. */
  readonly target: Vec2 | null;
  /** Keyboard axis, magnitude at most 1. */
  readonly axis: Vec2;
}

export interface Bounds {
  readonly width: number;
  readonly height: number;
}

/**
 * Accelerates the ship toward the player's intent.
 *
 * Pointer and keyboard both feed the same acceleration model, so the ship has
 * weight and the two input methods feel like the same craft. The original
 * assigned the mouse position straight to the element's CSS `left`/`top`,
 * which teleported it.
 */
export function steerToward(ship: Ship, input: SteerInput, dt: number): void {
  if (input.target !== null) {
    const dx = input.target.x - ship.x;
    const dy = input.target.y - ship.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.0001) {
      const strength = Math.min(1, distance / 60);
      ship.vx += (dx / distance) * SHIP.accel * strength * dt;
      ship.vy += (dy / distance) * SHIP.accel * strength * dt;
    }
  } else {
    ship.vx += input.axis.x * SHIP.keyboardAccel * dt;
    ship.vy += input.axis.y * SHIP.keyboardAccel * dt;
  }

  // Exponential damping, applied per-second so it is frame-rate independent.
  const retained = Math.pow(SHIP.damping, dt);
  ship.vx *= retained;
  ship.vy *= retained;

  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > SHIP.maxSpeed) {
    const scale = SHIP.maxSpeed / speed;
    ship.vx *= scale;
    ship.vy *= scale;
  }
}

/** Advances a body, recording its previous position for render interpolation. */
export function integrate(body: Body, dt: number): void {
  body.px = body.x;
  body.py = body.y;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

/** Keeps a body fully inside the field, killing any inward velocity at the wall. */
export function clampToBounds(body: Body, bounds: Bounds): void {
  const minX = body.r;
  const maxX = bounds.width - body.r;
  const minY = body.r;
  const maxY = bounds.height - body.r;

  if (body.x < minX) {
    body.x = minX;
    if (body.vx < 0) body.vx = 0;
  } else if (body.x > maxX) {
    body.x = maxX;
    if (body.vx > 0) body.vx = 0;
  }

  if (body.y < minY) {
    body.y = minY;
    if (body.vy < 0) body.vy = 0;
  } else if (body.y > maxY) {
    body.y = maxY;
    if (body.vy > 0) body.vy = 0;
  }
}

/** Normalizes a keyboard axis so diagonals are not faster than the cardinals. */
export function normalizeAxis(x: number, y: number): Vec2 {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1) return { x, y };
  return { x: x / magnitude, y: y / magnitude };
}
