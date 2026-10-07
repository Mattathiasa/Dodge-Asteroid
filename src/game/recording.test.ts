import { describe, expect, it } from 'vitest';
import type { FrameInput } from './update.js';
import { LOOP, WORLD } from '../config.js';
import { Playback, Recorder, isRecording, replay, worldFor } from './recording.js';
import { createEventBuffer } from './events.js';
import { update } from './update.js';

const DT = LOOP.fixedDt;

/** A busy, varied player: pointer sweeps, keyboard stretches, idle spells. */
function playerAt(tick: number): FrameInput {
  const phase = Math.floor(tick / 240) % 3;
  if (phase === 0) {
    return {
      steer: {
        target: {
          x: WORLD.width / 2 + Math.sin(tick / 37) * 180.123,
          y: 560 + Math.cos(tick / 53) * 70.456,
        },
        axis: { x: 0, y: 0 },
      },
      canSteer: true,
    };
  }
  if (phase === 1) {
    const x = Math.sign(Math.sin(tick / 19));
    const y = tick % 120 < 60 ? -1 : 1;
    return {
      steer: { target: null, axis: { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 } },
      canSteer: true,
    };
  }
  return { steer: { target: null, axis: { x: 0, y: 0 } }, canSteer: true };
}

/** Plays a run live through a recorder, the way the game does. */
function playLive(seed: number, scale = 1) {
  const world = worldFor({ version: 1, seed, scale, ticks: 0, data: '' });
  const recorder = new Recorder(seed, scale);
  const buffer = createEventBuffer();
  const path: string[] = [];
  for (let tick = 0; tick < 60 * 120 && world.ship.alive; tick += 1) {
    const fed = recorder.record(playerAt(tick));
    update(world, DT, fed, buffer);
    buffer.drain();
    path.push(`${world.ship.x.toFixed(6)},${world.ship.y.toFixed(6)}`);
  }
  return { world, recording: recorder.finish(), path };
}

describe('Recorder and replay', () => {
  it('replays a run to the same score, the same crash and the same tick', () => {
    for (const seed of [1, 77, 4242]) {
      const live = playLive(seed);
      const again = replay(live.recording);
      expect(again.score.points).toBe(live.world.score.points);
      expect(again.score.nearMisses).toBe(live.world.score.nearMisses);
      expect(again.score.shards).toBe(live.world.score.shards);
      expect(again.ship.alive).toBe(live.world.ship.alive);
      expect(again.elapsed).toBe(live.world.elapsed);
    }
  });

  it('retraces the exact path', () => {
    const live = playLive(9001);
    const world = worldFor(live.recording);
    const playback = new Playback(live.recording);
    const buffer = createEventBuffer();
    const path: string[] = [];
    for (let input = playback.next(); input !== null; input = playback.next()) {
      update(world, DT, input, buffer);
      buffer.drain();
      path.push(`${world.ship.x.toFixed(6)},${world.ship.y.toFixed(6)}`);
    }
    expect(path).toEqual(live.path);
  });

  it('honours the difficulty it was recorded at', () => {
    const live = playLive(5, 1.7);
    expect(live.recording.scale).toBe(1.7);
    expect(replay(live.recording).score.points).toBe(live.world.score.points);
  });

  it('stays compact, by collapsing repeated input', () => {
    const recorder = new Recorder(1, 1);
    const still: FrameInput = {
      steer: { target: { x: 200, y: 500 }, axis: { x: 0, y: 0 } },
      canSteer: true,
    };
    for (let i = 0; i < 60 * 60 * 5; i += 1) recorder.record(still);
    const recording = recorder.finish();
    expect(recording.ticks).toBe(18000);
    // Five minutes of a parked ship is a handful of runs, not 18,000 entries.
    expect(recording.data.length).toBeLessThan(40);
  });

  it('plays back exactly the ticks it recorded, then stops', () => {
    const recorder = new Recorder(1, 1);
    for (let i = 0; i < 10; i += 1) recorder.record(playerAt(i));
    const playback = new Playback(recorder.finish());
    let count = 0;
    while (playback.next() !== null) count += 1;
    expect(count).toBe(10);
    expect(playback.done).toBe(true);
  });

  it('records no steering as no steering', () => {
    const recorder = new Recorder(1, 1);
    const fed = recorder.record({
      steer: { target: { x: 5, y: 5 }, axis: { x: 0, y: 0 } },
      canSteer: false,
    });
    expect(fed.canSteer).toBe(false);
  });
});

describe('isRecording', () => {
  it('accepts what the recorder produces and rejects anything else', () => {
    expect(isRecording(playLive(3).recording)).toBe(true);
    expect(isRecording(null)).toBe(false);
    expect(isRecording({ version: 2, seed: 1, scale: 1, ticks: 1, data: '' })).toBe(false);
    expect(isRecording({ version: 1, seed: 1.5, scale: 1, ticks: 1, data: '' })).toBe(false);
    expect(isRecording({ version: 1, seed: 1, scale: 1, ticks: -1, data: '' })).toBe(false);
    expect(
      isRecording({ version: 1, seed: 1, scale: 1, ticks: 1, data: 'x'.repeat(300_000) }),
    ).toBe(false);
  });
});
