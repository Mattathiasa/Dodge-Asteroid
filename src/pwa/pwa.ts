/**
 * Installing and offline play.
 *
 * The service worker is registered only in production builds: in development
 * a cache in front of the dev server would serve stale code.
 */

/** Chromium's install prompt, which no standard type describes yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = (): void => {
    // A failed registration only costs offline play; the game runs regardless.
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Whether the game was launched from an installed icon. */
export function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || matchMedia('(display-mode: standalone)').matches;
}

/**
 * Shows the install button only when the browser actually offers to install,
 * which Chromium signals with `beforeinstallprompt`. Safari never does; the
 * About screen says how to add it there.
 */
export function setupInstallButton(button: HTMLElement, track: (event: string) => void): void {
  let offer: BeforeInstallPromptEvent | null = null;
  button.hidden = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event as BeforeInstallPromptEvent;
    button.hidden = false;
  });

  button.addEventListener('click', () => {
    const pending = offer;
    if (pending === null) return;
    // A prompt can only be shown once.
    offer = null;
    button.hidden = true;
    pending
      .prompt()
      .then(() => pending.userChoice)
      .then(({ outcome }) => track(`pwa/prompt/${outcome}`))
      .catch(() => undefined);
  });

  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    track('pwa/installed');
  });
}
