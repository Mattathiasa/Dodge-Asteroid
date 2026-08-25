/**
 * A fixed-capacity object pool.
 *
 * Entities are allocated once up front and reused, so a long run does no
 * per-frame allocation and never triggers a garbage-collection pause mid-dodge.
 * The pool deliberately never grows: hitting the ceiling drops the spawn, which
 * is a far better failure mode than unbounded memory growth (the original
 * pushed every asteroid into an array it never read or cleared).
 */
export class Pool<T extends { alive: boolean }> {
  private readonly items: T[];
  private count = 0;

  constructor(factory: () => T, capacity: number) {
    this.items = Array.from({ length: capacity }, factory);
  }

  get active(): number {
    return this.count;
  }

  get capacity(): number {
    return this.items.length;
  }

  /** Activates one item, or returns `null` when the pool is full. */
  spawn(init: (item: T) => void): T | null {
    if (this.count >= this.items.length) return null;
    const item = this.items[this.count];
    if (item === undefined) return null;
    this.count += 1;
    item.alive = true;
    init(item);
    return item;
  }

  forEach(fn: (item: T) => void): void {
    for (let i = 0; i < this.count; i += 1) {
      const item = this.items[i];
      if (item !== undefined) fn(item);
    }
  }

  /** Compacts dead items out of the active range. O(n), allocation-free. */
  compact(): void {
    let write = 0;
    for (let read = 0; read < this.count; read += 1) {
      const item = this.items[read];
      if (item === undefined) continue;
      if (item.alive) {
        if (write !== read) {
          const target = this.items[write];
          if (target !== undefined) {
            this.items[read] = target;
            this.items[write] = item;
          }
        }
        write += 1;
      }
    }
    this.count = write;
  }

  clear(): void {
    for (let i = 0; i < this.count; i += 1) {
      const item = this.items[i];
      if (item !== undefined) item.alive = false;
    }
    this.count = 0;
  }
}
