import { describe, expect, it } from 'vitest';
import { DAILY_EPOCH, dailyKey, dailyNumber, dailySeed, isDailyKey, previousKey } from './daily.js';

describe('dailyKey', () => {
  it('uses the UTC date, so the whole world shares one day', () => {
    // 23:30 on the 7th in New York is already the 8th in UTC.
    expect(dailyKey(new Date('2026-10-07T23:30:00-04:00'))).toBe('2026-10-08');
    expect(dailyKey(new Date('2026-10-08T00:00:00Z'))).toBe('2026-10-08');
    expect(dailyKey(new Date('2026-10-08T23:59:59.999Z'))).toBe('2026-10-08');
  });

  it('produces keys that validate', () => {
    expect(isDailyKey(dailyKey(new Date()))).toBe(true);
    expect(isDailyKey('2026-1-8')).toBe(false);
    expect(isDailyKey('yesterday')).toBe(false);
    expect(isDailyKey(20261008)).toBe(false);
  });
});

describe('previousKey', () => {
  it('steps back one day across month and year boundaries', () => {
    expect(previousKey('2026-10-08')).toBe('2026-10-07');
    expect(previousKey('2026-11-01')).toBe('2026-10-31');
    expect(previousKey('2027-01-01')).toBe('2026-12-31');
    expect(previousKey('2028-03-01')).toBe('2028-02-29');
  });
});

describe('dailyNumber', () => {
  it('counts the epoch as #1 and goes up by one a day', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber('2026-10-08')).toBe(2);
    expect(dailyNumber('2027-10-07')).toBe(366);
  });
});

describe('dailySeed', () => {
  it('is the same for everyone on the same day', () => {
    expect(dailySeed('2026-10-08')).toBe(dailySeed('2026-10-08'));
  });

  it('differs from day to day, and is a valid unsigned 32-bit seed', () => {
    const seeds = new Set<number>();
    let key = '2027-12-31';
    for (let i = 0; i < 730; i += 1) {
      const seed = dailySeed(key);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
      seeds.add(seed);
      key = previousKey(key);
    }
    expect(seeds.size).toBe(730);
  });
});
