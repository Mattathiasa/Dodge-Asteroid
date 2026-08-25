import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const first = Array.from({ length: 1000 }, () => a.next());
    const second = Array.from({ length: 1000 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('diverges for different seeds', () => {
    const a = Array.from({ length: 50 }, (_, i) => i).map(() => createRng(1).next());
    const b = createRng(2).next();
    expect(a[0]).not.toBe(b);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('range respects its bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.range(-5, 12);
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThan(12);
    }
  });

  it('int is inclusive on both ends', () => {
    const rng = createRng(21);
    expect(rng.int(3, 3)).toBe(3);

    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) seen.add(rng.int(0, 4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('pick returns a member and throws on an empty array', () => {
    const rng = createRng(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('chance is roughly calibrated', () => {
    const rng = createRng(31337);
    let hits = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i += 1) if (rng.chance(0.25)) hits += 1;
    expect(hits / trials).toBeGreaterThan(0.23);
    expect(hits / trials).toBeLessThan(0.27);
  });

  it('distributes roughly uniformly across buckets', () => {
    const rng = createRng(2024);
    const buckets = new Array<number>(10).fill(0);
    const samples = 100000;
    for (let i = 0; i < samples; i += 1) {
      const index = Math.floor(rng.next() * 10);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    // Every bucket should land within 10% of the expected 10000.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9000);
      expect(count).toBeLessThan(11000);
    }
  });
});
