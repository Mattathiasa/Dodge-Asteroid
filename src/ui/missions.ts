import type { Mission } from '../game/missions.js';
import { describeMission, isDone } from '../game/missions.js';

/** Renders a day's missions with a tick, the goal and how close you are. */
export function renderMissions(
  list: HTMLElement,
  missions: readonly Mission[],
  progress: readonly number[],
): void {
  list.textContent = '';
  missions.forEach((mission, i) => {
    const value = Math.min(progress[i] ?? 0, mission.target);
    const done = isDone(mission, value);

    const item = document.createElement('li');
    item.className = 'missions__item';
    item.classList.toggle('is-done', done);

    const mark = document.createElement('span');
    mark.className = 'missions__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = done ? '✓' : '';

    const text = document.createElement('span');
    text.className = 'missions__text';
    text.textContent = describeMission(mission);

    const count = document.createElement('span');
    count.className = 'missions__count';
    count.textContent = done ? 'Done' : `${String(value)}/${String(mission.target)}`;

    item.append(mark, text, count);
    list.append(item);
  });
}
