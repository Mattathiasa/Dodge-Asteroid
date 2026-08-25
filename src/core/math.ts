export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Hermite ease with zero derivative at both ends: f(0)=0, f(1)=1, f'(0)=f'(1)=0.
 *
 * This shape is why the difficulty curve eases in gently *and* plateaus, rather
 * than ramping linearly or — as the original implementation did — compounding
 * without any upper bound.
 */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Length of a vector given its components. */
export function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Squared distance — avoids a square root in hot collision paths. */
export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}
