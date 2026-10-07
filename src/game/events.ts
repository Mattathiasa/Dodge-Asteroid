import type { PowerUpKind } from './entities.js';

/**
 * Something the simulation observed.
 *
 * The simulation emits these instead of calling into audio, the camera or the
 * DOM directly. That one seam is what keeps `game/` free of browser APIs and
 * lets tests assert on what happened rather than on mocks.
 */
export type SimEvent =
  /** Where the rock skimmed the ship, so the reward can appear right there. */
  | { type: 'nearMiss'; combo: number; points: number; x: number; y: number }
  | { type: 'dodge'; points: number }
  | { type: 'pickup'; kind: PowerUpKind; x: number; y: number }
  /** `chain` counts shards collected in quick succession, starting at 1. */
  | { type: 'shard'; points: number; chain: number; x: number; y: number }
  | { type: 'cometWarning'; x: number }
  | { type: 'sector'; index: number }
  | { type: 'shieldBreak'; x: number; y: number; r: number; skin: number }
  | { type: 'lifeLost'; x: number; y: number; livesLeft: number; r: number; skin: number }
  | { type: 'destroyed'; x: number; y: number; r: number; skin: number }
  | { type: 'milestone'; points: number };

export interface SimEventSink {
  emit(event: SimEvent): void;
}

/** Collects events in an array. Used by tests and by the composition root. */
export function createEventBuffer(): SimEventSink & { drain(): SimEvent[] } {
  const events: SimEvent[] = [];
  return {
    emit: (event) => void events.push(event),
    drain: () => events.splice(0, events.length),
  };
}
