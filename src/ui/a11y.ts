/** Minimum gap between screen-reader announcements, in ms. */
const ANNOUNCE_THROTTLE_MS = 1200;

/**
 * A polite live region.
 *
 * Announcing every frame would flood a screen reader into uselessness, so
 * messages are throttled and only meaningful moments are announced at all.
 */
export class Announcer {
  private lastAt = 0;
  private lastMessage = '';

  constructor(private readonly region: HTMLElement) {}

  /** Announces a message, unless one was made too recently. */
  say(message: string, now = Date.now()): void {
    if (message === this.lastMessage) return;
    if (now - this.lastAt < ANNOUNCE_THROTTLE_MS) return;
    this.lastAt = now;
    this.lastMessage = message;
    this.region.textContent = message;
  }

  /** Announces regardless of throttling, for phase changes the player must hear. */
  sayNow(message: string, now = Date.now()): void {
    this.lastAt = now;
    this.lastMessage = message;
    this.region.textContent = message;
  }
}

/** Whether the user has asked for reduced motion at the OS level. */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
