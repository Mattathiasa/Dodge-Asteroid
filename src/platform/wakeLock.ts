/**
 * Keeps the screen awake during a run.
 *
 * Without this a phone dims and locks mid-game, because a player steering with
 * a finger on a canvas registers no "user activity" as the OS counts it. The
 * lock is dropped whenever the tab is hidden, so it is re-acquired on return.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

export interface ScreenWakeLock {
  readonly supported: boolean;
  readonly held: boolean;
  /** Idempotent: requesting while held does nothing. */
  acquire(): void;
  release(): void;
  dispose(): void;
}

export function createWakeLock(): ScreenWakeLock {
  const api =
    typeof navigator === 'undefined' ? undefined : (navigator as WakeLockNavigator).wakeLock;
  const supported = api !== undefined;

  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;

  const request = (): void => {
    if (api === undefined || sentinel !== null || !wanted) return;
    void api
      .request('screen')
      .then((granted) => {
        // The request may resolve after the game no longer wants the lock.
        if (!wanted) {
          void granted.release().catch(() => undefined);
          return;
        }
        sentinel = granted;
        granted.addEventListener('release', () => {
          sentinel = null;
        });
      })
      .catch(() => {
        // Denied, or the document was not visible. Not worth surfacing.
      });
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') request();
  };

  if (supported && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return {
    supported,
    get held() {
      return sentinel !== null && !sentinel.released;
    },
    acquire() {
      wanted = true;
      request();
    },
    release() {
      wanted = false;
      const current = sentinel;
      sentinel = null;
      if (current !== null) void current.release().catch(() => undefined);
    },
    dispose() {
      this.release();
      if (supported && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
  };
}
