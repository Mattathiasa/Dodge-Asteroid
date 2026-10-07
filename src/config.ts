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
  /** Share of spawns that are telegraphed comets rather than rocks. */
  cometChance: { start: 0.05, peak: 0.16 },
  /** Milliseconds between strings of star shards. */
  shardIntervalMs: { start: 3600, peak: 2300 },

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

/**
 * Comets are the one hazard that is telegraphed: a lane lights up, then a fast
 * rock comes straight down it. Speed without warning is unfair; speed with a
 * clear warning is a test of attention, which is the point.
 */
export const COMETS = {
  /** Intensity below which no comets appear, so the opening stays readable. */
  minIntensity: 0.12,
  /** Seconds the lane is lit before the comet launches. */
  warnSeconds: 0.95,
  speed: 560,
  radiusMin: 9,
  radiusMax: 12,
  /** Index into the renderer's colour families, reserved for comets. */
  skin: 5,
} as const;

/**
 * Star shards are the reason to move. Without them the best strategy is to
 * hover low and wait, which is safe and dull; a string of shards drifting
 * between two rocks is a decision.
 */
export const SHARDS = {
  radius: 8,
  fallSpeed: 150,
  countMin: 3,
  countMax: 5,
  /** Vertical gap between shards in one string. */
  spacing: 30,
  /** Largest sideways step between shards, for diagonal strings. */
  maxStepX: 24,
  /** Shards inside this distance are pulled toward the ship. */
  magnetRadius: 58,
  magnetAccel: 2600,
  points: 10,
  /** Shards collected within this window of each other form a chain. */
  chainWindowMs: 650,
  capacity: 32,
} as const;

/** The field changes character every so often, and says so. */
export const SECTORS = {
  /** Seconds of (difficulty-scaled) time per sector. */
  seconds: 25,
  /** How often a rock takes the sector's colour family rather than a random one. */
  skinBias: 0.65,
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

/**
 * Moments the game deliberately holds on, because an impact that resolves in a
 * single frame does not register as an impact.
 */
export const FEEL = {
  /** Seconds the simulation freezes when a life is lost. */
  hitStopOnLifeLost: 0.11,
  /** Seconds the simulation freezes on the fatal hit. */
  hitStopOnDestroyed: 0.16,
  /** Seconds the explosion plays before the run-over screen appears. */
  deathSeconds: 1.15,
  /** World time scale while the explosion plays out. */
  deathTimeScale: 0.35,
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
  shapeCount: 6,
  /** Distinct rock colour families. Comets have one more, of their own. */
  skinCount: 5,
} as const;

/**
 * Named colours, so the palette can be changed in one edit.
 *
 * "Deep sea": a dark teal field, bone panels, coral for action and a
 * bioluminescent mint ship. Hazards stay in warm or saturated families, so
 * nothing that can kill you shares a hue with the field or with the ship.
 * The stylesheet's tokens mirror these, so the frame and the field match.
 */
export const PALETTE = {
  background: '#04141c',
  backgroundGlow: '#0b3442',
  starFar: '#1d4752',
  starMid: '#4d8c96',
  starNear: '#d2f5ef',
  /** Outlines and text on light surfaces. */
  ink: '#0b1f26',
  /** Light surfaces and text on dark ones. */
  bone: '#f4efe6',
  ship: '#7dffd8',
  shipGlow: '#2effc0',
  shipTrail: '#5cf2c9',
  shipShade: '#12957a',
  shipOutline: '#063a30',
  shipCockpit: '#05282a',
  shield: '#7cc8ff',
  /** Sparks thrown off when a rock hits the ship. */
  asteroid: '#ff6b4a',
  powerShield: '#7cc8ff',
  powerSlowmo: '#ffc94a',
  powerLife: '#ff8ab3',
  combo: '#ffc94a',
  shard: '#ffe7a3',
  shardCore: '#fffaf0',
  danger: '#ff3d6e',
} as const;

export const STORAGE_KEY = 'dodge-asteroid:profile';
