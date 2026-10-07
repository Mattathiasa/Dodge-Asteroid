import { clamp01 } from '../core/math.js';

/**
 * `calm` is the menu and run-over bed; `run` builds with the field.
 */
export type MusicMode = 'off' | 'calm' | 'run';

export type MusicVoice = 'pad' | 'bass' | 'kick' | 'hat' | 'lead';

export interface MusicNote {
  readonly voice: MusicVoice;
  /** Hz. Zero for unpitched voices. */
  readonly freq: number;
  /** Length in sixteenth-note steps, so the pattern is independent of tempo. */
  readonly steps: number;
  readonly gain: number;
}

/** A minor, i–VI–III–VII: Am, F, C, G. Roots in the second octave. */
const ROOTS: readonly number[] = [110, 87.31, 130.81, 98];
const MINOR = [1, 6 / 5, 3 / 2] as const;
const MAJOR = [1, 5 / 4, 3 / 2] as const;
const CHORDS: readonly (readonly number[])[] = [MINOR, MAJOR, MAJOR, MAJOR];

const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);
/** Which chord tone the arpeggio plays on each even step. */
const ARP = [0, 1, 2, 1, 0, 2, 1, 2] as const;

/** The layers come in one at a time as the run intensifies. */
export const LAYER_AT = { kick: 0.08, hat: 0.3, lead: 0.5, fullHats: 0.75 } as const;

/** Beats per minute; the track tightens as the field does. */
export function tempoFor(intensity: number): number {
  return 104 + 28 * clamp01(intensity);
}

/**
 * The notes that start on one sixteenth-note step.
 *
 * Pure, so the arrangement can be tested without an audio device: what plays
 * is a function of the step, the mode and the intensity, and nothing else.
 */
export function notesForStep(step: number, mode: MusicMode, intensity: number): MusicNote[] {
  if (mode === 'off') return [];

  const bar = Math.floor(step / 16) % ROOTS.length;
  const s = ((step % 16) + 16) % 16;
  const root = ROOTS[bar] ?? 110;
  const chord = CHORDS[bar] ?? MINOR;
  const notes: MusicNote[] = [];

  if (s === 0) {
    for (const ratio of chord) {
      notes.push({ voice: 'pad', freq: root * 2 * ratio, steps: 16, gain: 0.03 });
    }
  }

  if (mode === 'calm') {
    if (s === 0 || s === 8) notes.push({ voice: 'bass', freq: root, steps: 6, gain: 0.07 });
    return notes;
  }

  const level = clamp01(intensity);

  if (BASS_STEPS.has(s)) {
    const octave = s === 6 || s === 14 ? 2 : 1;
    notes.push({ voice: 'bass', freq: root * octave, steps: 2, gain: 0.11 });
  }
  if (level >= LAYER_AT.kick && s % 4 === 0) {
    notes.push({ voice: 'kick', freq: 0, steps: 1, gain: 0.3 });
  }
  if (level >= LAYER_AT.hat && s % 4 === 2) {
    notes.push({ voice: 'hat', freq: 0, steps: 1, gain: 0.05 });
  }
  if (level >= LAYER_AT.fullHats && s % 2 === 1) {
    notes.push({ voice: 'hat', freq: 0, steps: 1, gain: 0.025 });
  }
  if (level >= LAYER_AT.lead && s % 2 === 0) {
    const tone = chord[ARP[s / 2] ?? 0] ?? 1;
    notes.push({ voice: 'lead', freq: root * 4 * tone, steps: 1.5, gain: 0.035 });
  }

  return notes;
}

/** How far ahead notes are committed to the audio clock, in seconds. */
const LOOKAHEAD = 0.14;

/**
 * Schedules the arrangement onto a WebAudio clock.
 *
 * Driven from the game's own frame callback rather than a timer: notes are
 * queued a short way ahead on the audio clock, so a dropped frame never makes
 * the beat stutter, and a hidden tab simply stops queueing.
 */
export class MusicPlayer {
  private mode: MusicMode = 'off';
  private intensity = 0;
  private step = 0;
  private nextTime = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    const from = this.mode;
    this.mode = mode;
    // Each new section starts on a downbeat, a moment from now.
    if (mode !== 'off' && (from === 'off' || mode === 'run')) {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.06;
    }
  }

  setIntensity(intensity: number): void {
    this.intensity = intensity;
  }

  tick(): void {
    if (this.mode === 'off' || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Fell behind (the tab was hidden): pick up from now rather than bursting.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;

    while (this.nextTime < now + LOOKAHEAD) {
      const stepSeconds = 60 / tempoFor(this.intensity) / 4;
      for (const note of notesForStep(this.step, this.mode, this.intensity)) {
        this.play(note, this.nextTime, note.steps * stepSeconds);
      }
      this.nextTime += stepSeconds;
      this.step += 1;
    }
  }

  private play(note: MusicNote, at: number, length: number): void {
    const { ctx } = this;
    const gain = ctx.createGain();
    gain.connect(this.out);

    if (note.voice === 'hat') {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      source.buffer = this.noise;
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      gain.gain.setValueAtTime(note.gain, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
      source.connect(filter).connect(gain);
      source.start(at);
      source.stop(at + 0.06);
      return;
    }

    const osc = ctx.createOscillator();

    if (note.voice === 'kick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
      gain.gain.setValueAtTime(note.gain, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.18);
      return;
    }

    osc.frequency.setValueAtTime(note.freq, at);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    if (note.voice === 'bass') {
      osc.type = 'sawtooth';
      filter.frequency.value = 260 + 1100 * clamp01(this.intensity);
      filter.Q.value = 5;
    } else if (note.voice === 'lead') {
      osc.type = 'triangle';
      filter.frequency.value = 2600;
    } else {
      osc.type = 'triangle';
      filter.frequency.value = 1200;
    }

    // Pads swell in and out; everything else is plucked.
    const attack = note.voice === 'pad' ? Math.min(0.5, length * 0.3) : 0.006;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(note.gain, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(filter).connect(gain);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }
}
