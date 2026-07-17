// Service Worker for Compa PWA
// Bump this version number on every deploy to force clients to pick up new files
const SW_VERSION = 'v0.2.8';
const CACHE_NAME = `compa-pod-${SW_VERSION}`;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event - serve from cache, fallback to network
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
