const CACHE_NAME = 'tesseract-pwa-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cascade.html',
  './roadmap.html',
  './analytics.html',
  './bucketlist.html',
  './profile.html',
  './report.html',
  './manifest.json',
  './css/styles.css',
  './js/notification_engine.js',
  './js/sync_engine.js',
  './js/touch_engine.js',
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
  './js/report_engine.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/shortcut-task.svg',
  './icons/shortcut-today.svg',
  './icons/shortcut-report.svg',
  './icons/shortcut-analytics.svg',
  './icons/shortcut-roadmap.svg'
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

// Native Notification Click Handler - Routes lock-screen taps to active app or opens new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action || (event.notification.data && event.notification.data.action) || 'open';
  let targetUrl = './index.html';

  if (action === 'morning') {
    targetUrl = './index.html?action=morning';
  } else if (action === 'evening') {
    targetUrl = './index.html?action=evening';
  } else if (typeof action === 'string' && action.startsWith('task_')) {
    const taskId = action.replace('task_', '');
    targetUrl = './index.html?action=task&id=' + taskId;
  } else if (event.notification.data && event.notification.data.id) {
    targetUrl = './index.html?action=task&id=' + event.notification.data.id;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (let client of windowClients) {
        if ('focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Tesseract notification dismissed:', event.notification.tag);
});

