import type { Phase } from '../game/phase.js';

export type ScreenName = 'menu' | 'paused' | 'gameOver' | 'about' | 'settings' | 'guide';

/**
 * Show/hide for the DOM screens layered over the canvas.
 *
 * These are real DOM overlays rather than canvas-drawn text: buttons are
 * focusable and keyboard-activatable, text is selectable and respects the
 * user's font size, and screen readers can read all of it — none of which is
 * true of anything painted into a canvas.
 */
export class OverlayManager {
  private current: ScreenName | null = null;
  private previous: ScreenName | null = null;

  constructor(
    private readonly screens: Readonly<Record<ScreenName, HTMLElement>>,
    private readonly root: HTMLElement,
  ) {}

  get active(): ScreenName | null {
    return this.current;
  }

  show(name: ScreenName): void {
    if (this.current === name) return;
    this.previous = this.current;
    this.current = name;

    for (const [key, element] of Object.entries(this.screens)) {
      element.hidden = key !== name;
    }
    this.root.classList.add('has-overlay');
    document.body.dataset['screen'] = name;

    // Move focus into the screen so keyboard and screen-reader users land there,
    // without scrolling a tall screen down to wherever its button happens to be.
    const screen = this.screens[name];
    screen.scrollTop = 0;
    const focusTarget = screen.querySelector<HTMLElement>('[data-autofocus]');
    focusTarget?.focus({ preventScroll: true });
  }

  hide(): void {
    if (this.current === null) return;
    this.previous = this.current;
    this.current = null;
    for (const element of Object.values(this.screens)) element.hidden = true;
    this.root.classList.remove('has-overlay');
    delete document.body.dataset['screen'];
  }

  /** Returns to whichever screen was showing before the current one. */
  back(): void {
    const target = this.previous;
    if (target === null) this.hide();
    else this.show(target);
  }

  /** The screen that should be visible for a given phase, if any. */
  static forPhase(phase: Phase): ScreenName | null {
    switch (phase) {
      case 'menu':
        return 'menu';
      case 'paused':
        return 'paused';
      case 'gameOver':
        return 'gameOver';
      case 'playing':
      case 'countdown':
      case 'dying':
        return null;
    }
  }
}
