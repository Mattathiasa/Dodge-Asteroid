import { describe, expect, it, vi } from 'vitest';
import { GameLoop } from './loop.js';

function makeLoop(options: { fixedDt?: number; maxFrameDt?: number } = {}) {
  const update = vi.fn();
  const render = vi.fn();
  let clock = 0;
  const loop = new GameLoop(
    { update, render },
    {
      fixedDt: options.fixedDt ?? 1 / 60,
      maxFrameDt: options.maxFrameDt ?? 0.25,
      now: () => clock,
      schedule: () => 1,
      cancel: () => undefined,
    },
  );
  return { loop, update, render, setClock: (t: number) => (clock = t) };
}

describe('GameLoop', () => {
  it('runs a whole number of fixed steps and renders once per frame', () => {
    const { loop, update, render } = makeLoop();
    loop.start();
    loop.step(100); // 100ms at 1/60s per step = 6 steps
    expect(update).toHaveBeenCalledTimes(6);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('always calls update with the same dt regardless of frame length', () => {
    const { loop, update } = makeLoop();
    loop.start();
    loop.step(37);
    loop.step(211);
    const deltas = new Set(update.mock.calls.map((call) => call[0] as number));
    expect(deltas.size).toBe(1);
    expect([...deltas][0]).toBeCloseTo(1 / 60, 12);
  });

  it('clamps a long frame so a backgrounded tab cannot fast-forward the run', () => {
    const { loop, update } = makeLoop({ maxFrameDt: 0.25 });
    loop.start();
    loop.step(5000); // five seconds away
    expect(update).toHaveBeenCalledTimes(15); // 0.25s clamp / (1/60), not 300
  });

  it('carries leftover time instead of dropping it', () => {
    const { loop, update, render } = makeLoop();
    loop.start();
    loop.step(8); // less than one step
    expect(update).toHaveBeenCalledTimes(0);
    expect(render).toHaveBeenCalledTimes(1);
    loop.step(9); // 17ms total, now past one step
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('reports an interpolation alpha in [0, 1)', () => {
    const { loop, render } = makeLoop();
    loop.start();
    loop.step(25);
    for (const call of render.mock.calls) {
      const alpha = call[0] as number;
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('resync discards the accumulator', () => {
    const { loop, update, setClock } = makeLoop();
    loop.start();
    loop.step(10); // banked, not yet a full step
    setClock(10);
    loop.resync();
    loop.step(10);
    expect(update).toHaveBeenCalledTimes(0);
  });

  it('tracks running state across start and stop', () => {
    const { loop } = makeLoop();
    expect(loop.running).toBe(false);
    loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
  });
});
