import type { World } from '../game/world.js';
import { SHIP } from '../config.js';

export interface HudElements {
  readonly score: HTMLElement;
  readonly best: HTMLElement;
  readonly lives: HTMLElement;
  readonly combo: HTMLElement;
  readonly status: HTMLElement;
}

/**
 * The heads-up display.
 *
 * Writes are guarded so the DOM is only touched when a value actually changes;
 * assigning textContent every frame is a needless layout cost.
 */
export class Hud {
  private lastScore = -1;
  private lastBest = -1;
  private lastLives = -1;
  private lastCombo = -1;
  private lastStatus = '';

  constructor(private readonly elements: HudElements) {}

  update(world: World, best: number): void {
    const { elements } = this;
    const { score, ship } = world;

    if (score.points !== this.lastScore) {
      this.lastScore = score.points;
      elements.score.textContent = String(score.points);
    }

    if (best !== this.lastBest) {
      this.lastBest = best;
      elements.best.textContent = String(best);
    }

    if (ship.lives !== this.lastLives) {
      this.lastLives = ship.lives;
      elements.lives.textContent = '◆'.repeat(Math.max(0, ship.lives));
      elements.lives.setAttribute(
        'aria-label',
        `${String(Math.max(0, ship.lives))} of ${String(SHIP.maxLives)} lives remaining`,
      );
    }

    if (score.combo !== this.lastCombo) {
      const grew = score.combo > this.lastCombo && this.lastCombo >= 0;
      this.lastCombo = score.combo;
      const active = score.combo > 1;
      elements.combo.textContent = active ? `${String(score.combo)}× combo` : '';
      elements.combo.classList.toggle('is-active', active);
      if (active && grew) {
        // Restart the bump animation for each new step.
        elements.combo.classList.remove('is-bump');
        void elements.combo.offsetWidth;
        elements.combo.classList.add('is-bump');
      }
    }

    const status = describeStatus(world);
    if (status !== this.lastStatus) {
      this.lastStatus = status;
      elements.status.textContent = status;
      elements.status.classList.toggle('is-active', status !== '');
    }
  }

  /** Forces the next update to rewrite everything. */
  invalidate(): void {
    this.lastScore = -1;
    this.lastBest = -1;
    this.lastLives = -1;
    this.lastCombo = -1;
    this.lastStatus = '';
  }
}

function describeStatus(world: World): string {
  const { ship } = world;
  const parts: string[] = [];
  if (ship.shieldTime > 0) parts.push(`Shield ${ship.shieldTime.toFixed(1)}s`);
  if (ship.slowmoTime > 0) parts.push(`Slow-mo ${ship.slowmoTime.toFixed(1)}s`);
  return parts.join('  ·  ');
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes)}:${rest.toString().padStart(2, '0')}`;
}
