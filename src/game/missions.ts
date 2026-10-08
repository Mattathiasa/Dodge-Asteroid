import { createRng } from '../core/rng.js';
import { dailySeed } from '../core/daily.js';

/**
 * Daily missions: three small goals a day, the same three for everyone.
 *
 * They are derived from the day's seed like the daily field is, so there is
 * nothing to store or serve. Each one asks the player to play *differently*
 * (skim more, chase shards, go deeper) rather than just longer, and any run
 * counts, endless or daily.
 */
export type MissionKind =
  'nearMisses' | 'combo' | 'shards' | 'sector' | 'survive' | 'pickups' | 'shardsToday';

export interface Mission {
  readonly kind: MissionKind;
  readonly target: number;
}

/** What a finished run contributes toward missions and unlocks. */
export interface RunFacts {
  readonly nearMisses: number;
  readonly bestCombo: number;
  readonly shards: number;
  /** Zero-based sector index reached. */
  readonly sector: number;
  readonly survivalTime: number;
  readonly pickups: number;
}

interface Template {
  readonly targets: readonly number[];
  /** Adds up across the day's runs, rather than needing one run to do it. */
  readonly cumulative: boolean;
}

const TEMPLATES: Readonly<Record<MissionKind, Template>> = {
  nearMisses: { targets: [6, 10, 14], cumulative: false },
  combo: { targets: [4, 6, 8], cumulative: false },
  shards: { targets: [8, 12, 16], cumulative: false },
  sector: { targets: [2, 3], cumulative: false },
  survive: { targets: [40, 60, 80], cumulative: false },
  pickups: { targets: [2, 3], cumulative: false },
  shardsToday: { targets: [25, 40], cumulative: true },
};

const KINDS = Object.keys(TEMPLATES) as MissionKind[];

/** Pairs that ask for nearly the same thing, so a day never offers both. */
const OVERLAPS: ReadonlyArray<readonly [MissionKind, MissionKind]> = [
  ['sector', 'survive'],
  ['shards', 'shardsToday'],
];

export const MISSIONS_PER_DAY = 3;

export function missionsFor(key: string): Mission[] {
  const rng = createRng((dailySeed(key) ^ 0x6d155105) >>> 0);
  const order = [...KINDS];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const swap = order[i];
    order[i] = order[j] ?? order[i] ?? 'nearMisses';
    order[j] = swap ?? 'nearMisses';
  }

  const chosen: MissionKind[] = [];
  for (const kind of order) {
    if (chosen.length === MISSIONS_PER_DAY) break;
    const clashes = OVERLAPS.some(
      ([a, b]) => (kind === a && chosen.includes(b)) || (kind === b && chosen.includes(a)),
    );
    if (!clashes) chosen.push(kind);
  }

  return chosen.map((kind) => ({ kind, target: rng.pick(TEMPLATES[kind].targets) }));
}

/** What one run scored toward a mission of this kind. */
function runValue(kind: MissionKind, facts: RunFacts): number {
  switch (kind) {
    case 'nearMisses':
      return facts.nearMisses;
    case 'combo':
      return facts.bestCombo;
    case 'shards':
    case 'shardsToday':
      return facts.shards;
    case 'sector':
      return facts.sector + 1;
    case 'survive':
      return Math.floor(facts.survivalTime);
    case 'pickups':
      return facts.pickups;
  }
}

/** Folds a run into the day's progress. Never goes backwards. */
export function advance(
  missions: readonly Mission[],
  progress: readonly number[],
  facts: RunFacts,
): number[] {
  return missions.map((mission, i) => {
    const before = progress[i] ?? 0;
    const value = runValue(mission.kind, facts);
    const after = TEMPLATES[mission.kind].cumulative ? before + value : Math.max(before, value);
    return Math.min(after, mission.target);
  });
}

export function isDone(mission: Mission, progress: number): boolean {
  return progress >= mission.target;
}

export function allDone(missions: readonly Mission[], progress: readonly number[]): boolean {
  return missions.every((mission, i) => isDone(mission, progress[i] ?? 0));
}

export function describeMission(mission: Mission): string {
  const n = String(mission.target);
  switch (mission.kind) {
    case 'nearMisses':
      return `Skim ${n} rocks in one run`;
    case 'combo':
      return `Reach a ×${n} combo`;
    case 'shards':
      return `Collect ${n} shards in one run`;
    case 'sector':
      return `Reach Sector ${n}`;
    case 'survive':
      return `Survive ${n} seconds in one run`;
    case 'pickups':
      return `Grab ${n} pickups in one run`;
    case 'shardsToday':
      return `Collect ${n} shards today`;
  }
}
