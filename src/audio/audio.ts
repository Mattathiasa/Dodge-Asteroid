export type SfxName =
  | 'uiSelect'
  | 'start'
  | 'nearMiss'
  | 'pickup'
  | 'shieldBreak'
  | 'lifeLost'
  | 'gameOver';

export interface AudioEngine {
  readonly muted: boolean;
  readonly available: boolean;
  /** Must be called from inside a real user gesture. */
  unlock(): void;
  play(name: SfxName): void;
  setMuted(muted: boolean): void;
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
}

const VOICES: Readonly<Record<SfxName, Voice>> = {
  uiSelect: { type: 'triangle', from: 520, to: 720, duration: 0.09, gain: 0.16 },
  start: { type: 'triangle', from: 320, to: 880, duration: 0.28, gain: 0.2 },
  nearMiss: { type: 'sine', from: 900, to: 1500, duration: 0.1, gain: 0.12 },
  pickup: { type: 'square', from: 640, to: 1180, duration: 0.18, gain: 0.15 },
  shieldBreak: { type: 'sawtooth', from: 420, to: 120, duration: 0.3, gain: 0.2, noise: 0.22 },
  lifeLost: { type: 'sawtooth', from: 300, to: 90, duration: 0.36, gain: 0.24, noise: 0.28 },
  gameOver: { type: 'sawtooth', from: 260, to: 55, duration: 0.85, gain: 0.28, noise: 0.3 },
};

/** A silent stand-in, so callers never have to null-check the engine. */
const SILENT: AudioEngine = {
  muted: true,
  available: false,
  unlock: () => undefined,
  play: () => undefined,
  setMuted: () => undefined,
  dispose: () => undefined,
};

/**
 * Sound effects synthesised at runtime.
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
  let muted = false;
  let noiseBuffer: AudioBuffer | null = null;

  const ensure = (): boolean => {
    if (context !== null) return true;
    try {
      context = create();
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
      return true;
    } catch {
      context = null;
      master = null;
      return false;
    }
  };

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

    play(name: SfxName): void {
      if (muted || !ensure() || context === null || master === null) return;
      if (context.state !== 'running') return;

      const voice = VOICES[name];
      const now = context.currentTime;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(voice.from, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, voice.to), now + voice.duration);

      gain.gain.setValueAtTime(voice.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);

      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + voice.duration + 0.02);

      if (voice.noise !== undefined) {
        const source = context.createBufferSource();
        const noiseGain = context.createGain();
        source.buffer = getNoise(context);
        noiseGain.gain.setValueAtTime(voice.noise, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
        source.connect(noiseGain).connect(master);
        source.start(now);
        source.stop(now + voice.duration + 0.02);
      }
    },

    setMuted(next: boolean): void {
      muted = next;
      if (master !== null) master.gain.value = next ? 0 : 1;
    },

    dispose(): void {
      if (context === null) return;
      void context.close().catch(() => undefined);
      context = null;
      master = null;
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
