import { describe, expect, it } from 'vitest';
import type { Recording } from '../game/recording.js';
import { missionsFor } from '../game/missions.js';
import {
  DEFAULT_PROFILE,
  chooseSkin,
  missionProgress,
  recordMissions,
  unlockSkins,
  LEADERBOARD_SIZE,
  activeStreak,
  dailyToday,
  loadProfile,
  migrate,
  recordDaily,
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

  it('defaults music on for profiles saved before it existed', () => {
    expect(migrate({ version: 1, bestScore: 5 }).music).toBe(true);
    expect(migrate({ version: 1, music: 'yes' }).music).toBe(true);
    expect(migrate({ version: 1, music: false }).music).toBe(false);
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

  it('stamps the entry with the given time, so the caller can find it again', () => {
    let profile = recordRun(DEFAULT_PROFILE, 300, 20, 1000);
    profile = recordRun(profile, 300, 25, 2000);
    profile = recordRun(profile, 900, 40, 3000);
    expect(profile.leaderboard.map((e) => e.at)).toEqual([3000, 1000, 2000]);
  });
});

describe('recordDaily', () => {
  const result = (score: number, sector = 1, bestCombo = 3) => ({
    score,
    timeSeconds: score / 10,
    sector,
    bestCombo,
  });

  it('starts a record on the first attempt of the day', () => {
    const profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(500, 2, 7));
    expect(profile.daily).toEqual({
      key: '2026-10-08',
      attempts: 1,
      best: 500,
      bestTimeSeconds: 50,
      bestSector: 2,
      bestCombo: 7,
      bestRun: null,
    });
    expect(profile.streak).toBe(1);
    expect(profile.runs).toBe(1);
  });

  it('keeps the best attempt, with its own figures, and counts every attempt', () => {
    let profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(500, 2, 7));
    profile = recordDaily(profile, '2026-10-08', result(900, 4, 5));
    profile = recordDaily(profile, '2026-10-08', result(300, 1, 12));
    expect(profile.daily).toMatchObject({ attempts: 3, best: 900, bestSector: 4, bestCombo: 5 });
    expect(profile.streak).toBe(1);
  });

  it('never touches the endless board or best', () => {
    const profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(5000));
    expect(profile.bestScore).toBe(0);
    expect(profile.leaderboard).toEqual([]);
  });

  it('starts a fresh record on a new day', () => {
    let profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(900));
    profile = recordDaily(profile, '2026-10-09', result(100));
    expect(profile.daily).toMatchObject({ key: '2026-10-09', attempts: 1, best: 100 });
  });

  it('extends the streak on consecutive days and resets it after a gap', () => {
    let profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(1));
    profile = recordDaily(profile, '2026-10-09', result(1));
    profile = recordDaily(profile, '2026-10-09', result(1));
    profile = recordDaily(profile, '2026-10-10', result(1));
    expect(profile.streak).toBe(3);

    profile = recordDaily(profile, '2026-10-12', result(1));
    expect(profile.streak).toBe(1);
  });
});

describe('activeStreak', () => {
  const played = (key: string, streak: number) => ({
    ...DEFAULT_PROFILE,
    daily: {
      key,
      attempts: 1,
      best: 1,
      bestTimeSeconds: 1,
      bestSector: 0,
      bestCombo: 0,
      bestRun: null,
    },
    streak,
  });

  it('is still alive the day after, so a streak is not lost before you can play', () => {
    expect(activeStreak(played('2026-10-08', 4), '2026-10-08')).toBe(4);
    expect(activeStreak(played('2026-10-08', 4), '2026-10-09')).toBe(4);
  });

  it('is broken once a whole day is missed', () => {
    expect(activeStreak(played('2026-10-08', 4), '2026-10-10')).toBe(0);
    expect(activeStreak(DEFAULT_PROFILE, '2026-10-10')).toBe(0);
  });

  it("only reports today's record as today's", () => {
    expect(dailyToday(played('2026-10-08', 1), '2026-10-08')?.best).toBe(1);
    expect(dailyToday(played('2026-10-08', 1), '2026-10-09')).toBeNull();
  });
});

describe('migrate daily data', () => {
  it('keeps a valid record and drops a malformed one', () => {
    const daily = {
      key: '2026-10-08',
      attempts: 2,
      best: 40,
      bestTimeSeconds: 4,
      bestSector: 0,
      bestCombo: 2,
      bestRun: null,
    };
    expect(migrate({ version: 1, daily, streak: 3 }).daily).toEqual(daily);
    expect(migrate({ version: 1, daily, streak: 3 }).streak).toBe(3);
    expect(migrate({ version: 1, daily: { ...daily, key: 'today' } }).daily).toBeNull();
    expect(migrate({ version: 1, daily: { ...daily, attempts: 0 } }).daily).toBeNull();
    expect(migrate({ version: 1, daily: 'nope', streak: -2 })).toMatchObject({
      daily: null,
      streak: 0,
    });
  });
});

describe('the best daily run, kept as a ghost', () => {
  const run = (ticks: number): Recording => ({
    version: 1,
    seed: 7,
    scale: 1,
    ticks,
    data: 'AQA=',
  });
  const result = (score: number) => ({ score, timeSeconds: 1, sector: 0, bestCombo: 0 });

  it('keeps the recording of the best attempt only', () => {
    let profile = recordDaily(DEFAULT_PROFILE, '2026-10-08', result(500), run(1));
    profile = recordDaily(profile, '2026-10-08', result(300), run(2));
    expect(profile.daily?.bestRun?.ticks).toBe(1);
    profile = recordDaily(profile, '2026-10-08', result(900), run(3));
    expect(profile.daily?.bestRun?.ticks).toBe(3);
  });

  it('survives a save and load, and a corrupt one is dropped', () => {
    const store = memoryStore();
    saveProfile(recordDaily(DEFAULT_PROFILE, '2026-10-08', result(500), run(42)), store);
    expect(loadProfile(store).daily?.bestRun?.ticks).toBe(42);

    const daily = {
      key: '2026-10-08',
      attempts: 1,
      best: 5,
      bestTimeSeconds: 1,
      bestSector: 0,
      bestCombo: 0,
      bestRun: { version: 1, seed: 'x' },
    };
    expect(migrate({ version: 1, daily }).daily?.bestRun).toBeNull();
  });
});

describe('missions', () => {
  const facts = { nearMisses: 3, bestCombo: 2, shards: 5, sector: 0, survivalTime: 12, pickups: 1 };

  it("starts each day's progress from nothing and builds on it", () => {
    expect(missionProgress(DEFAULT_PROFILE, '2026-10-08')).toEqual([]);
    let profile = recordMissions(DEFAULT_PROFILE, '2026-10-08', facts);
    expect(profile.missions?.progress).toHaveLength(missionsFor('2026-10-08').length);
    const first = missionProgress(profile, '2026-10-08');
    profile = recordMissions(profile, '2026-10-08', facts);
    missionProgress(profile, '2026-10-08').forEach((value, i) =>
      expect(value).toBeGreaterThanOrEqual(first[i] ?? 0),
    );
    expect(missionProgress(profile, '2026-10-09')).toEqual([]);
  });
});

describe('ship finishes', () => {
  it('can only be chosen once earned', () => {
    expect(chooseSkin(DEFAULT_PROFILE, 'gold').skin).toBe('mint');
    const owned = unlockSkins(DEFAULT_PROFILE, ['gold']);
    expect(chooseSkin(owned, 'gold').skin).toBe('gold');
    expect(unlockSkins(owned, ['gold']).unlocked).toEqual(['gold']);
  });

  it('falls back to the default if a saved choice is not owned or not real', () => {
    expect(migrate({ version: 1, skin: 'gold', unlocked: [] }).skin).toBe('mint');
    expect(migrate({ version: 1, skin: 'gold', unlocked: ['gold'] }).skin).toBe('gold');
    expect(
      migrate({ version: 1, skin: 'rainbow', unlocked: ['rainbow', 'gold', 'gold'] }),
    ).toMatchObject({ skin: 'mint', unlocked: ['gold'] });
  });

  it('races the ghost unless the player turned it off', () => {
    expect(migrate({ version: 1 }).ghost).toBe(true);
    expect(migrate({ version: 1, ghost: false }).ghost).toBe(false);
  });
});
