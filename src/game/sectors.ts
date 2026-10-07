import { DIFFICULTY, SECTORS } from '../config.js';

export interface SectorInfo {
  readonly name: string;
  /** Colour family rocks lean toward here, or `null` for an even mix. */
  readonly skin: number | null;
}

const FIRST: SectorInfo = { name: 'Outer Belt', skin: null };

/**
 * The named stretches of a run.
 *
 * A sector changes nothing about the difficulty curve. It gives a long run
 * landmarks — something to reach, and something to say you reached — and
 * gives the field a visible change of character every so often.
 */
export const SECTOR_TABLE: readonly SectorInfo[] = [
  FIRST,
  { name: 'Ember Drift', skin: 0 },
  { name: 'Glacier Reach', skin: 1 },
  { name: 'Toxic Shoals', skin: 2 },
  { name: 'Void Rift', skin: 3 },
  { name: 'Rose Maelstrom', skin: 4 },
];

/** Which sector a run is in, from difficulty-scaled seconds survived. */
export function sectorAt(scaledSeconds: number): number {
  const since = Math.max(0, scaledSeconds - DIFFICULTY.graceSeconds);
  return Math.floor(since / SECTORS.seconds);
}

/**
 * Describes any sector, including those past the end of the table.
 *
 * After the last named sector the run cycles through the coloured ones again
 * as "Deep" sectors, so an expert run never falls off the end.
 */
export function sectorInfo(index: number): SectorInfo {
  const safe = Math.max(0, Math.floor(index));
  if (safe < SECTOR_TABLE.length) return SECTOR_TABLE[safe] ?? FIRST;

  // Skip the opening sector when cycling; it is the only one without a colour.
  const cycle = SECTOR_TABLE.length - 1;
  const base = SECTOR_TABLE[1 + ((safe - SECTOR_TABLE.length) % cycle)] ?? FIRST;
  return { name: `Deep ${base.name}`, skin: base.skin };
}
