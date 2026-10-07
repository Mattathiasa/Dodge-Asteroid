import type { MusicMode } from './music.js';
import { MusicPlayer } from './music.js';

export type SfxName =
  | 'uiSelect'
  | 'start'
  | 'nearMiss'
  | 'pickup'
  | 'shard'
  | 'comet'
  | 'sector'
  | 'shieldBreak'
  | 'lifeLost'
  | 'gameOver';

export interface AudioEngine {
  readonly muted: boolean;
  readonly available: boolean;
  /** Must be called from inside a real user gesture. */
  unlock(): void;
  /** `pitch` multiplies the voice's frequencies; 1 plays it as written. */
  play(name: SfxName, pitch?: number): void;
  setMuted(muted: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setMusicMode(mode: MusicMode): void;
  setMusicIntensity(intensity: number): void;
  /** Queues upcoming music. Call once per frame. */
  tick(): void;
  dispose(): void;
}

interface Voice {
  readonly type: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly gain: number;
  /** Optional short noise burst layered underneath, for impacts. */
  readonly noise?: number;
  /** Optional extra notes, as frequency ratios, played as a quick arpeggio. */
  readonly arpeggio?: readonly number[];
}

const VOICES: Readonly<Record<SfxName, Voice>> = {
  uiSelect: { type: 'triangle', from: 520, to: 720, duration: 0.09, gain: 0.16 },
  start: { type: 'triangle', from: 320, to: 880, duration: 0.28, gain: 0.2 },
  nearMiss: { type: 'sine', from: 660, to: 990, duration: 0.11, gain: 0.13 },
  pickup: { type: 'square', from: 640, to: 1180, duration: 0.18, gain: 0.13 },
  shard: { type: 'triangle', from: 1320, to: 1980, duration: 0.07, gain: 0.09 },
  comet: { type: 'sawtooth', from: 520, to: 380, duration: 0.22, gain: 0.07 },
  sector: {
    type: 'triangle',
    from: 440,
    to: 440,
    duration: 0.16,
    gain: 0.12,
    arpeggio: [5 / 4, 3 / 2, 2],
  },
  shieldBreak: { type: 'sawtooth', from: 420, to: 120, duration: 0.3, gain: 0.2, noise: 0.22 },
  lifeLost: { type: 'sawtooth', from: 300, to: 90, duration: 0.36, gain: 0.24, noise: 0.28 },
  gameOver: { type: 'sawtooth', from: 260, to: 55, duration: 0.85, gain: 0.28, noise: 0.3 },
};

/** Major pentatonic, two octaves, as ratios over the root. */
const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3, 10 / 3, 4] as const;

/**
 * The pitch for the nth step of a streak.
 *
 * A combo or a chain of shards climbs a pentatonic scale, so a good run sounds
 * like a phrase going somewhere instead of the same blip repeated. Pentatonic
 * because any two of its notes sound fine together, whatever overlaps.
 */
export function streakPitch(step: number): number {
  const index = Math.max(0, Math.min(PENTATONIC.length - 1, Math.floor(step) - 1));
  return PENTATONIC[index] ?? 1;
}

/** Music sits under the effects, never on top of them. */
const MUSIC_LEVEL = 0.6;

/** A silent stand-in, so callers never have to null-check the engine. */
const SILENT: AudioEngine = {
  muted: true,
  available: false,
  unlock: () => undefined,
  play: () => undefined,
  setMuted: () => undefined,
  setMusicEnabled: () => undefined,
  setMusicMode: () => undefined,
  setMusicIntensity: () => undefined,
  tick: () => undefined,
  dispose: () => undefined,
};

/**
 * Sound effects and music, synthesised at runtime.
 *
 * Generating tones with WebAudio rather than shipping audio files keeps the
 * repository free of binary assets and anything needing a licence, and the
 * whole engine degrades to silence rather than throwing when WebAudio is
 * unavailable or blocked.
 */
export function createAudioEngine(factory?: () => AudioContext): AudioEngine {
  const create = factory ?? resolveAudioContext();
  if (create === null) return SILENT;

  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let music: MusicPlayer | null = null;
  let muted = false;
  let musicEnabled = true;
  let musicMode: MusicMode = 'off';
  let musicIntensity = 0;
  let noiseBuffer: AudioBuffer | null = null;

  const getNoise = (ctx: AudioContext): AudioBuffer => {
    if (noiseBuffer !== null) return noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      // Decaying white noise reads as an impact rather than a hiss.
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    noiseBuffer = buffer;
    return buffer;
  };

  const ensure = (): boolean => {
    if (context !== null) return true;
    try {
      context = create();
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);

      musicBus = context.createGain();
      musicBus.gain.value = musicEnabled ? MUSIC_LEVEL : 0;
      musicBus.connect(master);
      music = new MusicPlayer(context, musicBus, getNoise(context));
      music.setIntensity(musicIntensity);
      music.setMode(musicEnabled ? musicMode : 'off');
      return true;
    } catch {
      context = null;
      master = null;
      musicBus = null;
      music = null;
      return false;
    }
  };

  const voice = (
    ctx: AudioContext,
    out: AudioNode,
    v: Voice,
    at: number,
    pitch: number,
    freq: number,
  ): void => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = v.type;
    oscillator.frequency.setValueAtTime(freq * pitch, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, (v.to / v.from) * freq * pitch),
      at + v.duration,
    );
    gain.gain.setValueAtTime(v.gain, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + v.duration);
    oscillator.connect(gain).connect(out);
    oscillator.start(at);
    oscillator.stop(at + v.duration + 0.02);
  };

  return {
    get muted() {
      return muted;
    },
    get available() {
      return context !== null;
    },

    unlock(): void {
      if (!ensure() || context === null) return;
      // Browsers start the context suspended until a genuine user gesture.
      void context.resume().catch(() => undefined);
    },

    play(name: SfxName, pitch = 1): void {
      if (muted || !ensure() || context === null || master === null) return;
      if (context.state !== 'running') return;

      const v = VOICES[name];
      const now = context.currentTime;
      voice(context, master, v, now, pitch, v.from);

      if (v.arpeggio !== undefined) {
        v.arpeggio.forEach((ratio, i) => {
          if (context === null || master === null) return;
          voice(context, master, v, now + (i + 1) * 0.075, pitch, v.from * ratio);
        });
      }

      if (v.noise !== undefined) {
        const source = context.createBufferSource();
        const noiseGain = context.createGain();
        source.buffer = getNoise(context);
        noiseGain.gain.setValueAtTime(v.noise, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + v.duration);
        source.connect(noiseGain).connect(master);
        source.start(now);
        source.stop(now + v.duration + 0.02);
      }
    },

    setMuted(next: boolean): void {
      muted = next;
      if (master !== null) master.gain.value = next ? 0 : 1;
    },

    setMusicEnabled(enabled: boolean): void {
      musicEnabled = enabled;
      if (musicBus !== null) musicBus.gain.value = enabled ? MUSIC_LEVEL : 0;
      music?.setMode(enabled ? musicMode : 'off');
    },

    setMusicMode(mode: MusicMode): void {
      musicMode = mode;
      if (musicEnabled) music?.setMode(mode);
    },

    setMusicIntensity(intensity: number): void {
      musicIntensity = intensity;
      music?.setIntensity(intensity);
    },

    tick(): void {
      // Never creates a context: music waits for the first real gesture.
      if (muted || !musicEnabled) return;
      music?.tick();
    },

    dispose(): void {
      if (context === null) return;
      void context.close().catch(() => undefined);
      context = null;
      master = null;
      musicBus = null;
      music = null;
    },
  };
}

function resolveAudioContext(): (() => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor === undefined) return null;
  return () => new Ctor();
}
