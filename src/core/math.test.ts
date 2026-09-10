import { describe, expect, it } from 'vitest';
import { clamp, clamp01, distanceSq, lerp, smoothstep } from './math.js';

describe('clamp', () => {
  it('bounds values on both sides', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('clamp01 is the unit-interval case', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
});

describe('lerp', () => {
  it('interpolates the endpoints and midpoint', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe('smoothstep', () => {
  it('pins the endpoints and the midpoint', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
  });

  it('clamps outside the unit interval', () => {
    expect(smoothstep(-3)).toBe(0);
    expect(smoothstep(4)).toBe(1);
  });

  it('is flat at both ends, which is what makes the ramp ease in and plateau', () => {
    // A near-zero derivative shows up as a very small delta near 0 and near 1.
    expect(smoothstep(0.01)).toBeLessThan(0.001);
    expect(1 - smoothstep(0.99)).toBeLessThan(0.001);
  });

  it('is monotonically increasing', () => {
    let previous = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      const value = smoothstep(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('distanceSq', () => {
  it('returns the squared euclidean distance', () => {
    expect(distanceSq(0, 0, 3, 4)).toBe(25);
    expect(distanceSq(1, 1, 1, 1)).toBe(0);
  });
});
