/**
 * A moving body.
 *
 * `px`/`py` hold the position at the previous simulation tick. Keeping them on
 * every body is what lets the renderer interpolate between fixed-timestep
 * states, so motion stays smooth on displays faster than the simulation rate.
 */
export interface Body {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
}

export interface Ship extends Body {
  lives: number;
  /** Seconds remaining on the collected shield bubble. */
  shieldTime: number;
  /** Seconds remaining of post-hit invulnerability. */
  invulnTime: number;
  /** Seconds remaining of time dilation. */
  slowmoTime: number;
  /** Recent positions, newest last, for the motion trail. */
  trail: number[];
}

export interface Asteroid extends Body {
  rot: number;
  rotSpeed: number;
  /** Index into the renderer's silhouette table. */
  shape: number;
  /** Index into the renderer's colour families. */
  skin: number;
  /** Whether this asteroid has already been scored as dodged. */
  scored: boolean;
  /** Whether it is inside the near-miss margin of the ship right now. */
  grazing: boolean;
  /** Whether a near-miss bonus has already been awarded for it. */
  nearMissed: boolean;
  /** Whether this is a telegraphed comet rather than an ordinary rock. */
  comet: boolean;
  /** Seconds left on a comet's lane warning; it holds still until this is 0. */
  warn: number;
  /**
   * Destroyed by the player, but still occupying its place in the field.
   *
   * A ghost is invisible and harmless and leaves when the rock would have. It
   * exists so that what the player destroys cannot change what spawns next:
   * the spawner's crowding check counts it exactly as if it were still there.
   */
  ghost: boolean;
}

/** A collectible. Shards are worth points and pulled in when the ship is close. */
export interface Shard extends Body {
  /** Seconds this shard has existed, for its spin and sparkle. */
  age: number;
}

export type PowerUpKind = 'shield' | 'slowmo' | 'life';

export interface PowerUp extends Body {
  kind: PowerUpKind;
  /** Seconds this pickup has existed, for despawn and pulse animation. */
  age: number;
}

export interface Particle extends Body {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export function createShip(x: number, y: number, radius: number): Ship {
  return {
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    r: radius,
    alive: true,
    lives: 1,
    shieldTime: 0,
    invulnTime: 0,
    slowmoTime: 0,
    trail: [],
  };
}

export function createAsteroid(): Asteroid {
  return {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    r: 1,
    alive: false,
    rot: 0,
    rotSpeed: 0,
    shape: 0,
    skin: 0,
    scored: false,
    grazing: false,
    nearMissed: false,
    comet: false,
    warn: 0,
    ghost: false,
  };
}

export function createShard(): Shard {
  return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 1, alive: false, age: 0 };
}

export function createPowerUp(): PowerUp {
  return {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    r: 1,
    alive: false,
    kind: 'shield',
    age: 0,
  };
}

export function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    r: 1,
    alive: false,
    life: 0,
    maxLife: 1,
    color: '#ffffff',
    size: 2,
  };
}
