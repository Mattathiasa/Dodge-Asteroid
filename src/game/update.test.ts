import { describe, expect, it } from 'vitest';
import type { SimEvent } from './events.js';
import type { SteerInput } from './movement.js';
import type { World } from './world.js';
import { COMETS, DIFFICULTY, SECTORS, SHARDS, SHIP, WORLD } from '../config.js';
import { createEventBuffer } from './events.js';
import { createRng } from '../core/rng.js';
import { difficultyAt } from './difficulty.js';
import { createWorld, resetRun } from './world.js';
import { initAsteroid, makeCometSpec } from './spawner.js';
import { update } from './update.js';

const DT = 1 / 60;

/** Deterministic steering: a sine sweep across the field. */
function steerAt(tick: number) {
  return {
    target: {
      x: WORLD.width / 2 + Math.sin(tick / 45) * (WORLD.width / 2 - 40),
      y: WORLD.height * 0.78 + Math.cos(tick / 70) * 60,
    },
    axis: { x: 0, y: 0 },
  };
}

interface RunResult {
  ticks: number;
  points: number;
  survived: boolean;
  events: SimEvent[];
}

function simulate(seed: number, maxTicks: number, dt = DT): RunResult {
  const world = createWorld(seed);
  const buffer = createEventBuffer();
  const events: SimEvent[] = [];
  let ticks = 0;
  let survived = true;

  for (let i = 0; i < maxTicks; i += 1) {
    survived = update(world, dt, { steer: steerAt(i), canSteer: true }, buffer);
    events.push(...buffer.drain());
    ticks += 1;
    if (!survived) break;
  }

  return { ticks, points: world.score.points, survived, events };
}

describe('update', () => {
  it('is deterministic for a given seed', () => {
    const a = simulate(7, 3600);
    const b = simulate(7, 3600);
    expect(a.ticks).toBe(b.ticks);
    expect(a.points).toBe(b.points);
    expect(a.survived).toBe(b.survived);
    expect(a.events).toEqual(b.events);
  });

  it('produces different runs for different seeds', () => {
    const a = simulate(1, 3600);
    const b = simulate(999, 3600);
    expect([a.ticks, a.points]).not.toEqual([b.ticks, b.points]);
  });

  it('keeps every value finite across a long run', () => {
    const world = createWorld(42);
    const buffer = createEventBuffer();

    for (let i = 0; i < 5400; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();

      expect(Number.isFinite(world.ship.x)).toBe(true);
      expect(Number.isFinite(world.ship.y)).toBe(true);
      expect(Number.isFinite(world.ship.vx)).toBe(true);
      expect(Number.isFinite(world.ship.vy)).toBe(true);
      expect(Number.isFinite(world.score.points)).toBe(true);

      world.asteroids.forEach((a) => {
        expect(Number.isNaN(a.x)).toBe(false);
        expect(Number.isNaN(a.y)).toBe(false);
      });

      if (!alive) break;
    }
  });

  it('never lets the ship leave the field', () => {
    const world = createWorld(5);
    const buffer = createEventBuffer();
    for (let i = 0; i < 3600; i += 1) {
      // Steer hard into a corner to try to push it out.
      const alive = update(
        world,
        DT,
        { steer: { target: { x: -9999, y: -9999 }, axis: { x: 0, y: 0 } }, canSteer: true },
        buffer,
      );
      buffer.drain();
      expect(world.ship.x).toBeGreaterThanOrEqual(world.ship.r - 1e-6);
      expect(world.ship.y).toBeGreaterThanOrEqual(world.ship.r - 1e-6);
      expect(world.ship.x).toBeLessThanOrEqual(WORLD.width - world.ship.r + 1e-6);
      expect(world.ship.y).toBeLessThanOrEqual(WORLD.height - world.ship.r + 1e-6);
      if (!alive) break;
    }
  });

  it('respects the pool capacities and the active-asteroid limit', () => {
    const world = createWorld(31);
    const buffer = createEventBuffer();
    for (let i = 0; i < 7200; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
      expect(world.asteroids.active).toBeLessThanOrEqual(world.asteroids.capacity);
      expect(world.particles.active).toBeLessThanOrEqual(world.particles.capacity);
      expect(world.powerUps.active).toBeLessThanOrEqual(world.powerUps.capacity);
      // One over the cap is possible for a single tick, since the limit is
      // checked before the spawn rather than after it.
      expect(world.asteroids.active).toBeLessThanOrEqual(
        difficultyAt(world.fieldTime).maxActive + 1,
      );
      if (!alive) break;
    }
  });

  it('spawns nothing during the grace period', () => {
    const world = createWorld(3);
    const buffer = createEventBuffer();
    for (let i = 0; i < 60; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
    }
    expect(world.elapsed).toBeLessThan(2);
    expect(world.asteroids.active).toBe(0);
  });

  it('increases the score while the ship is alive', () => {
    const world = createWorld(17);
    const buffer = createEventBuffer();
    let previous = -1;
    for (let i = 0; i < 900; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
      if (!alive) break;
      expect(world.score.points).toBeGreaterThanOrEqual(previous);
      previous = world.score.points;
    }
    expect(world.score.points).toBeGreaterThan(0);
  });

  it('ends the run and emits a destroyed event when the ship is hit', () => {
    const world = createWorld(1);
    const buffer = createEventBuffer();

    // Park the ship right where a spawned asteroid will fall.
    let destroyed = false;
    for (let i = 0; i < 20000; i += 1) {
      const alive = update(
        world,
        DT,
        { steer: { target: null, axis: { x: 0, y: 0 } }, canSteer: false },
        buffer,
      );
      if (buffer.drain().some((e) => e.type === 'destroyed')) destroyed = true;
      if (!alive) break;
    }

    expect(destroyed).toBe(true);
    expect(world.ship.alive).toBe(false);
  });

  it('resetRun restores a fresh, identical starting state', () => {
    const world = createWorld(64);
    const buffer = createEventBuffer();
    for (let i = 0; i < 1200; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
    }

    resetRun(world, 64);
    expect(world.elapsed).toBe(0);
    expect(world.score.points).toBe(0);
    expect(world.asteroids.active).toBe(0);
    expect(world.particles.active).toBe(0);
    expect(world.ship.lives).toBe(SHIP.startingLives);
    expect(world.ship.alive).toBe(true);

    // And a run from the reset world matches a fresh one with the same seed.
    const fresh = simulate(64, 600);
    const buffer2 = createEventBuffer();
    let points = 0;
    for (let i = 0; i < 600; i += 1) {
      const alive = update(world, DT, { steer: steerAt(i), canSteer: true }, buffer2);
      buffer2.drain();
      points = world.score.points;
      if (!alive) break;
    }
    expect(points).toBe(fresh.points);
  });
});

/** A world that spawns nothing on its own, so a test can stage one scene. */
function stagedWorld(): { world: World; buffer: ReturnType<typeof createEventBuffer> } {
  const world = createWorld(1234);
  // Scaling the difficulty clock to zero keeps the run inside the grace period.
  world.difficultyScale = 0;
  world.ship.x = WORLD.width / 2;
  world.ship.y = 560;
  world.ship.px = world.ship.x;
  world.ship.py = world.ship.y;
  return { world, buffer: createEventBuffer() };
}

const PARKED = { steer: { target: null, axis: { x: 0, y: 0 } }, canSteer: false } as const;

function stageRock(world: World, x: number, y: number, r: number, vy: number): void {
  world.asteroids.spawn((a) =>
    initAsteroid(a, {
      x,
      y,
      vx: 0,
      vy,
      r,
      rotSpeed: 0,
      shape: 0,
      skin: 2,
      comet: false,
      warn: 0,
    }),
  );
}

function stageShard(world: World, x: number, y: number): void {
  world.shards.spawn((s) => {
    s.x = x;
    s.y = y;
    s.px = x;
    s.py = y;
    s.vx = 0;
    s.vy = SHARDS.fallSpeed;
    s.r = SHARDS.radius;
    s.age = 0;
  });
}

describe('near misses', () => {
  it('pays out once the rock has cleared the ship, not as it arrives', () => {
    const { world, buffer } = stagedWorld();
    const r = 20;
    // Passes beside the ship with an 8-unit gap at the closest point.
    stageRock(world, world.ship.x + world.ship.r + r + 8, 380, r, 300);

    const seen: { y: number; event: SimEvent }[] = [];
    for (let i = 0; i < 120; i += 1) {
      update(world, DT, PARKED, buffer);
      let rockY = Number.NaN;
      world.asteroids.forEach((a) => (rockY = a.y));
      for (const event of buffer.drain()) seen.push({ y: rockY, event });
    }

    const misses = seen.filter((s) => s.event.type === 'nearMiss');
    expect(misses).toHaveLength(1);
    // Paid after the closest approach, while the rock is still close by.
    expect(misses[0]!.y).toBeGreaterThan(world.ship.y);
    expect(misses[0]!.y).toBeLessThan(world.ship.y + 60);
    expect(world.score.combo).toBe(1);
    expect(world.score.nearMisses).toBe(1);
  });

  it('never pays a near miss for the rock that hits the ship', () => {
    const { world, buffer } = stagedWorld();
    stageRock(world, world.ship.x + 4, 380, 18, 300);

    const events: SimEvent[] = [];
    for (let i = 0; i < 120; i += 1) {
      update(world, DT, PARKED, buffer);
      events.push(...buffer.drain());
    }

    expect(events.some((e) => e.type === 'destroyed')).toBe(true);
    expect(events.some((e) => e.type === 'nearMiss')).toBe(false);
  });

  it('pays nothing for a rock that passes through an invulnerable ship', () => {
    const { world, buffer } = stagedWorld();
    world.ship.invulnTime = 60;
    stageRock(world, world.ship.x + 2, 380, 18, 300);

    const events: SimEvent[] = [];
    for (let i = 0; i < 180; i += 1) {
      update(world, DT, PARKED, buffer);
      events.push(...buffer.drain());
    }

    expect(events.some((e) => e.type === 'nearMiss')).toBe(false);
    expect(world.ship.alive).toBe(true);
  });
});

describe('comets', () => {
  it('holds still through its warning, then falls straight down its lane', () => {
    const { world, buffer } = stagedWorld();
    world.asteroids.spawn((a) => initAsteroid(a, makeCometSpec(createRng(5), WORLD.width)));

    let comet: { x: number; y: number; warn: number } = { x: 0, y: 0, warn: 0 };
    const read = (): void =>
      world.asteroids.forEach((a) => (comet = { x: a.x, y: a.y, warn: a.warn }));

    read();
    const start = { ...comet };
    expect(start.warn).toBe(COMETS.warnSeconds);

    // Most of the way through the warning: lit, but not moving.
    for (let i = 0; i < Math.floor(COMETS.warnSeconds * 60) - 4; i += 1) {
      update(world, DT, PARKED, buffer);
    }
    read();
    expect(comet.warn).toBeGreaterThan(0);
    expect(comet.y).toBe(start.y);

    for (let i = 0; i < 30; i += 1) update(world, DT, PARKED, buffer);
    read();
    expect(comet.warn).toBe(0);
    expect(comet.y).toBeGreaterThan(start.y + 100);
    expect(comet.x).toBe(start.x);
  });

  it('announces itself the moment it spawns', () => {
    const world = createWorld(2);
    const buffer = createEventBuffer();
    // Late enough in the ramp that comets are in the mix.
    world.fieldTime = 200;
    world.ship.invulnTime = 1e9;

    let warnings = 0;
    for (let i = 0; i < 60 * 60; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      for (const e of buffer.drain()) {
        if (e.type !== 'cometWarning') continue;
        warnings += 1;
        // The lane it announces is the lane a waiting comet is in.
        let found = false;
        world.asteroids.forEach((a) => {
          if (a.comet && a.warn > 0 && a.x === e.x) found = true;
        });
        expect(found).toBe(true);
      }
    }

    expect(warnings).toBeGreaterThan(0);
  });
});

describe('shards', () => {
  it('are collected by flying through them', () => {
    const { world, buffer } = stagedWorld();
    stageShard(world, world.ship.x, 300);

    const events: SimEvent[] = [];
    for (let i = 0; i < 240; i += 1) {
      update(world, DT, PARKED, buffer);
      events.push(...buffer.drain());
    }

    const shard = events.find((e) => e.type === 'shard');
    expect(shard).toBeDefined();
    expect(world.score.shards).toBe(1);
    expect(world.shards.active).toBe(0);
  });

  it('are pulled in from just outside the ship', () => {
    const { world, buffer } = stagedWorld();
    // This line misses the ship by a clear margin without the pull.
    stageShard(world, world.ship.x + world.ship.r + SHARDS.radius + 24, 300);

    for (let i = 0; i < 240; i += 1) {
      update(world, DT, PARKED, buffer);
      buffer.drain();
    }

    expect(world.score.shards).toBe(1);
  });

  it('chain when collected in quick succession', () => {
    const { world, buffer } = stagedWorld();
    for (let i = 0; i < 4; i += 1) stageShard(world, world.ship.x, 300 - i * SHARDS.spacing);

    const chains: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      update(world, DT, PARKED, buffer);
      for (const e of buffer.drain()) if (e.type === 'shard') chains.push(e.chain);
    }

    expect(chains).toEqual([1, 2, 3, 4]);
  });

  it('arrive throughout a normal run', () => {
    const world = createWorld(88);
    const buffer = createEventBuffer();
    world.ship.invulnTime = 1e9;
    let spawned = 0;
    for (let i = 0; i < 60 * 30; i += 1) {
      const before = world.shards.active;
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      buffer.drain();
      if (world.shards.active > before) spawned += world.shards.active - before;
    }
    expect(spawned).toBeGreaterThanOrEqual(SHARDS.countMin * 5);
    expect(world.shards.active).toBeLessThanOrEqual(world.shards.capacity);
  });
});

describe('sectors', () => {
  it('announces each new sector once', () => {
    const world = createWorld(6);
    const buffer = createEventBuffer();
    world.ship.invulnTime = 1e9;

    const sectors: number[] = [];
    const seconds = DIFFICULTY.graceSeconds + SECTORS.seconds * 2 + 1;
    for (let i = 0; i < seconds * 60; i += 1) {
      update(world, DT, { steer: steerAt(i), canSteer: true }, buffer);
      for (const e of buffer.drain()) if (e.type === 'sector') sectors.push(e.index);
    }

    expect(sectors).toEqual([1, 2]);
    expect(world.sector).toBe(2);
  });
});

describe('after the ship is destroyed', () => {
  it('keeps the field moving but stops scoring, colliding and steering', () => {
    const { world, buffer } = stagedWorld();
    stageRock(world, world.ship.x, 400, 18, 300);
    // A second rock further up, to watch the field carry on.
    stageRock(world, 60, 100, 18, 200);

    let alive = true;
    for (let i = 0; i < 120 && alive; i += 1) {
      alive = update(world, DT, PARKED, buffer);
      buffer.drain();
    }
    expect(alive).toBe(false);

    const points = world.score.points;
    const ship = { x: world.ship.x, y: world.ship.y };
    let rockY = 0;
    world.asteroids.forEach((a) => (rockY = a.y));

    const after: SimEvent[] = [];
    for (let i = 0; i < 60; i += 1) {
      const result = update(
        world,
        DT,
        { steer: { target: { x: 0, y: 0 }, axis: { x: 0, y: 0 } }, canSteer: true },
        buffer,
      );
      expect(result).toBe(false);
      after.push(...buffer.drain());
    }

    let movedY = 0;
    world.asteroids.forEach((a) => (movedY = a.y));
    expect(movedY).toBeGreaterThan(rockY);
    expect(world.score.points).toBe(points);
    expect({ x: world.ship.x, y: world.ship.y }).toEqual(ship);
    expect(after.filter((e) => e.type !== 'milestone')).toEqual([]);
  });
});

describe('the field', () => {
  interface Spawn {
    /** What spawned, which must match exactly. */
    what: string;
    /** When, in field time. Slow-mo can shift this by up to one tick. */
    atMs: number;
  }

  /**
   * Plays a run to a fixed point in field time and logs every spawn.
   * `act` gets each tick to do whatever a player might.
   */
  function fieldFor(
    seed: number,
    act: (world: World, tick: number) => SteerInput,
    seconds = 70,
  ): {
    spawns: Spawn[];
    events: SimEvent[];
  } {
    const world = createWorld(seed);
    const buffer = createEventBuffer();
    const spawns: Spawn[] = [];
    const events: SimEvent[] = [];
    let scheduled = world.nextSpawnAtMs;

    for (let tick = 0; world.fieldTime < seconds; tick += 1) {
      // Never let the run end, so both players see the whole stretch.
      world.ship.lives = 99;
      update(world, DT, { steer: act(world, tick), canSteer: true }, buffer);
      events.push(...buffer.drain());
      if (world.nextSpawnAtMs === scheduled) continue;
      scheduled = world.nextSpawnAtMs;
      // The pool keeps spawn order, so the newest arrival is the last one.
      let what = '';
      world.asteroids.forEach((a) => {
        what = [
          a.px.toFixed(4),
          a.r.toFixed(4),
          a.vy.toFixed(4),
          String(a.skin),
          String(a.comet),
        ].join(':');
      });
      spawns.push({ what, atMs: world.fieldMs });
    }
    return { spawns, events };
  }

  const idleField = (): ReturnType<typeof fieldFor> =>
    fieldFor(2718, () => ({ target: { x: 40, y: 700 }, axis: { x: 0, y: 0 } }));

  // What falls is decided by the seed alone. A player who smashes through
  // rocks must see exactly the field that a player sitting in a corner sees,
  // or a daily run is not the same run.
  it.each([2718, 1, 99])(
    'is identical however many rocks the player destroys (seed %i)',
    (seed) => {
      // A shield kept up the whole time vaporises every rock the sweep touches.
      // Slow-mo is the one pickup that does bend the field, and has its own
      // test below, so it is cancelled for both players here.
      const busy = fieldFor(
        seed,
        (world, tick) => {
          world.ship.shieldTime = 6;
          world.ship.slowmoTime = 0;
          return steerAt(tick);
        },
        120,
      );
      const idle = fieldFor(
        seed,
        (world) => {
          world.ship.slowmoTime = 0;
          return { target: { x: 40, y: 700 }, axis: { x: 0, y: 0 } };
        },
        120,
      );

      // The busy player really did change things.
      expect(busy.events.filter((e) => e.type === 'shieldBreak').length).toBeGreaterThan(8);
      expect(busy.spawns).toEqual(idle.spawns);
    },
  );

  // Slow-mo dilates field time for the player who takes it. Up to that moment
  // the field is identical; after it, it is the same difficulty at the same
  // rate, but no longer rock-for-rock, because spawns land on ticks of a
  // different size.
  it('is identical until slow-mo, and just as busy after it', () => {
    const slowFrom = 30;
    let slowed = false;
    const busy = fieldFor(2718, (world, tick) => {
      if (!slowed && world.fieldTime > slowFrom) {
        world.ship.slowmoTime = 5;
        slowed = true;
      }
      return steerAt(tick);
    });
    const idle = idleField();

    const before = (log: Spawn[]): Spawn[] => log.filter((s) => s.atMs < slowFrom * 1000);
    expect(before(busy.spawns).length).toBeGreaterThanOrEqual(25);
    expect(before(busy.spawns)).toEqual(before(idle.spawns));

    const after = (log: Spawn[]): number => log.length - before(log).length;
    expect(Math.abs(after(busy.spawns) - after(idle.spawns))).toBeLessThanOrEqual(2);
  });
});

describe('the field after a crash', () => {
  it('sends nothing new: no rocks, comets, shards or sectors', () => {
    const world = createWorld(404);
    const buffer = createEventBuffer();
    // Deep enough into the ramp that the field is busy and comets are live.
    world.fieldTime = 90;
    for (let i = 0; i < 600 && world.ship.alive; i += 1) {
      update(world, DT, PARKED, buffer);
      buffer.drain();
    }
    expect(world.ship.alive).toBe(false);

    let asteroids = world.asteroids.active;
    let shards = world.shards.active;
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * 40; i += 1) {
      update(world, DT, PARKED, buffer);
      events.push(...buffer.drain());
      expect(world.asteroids.active).toBeLessThanOrEqual(asteroids);
      expect(world.shards.active).toBeLessThanOrEqual(shards);
      asteroids = world.asteroids.active;
      shards = world.shards.active;
    }
    expect(events).toEqual([]);
    expect(world.asteroids.active).toBe(0);
  });
});
