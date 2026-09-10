import type { Rng } from './types.js';

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * Chosen over `Math.random()` because it is seedable: the same seed always
 * produces the same run, which is what lets the spawner and the full-run
 * simulation be tested deterministically.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (minInclusive, maxInclusive) =>
      minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1)),
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError('cannot pick from an empty array');
      const item = items[Math.floor(next() * items.length)];
      // `noUncheckedIndexedAccess` widens the element type; the index is in range.
      return item as T;
    },
    chance: (p) => next() < p,
  };
}

/** A seed derived from the wall clock, for ordinary (non-test) play. */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
