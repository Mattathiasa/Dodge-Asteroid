import type { FrameInput } from './update.js';
import type { SimEventSink } from './events.js';
import type { World } from './world.js';
import { LOOP } from '../config.js';
import { createWorld } from './world.js';
import { normalizeAxis } from './movement.js';
import { update } from './update.js';

/**
 * A run, reduced to what it takes to play it again exactly: the seed, the
 * difficulty, and the input fed to every tick.
 *
 * The simulation is a pure function of these, so a recording replays to the
 * same score, the same crash and the same path, tick for tick. Ghosts are
 * built on that, and so could a server that checks scores.
 */
export interface Recording {
  readonly version: 1;
  readonly seed: number;
  readonly scale: number;
  readonly ticks: number;
  /** Run-length encoded inputs; see `Recorder`. */
  readonly data: string;
}

/** Pointer targets are kept to a sixteenth of a world unit. */
const TARGET_STEP = 16;
const INT16_MAX = 32767;

/** Input kinds, as stored. */
const NONE = 0; // steering was not accepted this tick
const TARGET = 1; // steering toward a point
const AXIS = 2; // steering by keyboard, as raw key directions

const NO_INPUT: FrameInput = {
  steer: { target: null, axis: { x: 0, y: 0 } },
  canSteer: false,
};

function clampInt16(value: number): number {
  return Math.max(-INT16_MAX, Math.min(INT16_MAX, Math.round(value)));
}

function decode(kind: number, a: number, b: number): FrameInput {
  if (kind === TARGET) {
    return {
      steer: { target: { x: a / TARGET_STEP, y: b / TARGET_STEP }, axis: { x: 0, y: 0 } },
      canSteer: true,
    };
  }
  if (kind === AXIS) {
    return { steer: { target: null, axis: normalizeAxis(a, b) }, canSteer: true };
  }
  return NO_INPUT;
}

/**
 * Records a run as it is played.
 *
 * `record` quantises the input and returns the quantised version, which is
 * what the caller must feed to the simulation. Recording what was *fed*,
 * rather than what the mouse reported, is what makes the replay exact.
 */
export class Recorder {
  /** Flat runs of [count, kind, a, b]. */
  private readonly runs: number[] = [];
  private count = 0;

  constructor(
    private readonly seed: number,
    private readonly scale: number,
  ) {}

  get ticks(): number {
    return this.count;
  }

  record(input: FrameInput): FrameInput {
    let kind: number;
    let a = 0;
    let b = 0;
    const { target, axis } = input.steer;

    if (!input.canSteer) {
      kind = NONE;
    } else if (target !== null) {
      kind = TARGET;
      a = clampInt16(target.x * TARGET_STEP);
      b = clampInt16(target.y * TARGET_STEP);
    } else {
      kind = AXIS;
      a = Math.sign(axis.x);
      b = Math.sign(axis.y);
    }

    const last = this.runs.length - 4;
    if (
      last >= 0 &&
      this.runs[last + 1] === kind &&
      this.runs[last + 2] === a &&
      this.runs[last + 3] === b &&
      (this.runs[last] ?? 0) < INT16_MAX
    ) {
      this.runs[last] = (this.runs[last] ?? 0) + 1;
    } else {
      this.runs.push(1, kind, a, b);
    }
    this.count += 1;
    return decode(kind, a, b);
  }

  finish(): Recording {
    const bytes = new Uint8Array(Int16Array.from(this.runs).buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return {
      version: 1,
      seed: this.seed,
      scale: this.scale,
      ticks: this.count,
      data: btoa(binary),
    };
  }
}

function decodeRuns(data: string): Int16Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

/** Hands back a recording's inputs one tick at a time. */
export class Playback {
  private readonly runs: Int16Array;
  private index = 0;
  private left = 0;
  private current: FrameInput = NO_INPUT;
  private played = 0;

  constructor(private readonly recording: Recording) {
    this.runs = decodeRuns(recording.data);
  }

  get done(): boolean {
    return this.played >= this.recording.ticks;
  }

  /** The next tick's input, or `null` once the recording is over. */
  next(): FrameInput | null {
    if (this.done) return null;
    if (this.left === 0) {
      if (this.index + 3 >= this.runs.length) return null;
      this.left = this.runs[this.index] ?? 0;
      this.current = decode(
        this.runs[this.index + 1] ?? 0,
        this.runs[this.index + 2] ?? 0,
        this.runs[this.index + 3] ?? 0,
      );
      this.index += 4;
    }
    this.left -= 1;
    this.played += 1;
    return this.current;
  }
}

const SILENT: SimEventSink = { emit: () => undefined };

/** A world set up exactly as the recorded run began. */
export function worldFor(recording: Recording): World {
  const world = createWorld(recording.seed);
  world.difficultyScale = recording.scale;
  return world;
}

/** Plays a recording through to its end and returns the final world. */
export function replay(recording: Recording, events: SimEventSink = SILENT): World {
  const world = worldFor(recording);
  const playback = new Playback(recording);
  for (let input = playback.next(); input !== null; input = playback.next()) {
    update(world, LOOP.fixedDt, input, events);
  }
  return world;
}

/** Whether something read back from storage is a usable recording. */
export function isRecording(value: unknown): value is Recording {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r['version'] === 1 &&
    typeof r['seed'] === 'number' &&
    Number.isInteger(r['seed']) &&
    typeof r['scale'] === 'number' &&
    Number.isFinite(r['scale']) &&
    typeof r['ticks'] === 'number' &&
    Number.isInteger(r['ticks']) &&
    r['ticks'] >= 0 &&
    typeof r['data'] === 'string' &&
    // A sanity cap: a quarter of a megabyte is hours of the busiest input.
    r['data'].length < 262_144
  );
}
