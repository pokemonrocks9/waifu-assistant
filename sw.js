// Service Worker for AI Assistant Pod PWA
const CACHE_NAME = 'ai-assistant-pod-v39';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
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
  // Skip caching for chrome-extension, chrome://, data:, blob: URLs
  const url = event.request.url;
  if (url.startsWith('chrome-extension://') || 
      url.startsWith('chrome://') || 
      url.startsWith('data:') || 
      url.startsWith('blob:')) {
    return; // Let browser handle these
  }

  // Only cache http and https requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              // Additional check before caching
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
