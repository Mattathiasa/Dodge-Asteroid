/**
 * The text a player shares after a run.
 *
 * Shaped like the results people already post: a title, a row of squares and
 * a line of numbers. The squares show how deep the run got without saying
 * anything about the field, so sharing a daily never spoils it.
 */

/** One square per named sector, in the colours of their nebulae. */
const SECTOR_SQUARES = ['🟦', '🟧', '🟨', '🟩', '🟪', '🟥'] as const;
const UNREACHED = '⬛';

export interface SharedRun {
  readonly score: number;
  /** Zero-based index of the deepest sector reached. */
  readonly sector: number;
  readonly bestCombo: number;
  /** Present for a daily run. */
  readonly daily?: { readonly number: number; readonly attempts: number };
  readonly url: string;
}

/** The row of squares: reached sectors in colour, the rest dark. */
export function sectorStrip(sector: number): string {
  const reached = Math.max(0, Math.floor(sector));
  const row = SECTOR_SQUARES.map((square, i) => (i <= reached ? square : UNREACHED)).join('');
  const beyond = reached - (SECTOR_SQUARES.length - 1);
  return beyond > 0 ? `${row} +${String(beyond)}` : row;
}

export function shareText(run: SharedRun): string {
  const title =
    run.daily === undefined
      ? 'Dodge Asteroid'
      : `Dodge Asteroid · Daily #${String(run.daily.number)}`;

  const stats = [`${run.score.toLocaleString('en-US')} pts`];
  if (run.bestCombo > 1) stats.push(`×${String(run.bestCombo)} combo`);
  if (run.daily !== undefined) {
    const tries = run.daily.attempts;
    stats.push(`${String(tries)} ${tries === 1 ? 'try' : 'tries'}`);
  }

  return [title, sectorStrip(run.sector), stats.join(' · '), run.url].join('\n');
}
