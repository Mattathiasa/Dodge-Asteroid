import type { Circle, Vec2 } from '../core/types.js';
import { distanceSq } from '../core/math.js';

/** Discrete overlap test. Compares squared distances to avoid a square root. */
export function circlesOverlap(a: Circle, b: Circle): boolean {
  const radii = a.r + b.r;
  return distanceSq(a.x, a.y, b.x, b.y) < radii * radii;
}

/**
 * Continuous circle-vs-circle collision.
 *
 * Returns the time of impact as a fraction of this step, in [0, 1], or `null`
 * if the two never touch during it.
 *
 * The original tested for overlap 100 times a second against positions that
 * jumped between samples, so a fast asteroid could pass clean through the ship
 * between two tests. Solving for the impact time along the relative motion
 * closes that gap and — more usefully — makes the result identical on a slow
 * device and a fast one.
 */
export function sweptCircleToi(a: Circle, aDelta: Vec2, b: Circle, bDelta: Vec2): number | null {
  const radii = a.r + b.r;

  // Relative position and motion of `a` with respect to `b`.
  const px = a.x - b.x;
  const py = a.y - b.y;
  const vx = aDelta.x - bDelta.x;
  const vy = aDelta.y - bDelta.y;

  // Already touching at the start of the step.
  if (px * px + py * py <= radii * radii) return 0;

  // |p + t*v|^2 = radii^2  ->  (v.v)t^2 + 2(p.v)t + (p.p - radii^2) = 0
  const qa = vx * vx + vy * vy;
  if (qa === 0) return null; // no relative motion, and not already touching

  const qb = 2 * (px * vx + py * vy);
  const qc = px * px + py * py - radii * radii;

  const discriminant = qb * qb - 4 * qa * qc;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  // The earlier root is the entry point.
  const t = (-qb - root) / (2 * qa);
  if (t < 0 || t > 1) return null;
  return t;
}

/** Close, but not touching — used to award near-miss combo bonuses. */
export function isNearMiss(a: Circle, b: Circle, margin: number): boolean {
  const inner = a.r + b.r;
  const outer = inner + margin;
  const d2 = distanceSq(a.x, a.y, b.x, b.y);
  return d2 >= inner * inner && d2 < outer * outer;
}
