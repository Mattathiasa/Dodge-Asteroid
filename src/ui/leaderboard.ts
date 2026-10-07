import type { ScoreEntry } from '../storage/storage.js';
import { formatTime } from './hud.js';

export interface LeaderboardOptions {
  /** Show at most this many entries. */
  readonly limit?: number;
  /** The `at` stamp of an entry to highlight, such as the run just finished. */
  readonly highlightAt?: number;
}

/** Renders the local top-scores table. */
export function renderLeaderboard(
  container: HTMLElement,
  entries: readonly ScoreEntry[],
  options: LeaderboardOptions = {},
): void {
  container.textContent = '';

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'leaderboard__empty';
    empty.textContent = 'No runs yet. Your best scores will appear here.';
    container.append(empty);
    return;
  }

  const list = document.createElement('ol');
  list.className = 'leaderboard__list';

  for (const entry of entries.slice(0, options.limit ?? entries.length)) {
    const item = document.createElement('li');
    item.className = 'leaderboard__item';
    if (entry.at === options.highlightAt) {
      item.classList.add('is-current');
      item.setAttribute('aria-current', 'true');
    }

    const score = document.createElement('span');
    score.className = 'leaderboard__score';
    score.textContent = entry.score.toLocaleString();

    const time = document.createElement('span');
    time.className = 'leaderboard__time';
    time.textContent = formatTime(entry.timeSeconds);

    item.append(score, time);
    list.append(item);
  }

  container.append(list);
}
