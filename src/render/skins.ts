import type { SkinId } from '../game/unlocks.js';
import { PALETTE } from '../config.js';

/** How a ship finish is drawn. Every hull stays in the ship's colour family. */
export interface ShipLook {
  readonly hullLight: string;
  readonly hullMid: string;
  readonly hullShade: string;
  readonly outline: string;
  readonly cockpit: string;
  readonly glint: string;
  readonly glow: string;
  readonly flame: string;
  /** The trail colour, or `null` for one that cycles through the spectrum. */
  readonly trail: string | null;
}

const MINT: ShipLook = {
  hullLight: '#ffffff',
  hullMid: PALETTE.ship,
  hullShade: PALETTE.shipShade,
  outline: PALETTE.shipOutline,
  cockpit: PALETTE.shipCockpit,
  glint: '#e2fff7',
  glow: PALETTE.shipGlow,
  flame: PALETTE.shipGlow,
  trail: PALETTE.shipTrail,
};

export const SHIP_LOOKS: Readonly<Record<SkinId, ShipLook>> = {
  mint: MINT,
  // A dark hull outlined in the ship's own glow: still unmistakably the ship.
  abyss: {
    ...MINT,
    hullLight: '#3f8a8a',
    hullMid: '#0f4250',
    hullShade: '#051c22',
    outline: PALETTE.ship,
    cockpit: PALETTE.ship,
    glint: '#ffffff',
  },
  gold: {
    ...MINT,
    cockpit: '#4a2f00',
    glint: '#fff3c2',
    glow: '#ffd76a',
    flame: '#ffc94a',
    trail: '#ffc94a',
  },
  aurora: { ...MINT, glow: '#7cc8ff', flame: '#a866ff', trail: null },
  ember: { ...MINT, glow: '#ff7c4d', flame: '#ff6b4a', trail: '#ff8a5c' },
  pearl: {
    ...MINT,
    hullLight: '#ffffff',
    hullMid: '#e6fff7',
    hullShade: '#8fcfbd',
    outline: PALETTE.ink,
    cockpit: '#0b3442',
    glint: '#ffffff',
    glow: '#c4fff0',
    trail: '#c4fff0',
  },
};

/** A CSS swatch for the finish picker, from the same colours the canvas uses. */
export function swatchFor(id: SkinId): string {
  const look = SHIP_LOOKS[id];
  return `linear-gradient(160deg, ${look.hullLight} 0%, ${look.hullMid} 45%, ${look.hullShade} 75%, ${
    look.trail ?? '#a866ff'
  } 100%)`;
}
