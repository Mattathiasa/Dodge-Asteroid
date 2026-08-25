import { describe, expect, it } from 'vitest';
import { Pool } from './pool.js';

interface Item {
  alive: boolean;
  id: number;
}

const factory = (): Item => ({ alive: false, id: -1 });

describe('Pool', () => {
  it('spawns up to capacity and then refuses', () => {
    const pool = new Pool<Item>(factory, 3);
    expect(pool.spawn((i) => (i.id = 1))).not.toBeNull();
    expect(pool.spawn((i) => (i.id = 2))).not.toBeNull();
    expect(pool.spawn((i) => (i.id = 3))).not.toBeNull();
    expect(pool.spawn((i) => (i.id = 4))).toBeNull();
    expect(pool.active).toBe(3);
    expect(pool.capacity).toBe(3);
  });

  it('iterates only the active range', () => {
    const pool = new Pool<Item>(factory, 5);
    pool.spawn((i) => (i.id = 1));
    pool.spawn((i) => (i.id = 2));
    const seen: number[] = [];
    pool.forEach((i) => seen.push(i.id));
    expect(seen).toEqual([1, 2]);
  });

  it('compacts dead items out and preserves the survivors', () => {
    const pool = new Pool<Item>(factory, 8);
    for (let i = 0; i < 8; i += 1) pool.spawn((item) => (item.id = i));

    pool.forEach((item) => {
      if (item.id === 2 || item.id === 5 || item.id === 7) item.alive = false;
    });
    pool.compact();

    const survivors: number[] = [];
    pool.forEach((i) => survivors.push(i.id));
    expect(pool.active).toBe(5);
    expect(survivors.sort((a, b) => a - b)).toEqual([0, 1, 3, 4, 6]);
  });

  it('clear deactivates everything', () => {
    const pool = new Pool<Item>(factory, 4);
    pool.spawn((i) => (i.id = 1));
    pool.spawn((i) => (i.id = 2));
    pool.clear();
    expect(pool.active).toBe(0);
    let count = 0;
    pool.forEach(() => (count += 1));
    expect(count).toBe(0);
  });

  it('never grows across many spawn/kill cycles', () => {
    const pool = new Pool<Item>(factory, 16);
    for (let cycle = 0; cycle < 10000; cycle += 1) {
      pool.spawn((i) => (i.id = cycle));
      pool.forEach((i) => {
        if (i.id % 2 === 0) i.alive = false;
      });
      pool.compact();
      expect(pool.active).toBeLessThanOrEqual(pool.capacity);
    }
    expect(pool.capacity).toBe(16);
  });
});
