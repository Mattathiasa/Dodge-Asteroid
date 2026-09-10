/**
 * Registers the generated service worker, which is what makes the game
 * installable and playable offline.
 *
 * Registration is deliberately not awaited and never throws: a browser without
 * service workers, or a page served over plain http, still gets the full game.
 */
export interface UpdateHandle {
  /** Tells a waiting worker to take over. The page reloads onto it. */
  apply(): void;
}

export function registerServiceWorker(onUpdateReady?: (handle: UpdateHandle) => void): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Vite is configured with a relative base, so the worker is resolved relative
  // to the page and the registration scope follows wherever the app is mounted.
  const url = new URL('sw.js', document.baseURI);

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(url, { scope: './' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (installing === null) return;
          installing.addEventListener('statechange', () => {
            // A worker that reaches "installed" while one is already in control
            // is a pending update, not a first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
              onUpdateReady?.({
                apply: () => {
                  let reloaded = false;
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (reloaded) return;
                    reloaded = true;
                    window.location.reload();
                  });
                  installing.postMessage('skip-waiting');
                },
              });
            }
          });
        });
      })
      .catch(() => {
        // Unsupported, blocked, or insecure context. The game works regardless.
      });
  });
}
