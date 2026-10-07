import { describe, expect, it } from 'vitest';
import { DIFFICULTY, SECTORS, SPAWN } from '../config.js';
import { SECTOR_TABLE, sectorAt, sectorInfo } from './sectors.js';

describe('sectorAt', () => {
  it('starts in sector 0 and stays there through the grace period', () => {
    expect(sectorAt(0)).toBe(0);
    expect(sectorAt(DIFFICULTY.graceSeconds)).toBe(0);
    expect(sectorAt(DIFFICULTY.graceSeconds + SECTORS.seconds - 0.01)).toBe(0);
  });

  it('advances once per sector length', () => {
    const start = DIFFICULTY.graceSeconds;
    expect(sectorAt(start + SECTORS.seconds)).toBe(1);
    expect(sectorAt(start + SECTORS.seconds * 4.5)).toBe(4);
  });

  it('never goes backwards', () => {
    let previous = 0;
    for (let t = 0; t < 1000; t += 0.7) {
      const sector = sectorAt(t);
      expect(sector).toBeGreaterThanOrEqual(previous);
      previous = sector;
    }
  });
});

describe('sectorInfo', () => {
  it('names every sector in the table', () => {
    SECTOR_TABLE.forEach((entry, index) => {
      expect(sectorInfo(index)).toEqual(entry);
    });
  });

  it('keeps naming sectors past the end of the table', () => {
    for (let i = SECTOR_TABLE.length; i < SECTOR_TABLE.length * 4; i += 1) {
      const info = sectorInfo(i);
      expect(info.name.startsWith('Deep ')).toBe(true);
      // Every "Deep" sector has a colour; the uncoloured opening never repeats.
      expect(info.skin).not.toBeNull();
    }
  });

  it('only biases toward colour families that rocks actually use', () => {
    for (let i = 0; i < 40; i += 1) {
      const { skin } = sectorInfo(i);
      if (skin === null) continue;
      expect(skin).toBeGreaterThanOrEqual(0);
      expect(skin).toBeLessThan(SPAWN.skinCount);
    }
  });

  it('treats nonsense indices as the opening sector', () => {
    expect(sectorInfo(-3).name).toBe(SECTOR_TABLE[0]?.name);
  });
});
