// Bump this on every deploy so phones that already have the app installed
// pick up the new version instead of serving a stale cached copy.
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'inflight-store-' + CACHE_VERSION;

// Same-origin files that make up the app shell.
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// Cross-origin scripts the app needs (e.g. the QR scanner). Cached separately
// so one failed CORS fetch doesn't break caching of the local files above.
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(LOCAL_ASSETS).catch((err) => {
        console.warn('Service worker: could not cache all local assets', err);
      });
      await Promise.all(
        CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => cache.put(url, res))
            .catch(() => {}) // offline on first install — fine, jsQR just won't work offline yet
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve instantly from cache when available (so the
// kiosk opens even with no signal), and refresh the cache in the background
// whenever there is a connection.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
