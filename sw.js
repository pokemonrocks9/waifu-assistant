// Service Worker for Compa PWA
// Bump this version number on every deploy to force clients to pick up new files
const SW_VERSION = '0.10.8';
const CACHE_NAME = `cpu-pod-${SW_VERSION}`;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './compa-icon-192.png',
  './compa-icon-512.png'
];

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Explicit {cache: 'reload'} on each fetch bypasses the BROWSER'S
        // OWN HTTP cache, not just the Cache Storage API this file manages.
        // cache.addAll()'s default behavior doesn't do this - it can
        // silently reuse a stale HTTP-cached response even during a fresh
        // SW install, which was the actual root cause of updates not
        // sticking: the SW lifecycle (version bump -> new install) worked
        // correctly, but that new install was just re-caching the same
        // stale index.html instead of a genuinely fresh copy.
        return Promise.all(
          urlsToCache.map((url) =>
            fetch(url, { cache: 'reload' }).then((response) => cache.put(url, response))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip caching for chrome-extension, chrome://, data:, blob: URLs
  if (url.startsWith('chrome-extension://') ||
      url.startsWith('chrome://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')) {
    return;
  }

  // Never cache the WebSocket connection or API calls - always go live
  if (url.includes('/ws') || url.includes('/api/')) {
    return;
  }

  // Only cache http and https requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Network-first for the app shell (the HTML that changes on every
  // deploy) - previously this went through the same cache-first path as
  // everything else, meaning once cached, it was served instantly forever
  // with zero network check, and the only way it ever refreshed was
  // another full SW install cycle (which fix #1 above was undermining).
  // Falls back to cache only if genuinely offline/unreachable, so this
  // doesn't break offline support.
  const isAppShell = event.request.mode === 'navigate' ||
                      url.endsWith('/index.html') ||
                      url.endsWith('/');
  if (isAppShell) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch((err) => {
                console.log('Cache put failed:', err);
              });
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest) - these genuinely
  // rarely change, so the instant-from-cache behavior is actually desired
  // here, unlike for the app shell above.
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              if (event.request.url.startsWith('http')) {
                cache.put(event.request, responseToCache).catch((err) => {
                  console.log('Cache put failed:', err);
                });
              }
            });
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
