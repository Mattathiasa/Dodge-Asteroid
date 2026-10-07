import { STORAGE_KEY } from '../config.js';
import type { Recording } from '../game/recording.js';
import type { RunFacts } from '../game/missions.js';
import type { SkinId } from '../game/unlocks.js';
import { DEFAULT_SKIN, isSkinId } from '../game/unlocks.js';
import { advance, missionsFor } from '../game/missions.js';
import { isDailyKey, previousKey } from '../core/daily.js';
import { isRecording } from '../game/recording.js';

export interface ScoreEntry {
  readonly score: number;
  readonly timeSeconds: number;
  /** Epoch milliseconds. */
  readonly at: number;
}

/** The player's results for one daily run. */
export interface DailyRecord {
  readonly key: string;
  readonly attempts: number;
  /** The best attempt's figures, which are what gets shared. */
  readonly best: number;
  readonly bestTimeSeconds: number;
  readonly bestSector: number;
  readonly bestCombo: number;
  /** The best attempt itself, so it can fly again as a ghost. */
  readonly bestRun: Recording | null;
}

/** Progress on one day's missions, in the order `missionsFor` gives them. */
export interface MissionProgress {
  readonly key: string;
  readonly progress: readonly number[];
}

export interface Profile {
  readonly version: 1;
  readonly bestScore: number;
  readonly bestTimeSeconds: number;
  readonly runs: number;
  readonly muted: boolean;
  /** Music is separate from sound effects; plenty of people want one without the other. */
  readonly music: boolean;
  /** `null` follows the operating system setting. */
  readonly reducedMotion: boolean | null;
  readonly leaderboard: readonly ScoreEntry[];
  /** The most recent day the player ran the daily, or `null` if never. */
  readonly daily: DailyRecord | null;
  /** Consecutive days with at least one daily run, ending on `daily.key`. */
  readonly streak: number;
  /** Progress on the most recent day's missions, or `null` before any. */
  readonly missions: MissionProgress | null;
  /** Ship finishes earned, beyond the one everyone starts with. */
  readonly unlocked: readonly SkinId[];
  readonly skin: SkinId;
  /** Whether a daily run races a ghost of the day's best attempt. */
  readonly ghost: boolean;
}

export const LEADERBOARD_SIZE = 10;

export const DEFAULT_PROFILE: Profile = {
  version: 1,
  bestScore: 0,
  bestTimeSeconds: 0,
  runs: 0,
  muted: false,
  music: true,
  reducedMotion: null,
  leaderboard: [],
  daily: null,
  streak: 0,
  missions: null,
  unlocked: [],
  skin: DEFAULT_SKIN,
  ghost: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function toEntries(value: unknown): ScoreEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((raw) => ({
      score: toCount(raw['score']),
      timeSeconds: typeof raw['timeSeconds'] === 'number' ? Math.max(0, raw['timeSeconds']) : 0,
      at: toCount(raw['at']),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE);
}

function toDaily(value: unknown): DailyRecord | null {
  if (!isRecord(value) || !isDailyKey(value['key'])) return null;
  const attempts = toCount(value['attempts']);
  if (attempts === 0) return null;
  const time = value['bestTimeSeconds'];
  return {
    key: value['key'],
    attempts,
    best: toCount(value['best']),
    bestTimeSeconds: typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : 0,
    bestSector: toCount(value['bestSector']),
    bestCombo: toCount(value['bestCombo']),
    bestRun: isRecording(value['bestRun']) ? value['bestRun'] : null,
  };
}

function toMissions(value: unknown): MissionProgress | null {
  if (!isRecord(value) || !isDailyKey(value['key'])) return null;
  const raw = value['progress'];
  if (!Array.isArray(raw)) return null;
  return { key: value['key'], progress: raw.slice(0, 8).map((n) => toCount(n)) };
}

function toUnlocked(value: unknown): SkinId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSkinId))].filter((id) => id !== DEFAULT_SKIN);
}

/**
 * Coerces anything at all into a valid profile.
 *
 * Persisted data is untrusted: it may be from an older version of the game,
 * hand-edited, or truncated. This never throws and never returns a partial
 * object, so the rest of the game can treat a profile as a given.
 */
export function migrate(raw: unknown): Profile {
  if (!isRecord(raw)) return DEFAULT_PROFILE;
  if (raw['version'] !== 1) return DEFAULT_PROFILE;

  const reducedMotion = raw['reducedMotion'];
  const unlocked = toUnlocked(raw['unlocked']);
  const skin = raw['skin'];
  return {
    version: 1,
    bestScore: toCount(raw['bestScore']),
    bestTimeSeconds:
      typeof raw['bestTimeSeconds'] === 'number' && Number.isFinite(raw['bestTimeSeconds'])
        ? Math.max(0, raw['bestTimeSeconds'])
        : 0,
    runs: toCount(raw['runs']),
    muted: raw['muted'] === true,
    // Profiles saved before music existed have no opinion, so default to on.
    music: raw['music'] !== false,
    reducedMotion: typeof reducedMotion === 'boolean' ? reducedMotion : null,
    leaderboard: toEntries(raw['leaderboard']),
    daily: toDaily(raw['daily']),
    streak: toCount(raw['streak']),
    missions: toMissions(raw['missions']),
    unlocked,
    // A chosen finish that is no longer owned falls back to the default.
    skin:
      isSkinId(skin) && (skin === DEFAULT_SKIN || unlocked.includes(skin)) ? skin : DEFAULT_SKIN,
    ghost: raw['ghost'] !== false,
  };
}

function safeStore(store?: Storage): Storage | null {
  if (store !== undefined) return store;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access itself throws when site data is blocked.
    return null;
  }
}

export function loadProfile(store?: Storage): Profile {
  const target = safeStore(store);
  if (target === null) return DEFAULT_PROFILE;
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PROFILE;
    return migrate(JSON.parse(raw));
  } catch {
    // Corrupt JSON, or a browser that denies access. Start fresh rather than
    // taking the whole game down with it.
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile, store?: Storage): void {
  const target = safeStore(store);
  if (target === null) return;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Quota exceeded or private-mode restrictions. Losing a high score is not
    // worth an exception in the middle of a run.
  }
}

/**
 * Folds a finished run into the profile, returning the updated copy.
 *
 * `at` identifies the run's leaderboard entry, so the caller can find and
 * highlight it.
 */
export function recordRun(
  profile: Profile,
  score: number,
  timeSeconds: number,
  at: number = Date.now(),
): Profile {
  const entry: ScoreEntry = { score, timeSeconds, at };
  const leaderboard = [...profile.leaderboard, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE);

  return {
    ...profile,
    runs: profile.runs + 1,
    bestScore: Math.max(profile.bestScore, score),
    bestTimeSeconds: Math.max(profile.bestTimeSeconds, timeSeconds),
    leaderboard,
  };
}

export interface DailyResult {
  readonly score: number;
  readonly timeSeconds: number;
  readonly sector: number;
  readonly bestCombo: number;
}

/**
 * Folds a finished daily attempt into the profile.
 *
 * Daily runs are kept apart from the endless board: they are always played at
 * the same difficulty on a field everyone shares, so mixing them in would make
 * both lists mean less. They do count as runs played.
 */
export function recordDaily(
  profile: Profile,
  key: string,
  result: DailyResult,
  run: Recording | null = null,
): Profile {
  const today = profile.daily?.key === key ? profile.daily : null;
  const improved = today === null || result.score > today.best;

  const daily: DailyRecord = {
    key,
    attempts: (today?.attempts ?? 0) + 1,
    best: improved ? result.score : today.best,
    bestTimeSeconds: improved ? result.timeSeconds : today.bestTimeSeconds,
    bestSector: improved ? result.sector : today.bestSector,
    bestCombo: improved ? result.bestCombo : today.bestCombo,
    bestRun: improved ? run : today.bestRun,
  };

  return {
    ...profile,
    runs: profile.runs + 1,
    daily,
    streak: nextStreak(profile, key),
  };
}

function nextStreak(profile: Profile, key: string): number {
  const last = profile.daily?.key;
  if (last === key) return Math.max(1, profile.streak);
  if (last !== undefined && last === previousKey(key)) return profile.streak + 1;
  return 1;
}

/**
 * The streak as it stands today: still alive if the last daily was today or
 * yesterday, and broken, so zero, if a day was missed.
 */
export function activeStreak(profile: Profile, todayKey: string): number {
  const last = profile.daily?.key;
  if (last === todayKey || last === previousKey(todayKey)) return profile.streak;
  return 0;
}

/** Today's daily record, or `null` if the player has not run today's yet. */
export function dailyToday(profile: Profile, todayKey: string): DailyRecord | null {
  return profile.daily?.key === todayKey ? profile.daily : null;
}

/** Today's mission progress, starting fresh on a new day. */
export function missionProgress(profile: Profile, todayKey: string): readonly number[] {
  return profile.missions?.key === todayKey ? profile.missions.progress : [];
}

/** Folds a run, of either kind, into the day's missions. */
export function recordMissions(profile: Profile, todayKey: string, facts: RunFacts): Profile {
  const progress = advance(missionsFor(todayKey), missionProgress(profile, todayKey), facts);
  return { ...profile, missions: { key: todayKey, progress } };
}

export function unlockSkins(profile: Profile, ids: readonly SkinId[]): Profile {
  if (ids.length === 0) return profile;
  return { ...profile, unlocked: [...new Set([...profile.unlocked, ...ids])] };
}

/** Chooses a finish, if it has been earned. */
export function chooseSkin(profile: Profile, id: SkinId): Profile {
  if (id !== DEFAULT_SKIN && !profile.unlocked.includes(id)) return profile;
  return { ...profile, skin: id };
}
