import { describe, expect, it } from 'vitest';
import type { RunFacts } from './missions.js';
import {
  MISSIONS_PER_DAY,
  advance,
  allDone,
  describeMission,
  isDone,
  missionsFor,
} from './missions.js';
import { previousKey } from '../core/daily.js';
import { SKINS, isSkinId, newlyUnlocked } from './unlocks.js';

const NOTHING: RunFacts = {
  nearMisses: 0,
  bestCombo: 0,
  shards: 0,
  sector: 0,
  survivalTime: 0,
  pickups: 0,
};

function days(count: number): string[] {
  const keys: string[] = [];
  let key = '2027-06-30';
  for (let i = 0; i < count; i += 1) {
    keys.push(key);
    key = previousKey(key);
  }
  return keys;
}

describe('missionsFor', () => {
  it('gives the same three missions to everyone on the same day', () => {
    expect(missionsFor('2026-10-08')).toEqual(missionsFor('2026-10-08'));
    expect(missionsFor('2026-10-08')).toHaveLength(MISSIONS_PER_DAY);
  });

  it('never repeats a kind or pairs two that ask for the same thing', () => {
    for (const key of days(400)) {
      const kinds = missionsFor(key).map((m) => m.kind);
      expect(new Set(kinds).size).toBe(MISSIONS_PER_DAY);
      expect(kinds.includes('sector') && kinds.includes('survive')).toBe(false);
      expect(kinds.includes('shards') && kinds.includes('shardsToday')).toBe(false);
    }
  });

  it('varies from day to day and uses every kind of mission', () => {
    const seen = new Set<string>();
    const sets = new Set<string>();
    for (const key of days(200)) {
      const missions = missionsFor(key);
      missions.forEach((m) => seen.add(m.kind));
      sets.add(JSON.stringify(missions));
    }
    expect(seen.size).toBe(7);
    expect(sets.size).toBeGreaterThan(100);
  });

  it('describes every mission in words', () => {
    for (const key of days(60)) {
      for (const mission of missionsFor(key)) {
        expect(describeMission(mission)).toMatch(/\d/);
      }
    }
  });
});

describe('advance', () => {
  const missions = [
    { kind: 'nearMisses', target: 10 },
    { kind: 'shardsToday', target: 25 },
    { kind: 'sector', target: 3 },
  ] as const;

  it('keeps the best single run for one-run missions and adds up the rest', () => {
    let progress = advance(missions, [0, 0, 0], {
      ...NOTHING,
      nearMisses: 6,
      shards: 9,
      sector: 1,
    });
    expect(progress).toEqual([6, 9, 2]);
    progress = advance(missions, progress, { ...NOTHING, nearMisses: 4, shards: 9, sector: 0 });
    expect(progress).toEqual([6, 18, 2]);
  });

  it('caps at the target and reports completion', () => {
    const progress = advance(missions, [0, 0, 0], {
      ...NOTHING,
      nearMisses: 50,
      shards: 30,
      sector: 2,
    });
    expect(progress).toEqual([10, 25, 3]);
    expect(missions.every((m, i) => isDone(m, progress[i] ?? 0))).toBe(true);
    expect(allDone(missions, progress)).toBe(true);
    expect(allDone(missions, [10, 24, 3])).toBe(false);
  });
});

describe('unlocks', () => {
  it('awards a finish once, the run it is earned', () => {
    const deep: RunFacts = { ...NOTHING, sector: 4, bestCombo: 12 };
    expect(newlyUnlocked([], deep, false).sort()).toEqual(['abyss', 'ember', 'gold']);
    expect(newlyUnlocked(['abyss', 'ember', 'gold'], deep, false)).toEqual([]);
  });

  it('awards pearl for a day of missions, and nothing for an ordinary run', () => {
    expect(newlyUnlocked([], NOTHING, true)).toEqual(['pearl']);
    expect(newlyUnlocked([], NOTHING, false)).toEqual([]);
  });

  it('never offers the starting finish as an unlock', () => {
    expect(
      newlyUnlocked([], { ...NOTHING, sector: 9, shards: 99, bestCombo: 99 }, true),
    ).not.toContain('mint');
  });

  it('knows its own ids', () => {
    for (const skin of SKINS) expect(isSkinId(skin.id)).toBe(true);
    expect(isSkinId('rainbow')).toBe(false);
  });
});
