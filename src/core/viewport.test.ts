import { describe, expect, it } from 'vitest';
import { computeViewport, DPR_CAP, screenToWorld, worldToScreen } from './viewport.js';

const WORLD_W = 480;
const WORLD_H = 720;

describe('computeViewport', () => {
  it('letterboxes horizontally when the container is wider than the world', () => {
    const view = computeViewport(1000, 720, 1, WORLD_W, WORLD_H);
    expect(view.scale).toBe(1);
    expect(view.offsetX).toBe((1000 - 480) / 2);
    expect(view.offsetY).toBe(0);
  });

  it('letterboxes vertically when the container is taller than the world', () => {
    const view = computeViewport(480, 1000, 1, WORLD_W, WORLD_H);
    expect(view.scale).toBe(1);
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe((1000 - 720) / 2);
  });

  it('has no bars at the exact world aspect ratio', () => {
    const view = computeViewport(960, 1440, 1, WORLD_W, WORLD_H);
    expect(view.scale).toBe(2);
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe(0);
  });

  it('caps device pixel ratio so a 3x display does not cost 9x the fill', () => {
    expect(computeViewport(480, 720, 3, WORLD_W, WORLD_H).dpr).toBe(DPR_CAP);
    expect(computeViewport(480, 720, 1.5, WORLD_W, WORLD_H).dpr).toBe(1.5);
    expect(computeViewport(480, 720, 0.5, WORLD_W, WORLD_H).dpr).toBe(1);
  });

  it('sizes the backing store in device pixels', () => {
    const view = computeViewport(400, 600, 2, WORLD_W, WORLD_H);
    expect(view.pixelWidth).toBe(800);
    expect(view.pixelHeight).toBe(1200);
  });
});

describe('screenToWorld', () => {
  // The original game rendered the ship a full body-width from the cursor,
  // because it applied a CSS translate(-50%,-50%) *and* subtracted half the
  // width in JS. These assertions pin the mapping down.
  it('maps the centre of a letterboxed rect to the centre of the world', () => {
    const rect = { left: 100, top: 50, width: 1000, height: 720 };
    const point = screenToWorld(100 + 500, 50 + 360, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(WORLD_W / 2, 6);
    expect(point.y).toBeCloseTo(WORLD_H / 2, 6);
  });

  it('maps the top-left of the drawn field to the world origin', () => {
    const rect = { left: 0, top: 0, width: 960, height: 1440 };
    const point = screenToWorld(0, 0, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it('accounts for the element offset on the page', () => {
    const rect = { left: 37, top: 91, width: 480, height: 720 };
    const point = screenToWorld(37 + 12, 91 + 34, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(12, 6);
    expect(point.y).toBeCloseTo(34, 6);
  });

  it('degrades gracefully on a zero-sized rect', () => {
    const point = screenToWorld(5, 5, { left: 0, top: 0, width: 0, height: 0 }, WORLD_W, WORLD_H);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });

  it('round-trips through worldToScreen', () => {
    const rect = { left: 23, top: 71, width: 1200, height: 800 };
    for (const [wx, wy] of [
      [0, 0],
      [240, 360],
      [479, 719],
    ] as const) {
      const screen = worldToScreen(wx, wy, rect, WORLD_W, WORLD_H);
      const back = screenToWorld(screen.x, screen.y, rect, WORLD_W, WORLD_H);
      expect(back.x).toBeCloseTo(wx, 6);
      expect(back.y).toBeCloseTo(wy, 6);
    }
  });
});
