/**
 * The daily run: one seed per UTC day, the same for everyone.
 *
 * UTC rather than local time, so that "today's field" is one field worldwide.
 * Everything here is a pure function of a date key, so it is trivially tested
 * and a server could compute the same seed to verify a score.
 */

/** The date of Daily #1. */
export const DAILY_EPOCH = '2026-10-07';

const DAY_MS = 86_400_000;
const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a string is a well-formed `YYYY-MM-DD` key. */
export function isDailyKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

/** The `YYYY-MM-DD` key for the UTC day containing `at`. */
export function dailyKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function dayStart(key: string): number {
  const match = KEY_PATTERN.exec(key);
  if (match === null) throw new RangeError(`not a daily key: ${key}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** The key for the day before. */
export function previousKey(key: string): string {
  return dailyKey(new Date(dayStart(key) - DAY_MS));
}

/** The run's number, counting the epoch as #1. */
export function dailyNumber(key: string): number {
  return Math.round((dayStart(key) - dayStart(DAILY_EPOCH)) / DAY_MS) + 1;
}

/**
 * The seed for a day.
 *
 * FNV-1a over the key, then a finaliser so that consecutive days, whose keys
 * differ by a character, still land far apart in seed space.
 */
export function dailySeed(key: string): number {
  const text = `dodge-asteroid/daily/${key}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
