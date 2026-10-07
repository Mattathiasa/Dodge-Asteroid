import type { RunFacts } from './missions.js';

/**
 * Ship finishes, earned by skill and purely cosmetic.
 *
 * Nothing here makes the game easier: a finish that did would turn the board
 * into a measure of time spent rather than of play. Every finish keeps the
 * hull in the ship's own colour family, because the one rule the palette has
 * is that nothing you fly can be mistaken for something that kills you.
 */
export type SkinId = 'mint' | 'abyss' | 'gold' | 'aurora' | 'ember' | 'pearl';

export const DEFAULT_SKIN: SkinId = 'mint';

export interface UnlockRule {
  readonly id: SkinId;
  readonly name: string;
  /** Shown on a locked finish, so the player knows what to go and do. */
  readonly requirement: string;
  met(facts: RunFacts, missionsDone: boolean): boolean;
}

export const SKINS: readonly UnlockRule[] = [
  { id: 'mint', name: 'Mint', requirement: '', met: () => true },
  { id: 'abyss', name: 'Abyss', requirement: 'Reach Sector 3', met: (f) => f.sector >= 2 },
  {
    id: 'gold',
    name: 'Gold trim',
    requirement: 'Reach a ×10 combo',
    met: (f) => f.bestCombo >= 10,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    requirement: 'Collect 25 shards in one run',
    met: (f) => f.shards >= 25,
  },
  { id: 'ember', name: 'Ember', requirement: 'Reach Sector 5', met: (f) => f.sector >= 4 },
  {
    id: 'pearl',
    name: 'Pearl',
    requirement: "Finish all three of a day's missions",
    met: (_f, missionsDone) => missionsDone,
  },
];

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some((skin) => skin.id === value);
}

/** Finishes this run earned that the player did not already have. */
export function newlyUnlocked(
  owned: readonly string[],
  facts: RunFacts,
  missionsDone: boolean,
): SkinId[] {
  return SKINS.filter(
    (skin) => skin.id !== DEFAULT_SKIN && !owned.includes(skin.id) && skin.met(facts, missionsDone),
  ).map((skin) => skin.id);
}
