/**
 * Dodge Asteroid's service worker: what makes the game installable and
 * playable offline.
 *
 * This file is a template. The build fills in VERSION and PRECACHE (see the
 * service-worker plugin in vite.config.ts) and writes the result as sw.js.
 *
 * - The app shell and every built asset are cached on install, so the game
 *   runs with no network at all after the first visit.
 * - Pages are fetched network-first, so a new deploy arrives on the next
 *   visit rather than being masked by an old cache.
 * - Built assets have content hashes in their names and never change, so
 *   they are served from the cache first.
 * - Usage counts are never cached or replayed.
 */
const VERSION = '__VERSION__';
const PRECACHE = [/* filled in by the build */];

const SHELL = `dodge-shell-${VERSION}`;
const RUNTIME = 'dodge-runtime';
/** The game's own page, the only navigation worth keeping as the shell. */
const HOME = new URL('./', self.location.href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // The runtime cache goes too: this version precached everything it
            // needs, and old hashed bundles would otherwise pile up forever.
            .filter((key) => (key.startsWith('dodge-shell-') && key !== SHELL) || key === RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Only the game's page refreshes the shell. Opening og.jpg or the manifest
    // directly is a navigation too, and must not become the offline app.
    const url = new URL(request.url);
    const isHome = url.pathname === HOME.pathname || url.pathname === `${HOME.pathname}index.html`;
    if (response.ok && isHome) {
      const cache = await caches.open(SHELL);
      await cache.put('./', response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('./', { ignoreSearch: true, ignoreVary: true });
    return cached ?? Response.error();
  }
}

async function cacheFirst(request) {
  // Vite marks the bundle's script and stylesheet crossorigin, so the page
  // asks for them with an Origin header that the precache requests did not
  // carry. A host that answers with `Vary: Origin` would make every one of
  // them miss, and the game would not start offline. The files are named by
  // their content and never change, so the variation cannot matter.
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached !== undefined) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else, analytics included, goes straight to the network.
});
