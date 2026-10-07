export interface RunStats {
  readonly nearMisses: number;
  readonly bestCombo: number;
  readonly shards: number;
  /** Zero-based sector index. */
  readonly sector: number;
  readonly sectorName: string;
}

/**
 * The run-over breakdown.
 *
 * A single score says how a run went; this says *why*, which is what makes a
 * player want the next one. Each figure maps to something they can do better.
 */
export function renderRunStats(container: HTMLElement, stats: RunStats): void {
  container.textContent = '';
  const rows: ReadonlyArray<[string, string, string?]> = [
    ['Near misses', stats.nearMisses.toLocaleString()],
    ['Best combo', stats.bestCombo > 0 ? `×${String(stats.bestCombo)}` : '—'],
    ['Shards', stats.shards.toLocaleString()],
    ['Reached', `Sector ${String(stats.sector + 1)}`, stats.sectorName],
  ];

  for (const [label, value, detail] of rows) {
    const row = document.createElement('div');
    row.className = 'run-stats__item';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (detail !== undefined) {
      const small = document.createElement('small');
      small.textContent = detail;
      dd.append(small);
    }
    row.append(dt, dd);
    container.append(row);
  }
}
