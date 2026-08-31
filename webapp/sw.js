const CACHE_NAME = 'tesseract-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cascade.html',
  './roadmap.html',
  './analytics.html',
  './bucketlist.html',
  './profile.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/components.js',
  './js/command_palette.js',
  './js/drag_drop.js',
  './js/initial_data.js',
  './js/xp_engine.js',
  './js/habits_engine.js',
  './js/rituals_engine.js',
  './js/bucketlist_engine.js',
  './js/alignment_engine.js',
  './js/roadmap_engine.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for offline usage
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For external CDNs (Lucide, Confetti, Google Fonts), try Cache First then Network
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // For Local Assets: Network First, fallback to Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
