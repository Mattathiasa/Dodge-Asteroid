import { describe, expect, it } from 'vitest';
import {
  computeViewport,
  DPR_CAP,
  fitDisplaySize,
  screenToWorld,
  worldToScreen,
} from './viewport.js';

const WORLD_W = 480;
const WORLD_H = 720;

describe('computeViewport', () => {
  it('sizes the backing store to the world, not to the element', () => {
    // CSS scales the element to fit; the backing store stays world-shaped, so
    // there are never letterbox bars inside the canvas on a tall phone.
    for (const [w, h] of [
      [390, 585],
      [200, 300],
      [1200, 1800],
    ] as const) {
      const view = computeViewport(w, h, 1, WORLD_W, WORLD_H);
      expect(view.pixelWidth).toBe(WORLD_W);
      expect(view.pixelHeight).toBe(WORLD_H);
    }
  });

  it('multiplies the backing store by the capped device pixel ratio', () => {
    const view = computeViewport(390, 585, 2, WORLD_W, WORLD_H);
    expect(view.pixelWidth).toBe(WORLD_W * 2);
    expect(view.pixelHeight).toBe(WORLD_H * 2);
  });

  it('caps device pixel ratio so a 3x display does not cost 9x the fill', () => {
    expect(computeViewport(480, 720, 3, WORLD_W, WORLD_H).dpr).toBe(DPR_CAP);
    expect(computeViewport(480, 720, 1.5, WORLD_W, WORLD_H).dpr).toBe(1.5);
    expect(computeViewport(480, 720, 0.5, WORLD_W, WORLD_H).dpr).toBe(1);
  });

  it('reports world units per displayed CSS pixel', () => {
    expect(computeViewport(240, 360, 1, WORLD_W, WORLD_H).scale).toBe(2);
    expect(computeViewport(960, 1440, 1, WORLD_W, WORLD_H).scale).toBe(0.5);
  });

  it('stays finite on a zero-sized element', () => {
    expect(Number.isFinite(computeViewport(0, 0, 1, WORLD_W, WORLD_H).scale)).toBe(true);
  });
});

describe('fitDisplaySize', () => {
  const ratio = WORLD_W / WORLD_H;

  it('keeps the world aspect ratio on any box shape', () => {
    for (const [w, h] of [
      [414, 896],
      [1200, 700],
      [800, 800],
      [320, 480],
      [2000, 400],
    ] as const) {
      const fit = fitDisplaySize(w, h, WORLD_W, WORLD_H);
      expect(fit.width / fit.height).toBeCloseTo(ratio, 6);
    }
  });

  it('never overflows the available box', () => {
    for (const [w, h] of [
      [414, 896],
      [1200, 700],
      [800, 800],
      [2000, 400],
    ] as const) {
      const fit = fitDisplaySize(w, h, WORLD_W, WORLD_H);
      expect(fit.width).toBeLessThanOrEqual(w + 1e-9);
      expect(fit.height).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it('is limited by height on a tall box and by width on a wide one', () => {
    expect(fitDisplaySize(414, 896, WORLD_W, WORLD_H).width).toBeCloseTo(414, 6);
    expect(fitDisplaySize(1200, 700, WORLD_W, WORLD_H).height).toBeCloseTo(700, 6);
  });

  it('returns nothing for a collapsed box', () => {
    expect(fitDisplaySize(0, 500, WORLD_W, WORLD_H)).toEqual({ width: 0, height: 0 });
    expect(fitDisplaySize(500, 0, WORLD_W, WORLD_H)).toEqual({ width: 0, height: 0 });
  });
});

describe('screenToWorld', () => {
  // The original game rendered the ship a full body-width from the cursor,
  // because it applied a CSS translate(-50%,-50%) *and* subtracted half the
  // width in JS. These assertions pin the mapping down.
  it('maps the centre of the element to the centre of the world', () => {
    const rect = { left: 100, top: 50, width: 390, height: 585 };
    const point = screenToWorld(100 + 195, 50 + 292.5, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(WORLD_W / 2, 6);
    expect(point.y).toBeCloseTo(WORLD_H / 2, 6);
  });

  it('maps the top-left corner to the world origin', () => {
    const rect = { left: 37, top: 91, width: 480, height: 720 };
    const point = screenToWorld(37, 91, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  it('accounts for the element offset on the page', () => {
    const rect = { left: 37, top: 91, width: 480, height: 720 };
    const point = screenToWorld(37 + 12, 91 + 34, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(12, 6);
    expect(point.y).toBeCloseTo(34, 6);
  });

  it('scales when the element is displayed smaller than the world', () => {
    const rect = { left: 0, top: 0, width: 240, height: 360 };
    const point = screenToWorld(120, 180, rect, WORLD_W, WORLD_H);
    expect(point.x).toBeCloseTo(240, 6);
    expect(point.y).toBeCloseTo(360, 6);
  });

  it('degrades gracefully on a zero-sized rect', () => {
    const point = screenToWorld(5, 5, { left: 0, top: 0, width: 0, height: 0 }, WORLD_W, WORLD_H);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });

  it('round-trips through worldToScreen', () => {
    const rect = { left: 23, top: 71, width: 333, height: 500 };
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
