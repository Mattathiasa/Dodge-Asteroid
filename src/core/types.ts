/** A 2D point or vector, in world units. */
export interface Vec2 {
  x: number;
  y: number;
}

/** An immutable circle, used for collision queries. */
export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * A seeded pseudo-random number generator.
 *
 * The simulation draws every random value from one of these so that a run is a
 * pure function of its seed. That is what makes the spawner and the whole-run
 * simulation test deterministic.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number;
  /** Uniformly picks one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** True with probability `p`. */
  chance(p: number): boolean;
  readonly seed: number;
}
