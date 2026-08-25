import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  LEADERBOARD_SIZE,
  loadProfile,
  migrate,
  recordRun,
  saveProfile,
} from './storage.js';

/** A minimal in-memory Storage stand-in. */
function memoryStore(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('migrate', () => {
  // Persisted data is untrusted: old versions, hand edits, truncated writes.
  it.each([
    null,
    undefined,
    42,
    'nope',
    [],
    {},
    { version: 0 },
    { version: 99, bestScore: 10 },
    { version: 1, bestScore: 'x' },
    { version: 1, bestScore: -5 },
    { version: 1, bestScore: NaN },
    { version: 1, bestScore: Infinity },
    { version: 1, leaderboard: 'not-an-array' },
  ])('coerces %o into a valid profile', (input) => {
    const profile = migrate(input);
    expect(profile.version).toBe(1);
    expect(profile.bestScore).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(profile.bestScore)).toBe(true);
    expect(Array.isArray(profile.leaderboard)).toBe(true);
  });

  it('keeps valid values', () => {
    const profile = migrate({
      version: 1,
      bestScore: 1234,
      bestTimeSeconds: 88.5,
      runs: 7,
      muted: true,
      reducedMotion: false,
      leaderboard: [{ score: 50, timeSeconds: 5, at: 1 }],
    });
    expect(profile.bestScore).toBe(1234);
    expect(profile.bestTimeSeconds).toBe(88.5);
    expect(profile.runs).toBe(7);
    expect(profile.muted).toBe(true);
    expect(profile.reducedMotion).toBe(false);
    expect(profile.leaderboard).toHaveLength(1);
  });

  it('drops junk leaderboard entries and sorts what remains', () => {
    const profile = migrate({
      version: 1,
      leaderboard: [
        { score: 10, timeSeconds: 1, at: 1 },
        'garbage',
        { score: 'bad' },
        { score: 90, timeSeconds: 9, at: 2 },
        null,
      ],
    });
    expect(profile.leaderboard.map((e) => e.score)).toEqual([90, 10]);
  });
});

describe('loadProfile / saveProfile', () => {
  it('round-trips a profile', () => {
    const store = memoryStore();
    const saved = { ...DEFAULT_PROFILE, bestScore: 777, runs: 3 };
    saveProfile(saved, store);
    expect(loadProfile(store).bestScore).toBe(777);
    expect(loadProfile(store).runs).toBe(3);
  });

  it('falls back to defaults on corrupt JSON', () => {
    const store = memoryStore({ 'dodge-asteroid:profile': '{not json' });
    expect(loadProfile(store)).toEqual(DEFAULT_PROFILE);
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(loadProfile(memoryStore())).toEqual(DEFAULT_PROFILE);
  });

  it('does not throw when the store denies writes', () => {
    const hostile = {
      ...memoryStore(),
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    } as Storage;
    expect(() => saveProfile(DEFAULT_PROFILE, hostile)).not.toThrow();
  });

  it('does not throw when the store denies reads', () => {
    const hostile = {
      ...memoryStore(),
      getItem: () => {
        throw new DOMException('SecurityError');
      },
    } as Storage;
    expect(() => loadProfile(hostile)).not.toThrow();
    expect(loadProfile(hostile)).toEqual(DEFAULT_PROFILE);
  });
});

describe('recordRun', () => {
  it('raises the personal best and counts the run', () => {
    const after = recordRun(DEFAULT_PROFILE, 500, 42);
    expect(after.bestScore).toBe(500);
    expect(after.bestTimeSeconds).toBe(42);
    expect(after.runs).toBe(1);
  });

  it('keeps a lower score from lowering the best', () => {
    const first = recordRun(DEFAULT_PROFILE, 900, 60);
    const second = recordRun(first, 100, 10);
    expect(second.bestScore).toBe(900);
    expect(second.bestTimeSeconds).toBe(60);
    expect(second.runs).toBe(2);
  });

  it('keeps the leaderboard sorted and bounded', () => {
    let profile = DEFAULT_PROFILE;
    for (let i = 1; i <= LEADERBOARD_SIZE + 8; i += 1) {
      profile = recordRun(profile, i * 10, i);
    }
    expect(profile.leaderboard).toHaveLength(LEADERBOARD_SIZE);
    const scores = profile.leaderboard.map((e) => e.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(scores[0]).toBe((LEADERBOARD_SIZE + 8) * 10);
  });
});
