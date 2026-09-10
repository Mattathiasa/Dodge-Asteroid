import { LOOP } from '../config.js';

export interface LoopCallbacks {
  /** Called zero or more times per frame, always with the same `dt`. */
  update(fixedDt: number, tick: number): void;
  /** Called exactly once per frame. `alpha` interpolates the render between ticks. */
  render(alpha: number, frameDt: number): void;
}

export interface LoopOptions {
  readonly fixedDt?: number;
  readonly maxFrameDt?: number;
  readonly now?: () => number;
  readonly schedule?: (cb: (t: number) => void) => number;
  readonly cancel?: (handle: number) => void;
}

/**
 * A fixed-timestep loop with an accumulator.
 *
 * This replaces the original's four independent `setInterval`s (one of which
 * was created afresh for every asteroid and never cleared). Physics advances in
 * constant steps, so behaviour is identical at 30, 60 or 144 Hz, and the clock
 * is injectable so the loop can be unit-tested without a browser.
 */
export class GameLoop {
  private readonly callbacks: LoopCallbacks;
  private readonly fixedDt: number;
  private readonly maxFrameDt: number;
  private readonly now: () => number;
  private readonly schedule: (cb: (t: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  private accumulator = 0;
  private lastTime = 0;
  private handle: number | null = null;
  private tick = 0;

  constructor(callbacks: LoopCallbacks, options: LoopOptions = {}) {
    this.callbacks = callbacks;
    this.fixedDt = options.fixedDt ?? LOOP.fixedDt;
    this.maxFrameDt = options.maxFrameDt ?? LOOP.maxFrameDt;
    this.now = options.now ?? (() => performance.now());
    this.schedule = options.schedule ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancel ?? ((h) => cancelAnimationFrame(h));
  }

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastTime = this.now();
    this.accumulator = 0;
    this.handle = this.schedule(this.frame);
  }

  stop(): void {
    if (this.handle === null) return;
    this.cancelFrame(this.handle);
    this.handle = null;
  }

  /**
   * Drops any accumulated time. Call this when resuming from a paused or
   * backgrounded tab, otherwise the loop tries to catch up on every second it
   * was away and fast-forwards the player straight into an asteroid.
   */
  resync(): void {
    this.lastTime = this.now();
    this.accumulator = 0;
  }

  private readonly frame = (): void => {
    this.handle = this.schedule(this.frame);
    this.advance(this.now());
  };

  /** Test seam: advance the loop by a wall-clock delta without a real frame. */
  step(frameMs: number): void {
    this.advance(this.lastTime + frameMs);
  }

  private advance(time: number): void {
    const frameDt = Math.min((time - this.lastTime) / 1000, this.maxFrameDt);
    this.lastTime = time;
    this.accumulator += Math.max(0, frameDt);

    while (this.accumulator >= this.fixedDt) {
      this.callbacks.update(this.fixedDt, this.tick++);
      this.accumulator -= this.fixedDt;
    }

    this.callbacks.render(this.accumulator / this.fixedDt, frameDt);
  }
}
