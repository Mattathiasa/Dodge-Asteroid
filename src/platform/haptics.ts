/**
 * Short vibrations for moments the player should feel as well as see.
 *
 * Patterns are deliberately brief: a long buzz on a phone reads as an error,
 * not as feedback. Unsupported platforms (all desktop browsers, and iOS Safari)
 * get a silent no-op rather than a feature check at every call site.
 */
export type HapticEvent = 'pickup' | 'shieldBreak' | 'lifeLost' | 'destroyed';

const PATTERNS: Readonly<Record<HapticEvent, number | readonly number[]>> = {
  pickup: 12,
  shieldBreak: [0, 18, 40, 18],
  lifeLost: [0, 30, 50, 30],
  destroyed: [0, 45, 60, 90],
};

export interface Haptics {
  readonly supported: boolean;
  enabled: boolean;
  play(event: HapticEvent): void;
}

/**
 * @param vibrate Injectable for tests, and so the module can be exercised
 *   without a browser. Defaults to the platform implementation when present.
 */
export function createHaptics(vibrate?: (pattern: number | number[]) => boolean): Haptics {
  const impl =
    vibrate ??
    (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern: number | number[]) => navigator.vibrate(pattern)
      : undefined);
  const supported = impl !== undefined;
  let enabled = true;

  return {
    supported,
    get enabled() {
      return enabled;
    },
    set enabled(next: boolean) {
      enabled = next;
      // Cancel anything mid-pattern when switching off.
      if (!next && impl !== undefined) impl(0);
    },
    play(event) {
      if (impl === undefined || !enabled) return;
      try {
        impl(PATTERNS[event] as number | number[]);
      } catch {
        // Some browsers throw when the page is not visible. Never let feedback
        // take the game down.
      }
    },
  };
}
