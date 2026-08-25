/**
 * Every tuning constant in the game, in one place.
 *
 * The original implementation scattered unnamed numbers through the logic
 * (`1000`, `10`, `2`, `1.09`, `2000`, `20`, `40`, `290`, `30`); changing the
 * feel of the game meant hunting through the code. Everything tunable now
 * lives here, and every module reads from it.
 */

/** Logical play-field size. The canvas letterboxes this to fit any screen. */
export const WORLD = {
  width: 480,
  height: 720,
} as const;

export const SHIP = {
  radius: 11,
  /** Acceleration toward a pointer target, in world units per second squared. */
  accel: 5200,
  /** Acceleration from keyboard input. */
  keyboardAccel: 2600,
  maxSpeed: 620,
  /** Per-second velocity retention; lower is stickier. */
  damping: 0.0016,

  /**
   * The three pickups deliberately do three different things, rather than
   * being three flavours of the same damage buffer:
   *   lives  - hit points, spent on impact (extra-life pickup adds one)
   *   shield - a timed bubble that absorbs everything while it is up
   *   slowmo - time dilation
   */
  startingLives: 1,
  maxLives: 4,
  /** Seconds a collected shield bubble stays up. */
  shieldSeconds: 6,
  /** Brief invulnerability after losing a life, so one hit is not two. */
  invulnSeconds: 1.4,
  trailLength: 14,
} as const;

/**
 * The difficulty ramp.
 *
 * Shape is `smoothstep` over a fixed ramp window: gentle for the first couple
 * of seconds, steepest in the middle, and flat once it reaches full intensity.
 * A very slow "endless" tail keeps expert runs from lasting forever, hard-capped
 * so an asteroid can never move far enough in one tick to be unfair or to
 * outrun continuous collision detection.
 */
export const DIFFICULTY = {
  /** Seconds at the start of a run with no spawns at all. */
  graceSeconds: 2,
  /** Seconds from the end of grace to full intensity. */
  rampSeconds: 120,

  spawnIntervalMs: { start: 850, peak: 240 },
  speedMin: { start: 110, peak: 240 },
  speedMax: { start: 170, peak: 420 },
  radiusMin: { start: 14, peak: 9 },
  radiusMax: { start: 26, peak: 34 },
  /** Lateral drift magnitude, world units per second. */
  driftX: { start: 20, peak: 90 },
  maxActive: { start: 5, peak: 22 },
  powerUpChance: { start: 0.04, peak: 0.1 },

  /** Randomness applied to each spawn interval, as a fraction. */
  spawnJitter: 0.25,
  /** Fractional speed gain per second once the ramp has plateaued. */
  endlessSpeedPerSecond: 0.0012,
  /** Nothing ever exceeds this, so continuous collision always has a margin. */
  absoluteMaxSpeed: 620,
} as const;

export const SCORING = {
  pointsPerSecond: 10,
  pointsPerDodge: 5,
  nearMissBonus: 15,
  /** Gap between hitboxes, in world units, that still counts as a near miss. */
  nearMissMargin: 18,
  comboWindowMs: 2500,
  /** Multiplier gained per combo step. */
  comboStep: 0.15,
  comboMax: 10,
} as const;

export const POWERUPS = {
  radius: 13,
  fallSpeed: 120,
  /** Seconds before an uncollected pickup despawns. */
  lifetimeSeconds: 12,
  slowmoSeconds: 5,
  /** Simulation rate multiplier while slow-mo is active. */
  slowmoFactor: 0.45,
  /** Relative likelihood of each kind when a pickup spawns. */
  weights: { shield: 5, slowmo: 4, life: 2 },
} as const;

export const PARTICLES = {
  capacity: 512,
  burstOnHit: 46,
  burstOnPickup: 20,
  burstOnShieldBreak: 30,
  minSpeed: 40,
  maxSpeed: 320,
  minLife: 0.3,
  maxLife: 0.95,
  drag: 0.86,
} as const;

export const CAMERA = {
  /** Trauma added on each event; shake is trauma squared, which feels right. */
  traumaOnHit: 0.85,
  traumaOnShieldBreak: 0.5,
  traumaOnPickup: 0.15,
  traumaDecayPerSecond: 1.4,
  maxOffset: 22,
} as const;

export const INPUT = {
  /**
   * Touches steer a point above the finger, because a fingertip physically
   * covers the ship otherwise. This is the difference between the game being
   * playable on a phone and being unplayable on one.
   */
  touchYOffset: 46,
  /** Below this pointer movement the ship keeps its previous target. */
  deadZone: 0.5,
} as const;

export const LOOP = {
  /** Fixed simulation step. Physics never varies with frame rate. */
  fixedDt: 1 / 60,
  /** Longest wall-clock frame the loop will catch up on, in seconds. */
  maxFrameDt: 0.25,
} as const;

export const SPAWN = {
  asteroidCapacity: 64,
  powerUpCapacity: 8,
  /** Distinct asteroid silhouettes. */
  shapeCount: 5,
} as const;

/** Named colours, so the palette can be changed in one edit. */
export const PALETTE = {
  background: '#080a1f',
  backgroundGlow: '#1a1040',
  starFar: '#3b3f7a',
  starMid: '#6f77c4',
  starNear: '#b9c0ff',
  ship: '#4ff0ff',
  shipGlow: '#0affff',
  shipTrail: '#2ad4ff',
  shield: '#7dffc4',
  asteroid: '#ff4fa3',
  asteroidGlow: '#ff2d8a',
  asteroidCore: '#3a0f2a',
  powerShield: '#7dffc4',
  powerSlowmo: '#ffd35c',
  powerLife: '#ff7bd5',
  text: '#e8ecff',
} as const;

export const STORAGE_KEY = 'dodge-asteroid:profile';
