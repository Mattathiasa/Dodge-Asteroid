import { STORAGE_KEY } from '../config.js';

export interface ScoreEntry {
  readonly score: number;
  readonly timeSeconds: number;
  /** Epoch milliseconds. */
  readonly at: number;
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
