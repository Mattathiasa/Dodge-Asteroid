import { describe, expect, it } from 'vitest';
import { SHIP, WORLD } from '../config.js';
import { createShip } from './entities.js';
import { clampToBounds, integrate, normalizeAxis, steerToward } from './movement.js';

const DT = 1 / 60;
const noSteer = { target: null, axis: { x: 0, y: 0 } };

describe('normalizeAxis', () => {
  it('leaves sub-unit input alone', () => {
    expect(normalizeAxis(0, 0)).toEqual({ x: 0, y: 0 });
    expect(normalizeAxis(0.5, 0)).toEqual({ x: 0.5, y: 0 });
  });

  it('stops diagonals from being faster than the cardinals', () => {
    const axis = normalizeAxis(1, 1);
    expect(Math.hypot(axis.x, axis.y)).toBeCloseTo(1, 10);
  });
});

describe('steerToward', () => {
  it('never exceeds the configured maximum speed', () => {
    const ship = createShip(10, 10, SHIP.radius);
    for (let i = 0; i < 2000; i += 1) {
      steerToward(ship, { target: { x: 10000, y: 10000 }, axis: { x: 0, y: 0 } }, DT);
      integrate(ship, DT);
      expect(Math.hypot(ship.vx, ship.vy)).toBeLessThanOrEqual(SHIP.maxSpeed + 1e-6);
    }
  });

  it('converges on a stationary pointer target', () => {
    const ship = createShip(50, 50, SHIP.radius);
    const target = { x: 300, y: 400 };
    for (let i = 0; i < 180; i += 1) {
      steerToward(ship, { target, axis: { x: 0, y: 0 } }, DT);
      integrate(ship, DT);
    }
    expect(Math.hypot(ship.x - target.x, ship.y - target.y)).toBeLessThan(4);
  });

  it('responds to keyboard input when there is no pointer target', () => {
    const ship = createShip(240, 360, SHIP.radius);
    for (let i = 0; i < 30; i += 1) {
      steerToward(ship, { target: null, axis: { x: 1, y: 0 } }, DT);
      integrate(ship, DT);
    }
    expect(ship.x).toBeGreaterThan(240);
    expect(ship.vx).toBeGreaterThan(0);
  });

  it('comes to rest when the player lets go', () => {
    const ship = createShip(240, 360, SHIP.radius);
    ship.vx = 400;
    ship.vy = -300;
    for (let i = 0; i < 240; i += 1) {
      steerToward(ship, noSteer, DT);
      integrate(ship, DT);
    }
    expect(Math.hypot(ship.vx, ship.vy)).toBeLessThan(1);
  });
});

describe('integrate', () => {
  it('records the previous position for render interpolation', () => {
    const ship = createShip(100, 100, SHIP.radius);
    ship.vx = 60;
    integrate(ship, 1);
    expect(ship.px).toBe(100);
    expect(ship.x).toBe(160);
  });
});

describe('clampToBounds', () => {
  it('keeps the body fully inside on every edge', () => {
    for (const [x, y] of [
      [-500, 360],
      [9999, 360],
      [240, -500],
      [240, 9999],
    ] as const) {
      const ship = createShip(x, y, SHIP.radius);
      clampToBounds(ship, WORLD);
      expect(ship.x - ship.r).toBeGreaterThanOrEqual(0);
      expect(ship.x + ship.r).toBeLessThanOrEqual(WORLD.width);
      expect(ship.y - ship.r).toBeGreaterThanOrEqual(0);
      expect(ship.y + ship.r).toBeLessThanOrEqual(WORLD.height);
    }
  });

  it('kills only the velocity pushing into the wall', () => {
    const ship = createShip(-10, 360, SHIP.radius);
    ship.vx = -200;
    ship.vy = 150;
    clampToBounds(ship, WORLD);
    expect(ship.vx).toBe(0);
    expect(ship.vy).toBe(150);
  });
});
