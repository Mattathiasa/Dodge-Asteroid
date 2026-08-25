import { describe, expect, it } from 'vitest';
import { circlesOverlap, isNearMiss, sweptCircleToi } from './collision.js';

const still = { x: 0, y: 0 };

describe('circlesOverlap', () => {
  it('detects clear overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 10 }, { x: 5, y: 0, r: 10 })).toBe(true);
  });

  it('rejects clearly separate circles', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 })).toBe(false);
  });

  it('treats exact tangency as not overlapping', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 10 }, { x: 20, y: 0, r: 10 })).toBe(false);
  });
});

describe('sweptCircleToi', () => {
  it('returns 0 when the circles already overlap', () => {
    expect(sweptCircleToi({ x: 0, y: 0, r: 10 }, still, { x: 5, y: 0, r: 10 }, still)).toBe(0);
  });

  it('returns null when nothing moves and they are apart', () => {
    expect(sweptCircleToi({ x: 0, y: 0, r: 5 }, still, { x: 50, y: 0, r: 5 }, still)).toBeNull();
  });

  it('returns null for circles moving apart', () => {
    const toi = sweptCircleToi(
      { x: 0, y: 0, r: 5 },
      { x: -10, y: 0 },
      { x: 50, y: 0, r: 5 },
      { x: 10, y: 0 },
    );
    expect(toi).toBeNull();
  });

  // The defect this function exists to fix: a fast asteroid passing straight
  // through the ship between two discrete samples.
  it('catches a hit that a discrete test at both endpoints would miss', () => {
    const ship = { x: 100, y: 400, r: 11 };
    const asteroidStart = { x: 100, y: 250, r: 14 };
    const asteroidDelta = { x: 0, y: 400 }; // travels well past the ship this step

    const asteroidEnd = {
      x: asteroidStart.x + asteroidDelta.x,
      y: asteroidStart.y + asteroidDelta.y,
      r: asteroidStart.r,
    };
    expect(circlesOverlap(ship, asteroidStart)).toBe(false);
    expect(circlesOverlap(ship, asteroidEnd)).toBe(false);

    const toi = sweptCircleToi(ship, still, asteroidStart, asteroidDelta);
    expect(toi).not.toBeNull();
    expect(toi).toBeGreaterThan(0);
    expect(toi).toBeLessThanOrEqual(1);
  });

  it('reports the entry time, not the exit time', () => {
    const toi = sweptCircleToi({ x: 0, y: 0, r: 5 }, { x: 100, y: 0 }, { x: 50, y: 0, r: 5 }, still);
    // Contact begins once the gap of 40 units is closed: 40/100 = 0.4.
    expect(toi).toBeCloseTo(0.4, 6);
  });

  it('returns null when contact would happen after this step', () => {
    const toi = sweptCircleToi({ x: 0, y: 0, r: 5 }, { x: 10, y: 0 }, { x: 500, y: 0, r: 5 }, still);
    expect(toi).toBeNull();
  });

  it('accounts for both bodies moving', () => {
    const toi = sweptCircleToi(
      { x: 0, y: 0, r: 5 },
      { x: 50, y: 0 },
      { x: 100, y: 0, r: 5 },
      { x: -50, y: 0 },
    );
    // Closing speed 100, gap 90 -> 0.9.
    expect(toi).toBeCloseTo(0.9, 6);
  });
});

describe('isNearMiss', () => {
  const ship = { x: 0, y: 0, r: 10 };

  it('is false when actually overlapping', () => {
    expect(isNearMiss(ship, { x: 12, y: 0, r: 10 }, 18)).toBe(false);
  });

  it('is true just outside contact', () => {
    expect(isNearMiss(ship, { x: 25, y: 0, r: 10 }, 18)).toBe(true);
  });

  it('is false beyond the margin', () => {
    expect(isNearMiss(ship, { x: 60, y: 0, r: 10 }, 18)).toBe(false);
  });
});
