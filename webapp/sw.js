const CACHE_NAME = 'tesseract-pwa-v23';
const ASSETS_TO_CACHE = [
  './',
  './login.html',
  './index.html',
  './cascade.html',
  './roadmap.html',
  './analytics.html',
  './bucketlist.html',
  './backlogs.html',
  './completed_backlogs.html',
  './profile.html',
  './report.html',
  './pulse.html',
  './professional.html',
  './tracker.html',
  './manifest.json',
  './css/styles.css',
  './css/modules/variables.css',
  './css/modules/base.css',
  './css/modules/sidebar.css',
  './css/modules/dashboard.css',
  './css/modules/pulse.css',
  './css/modules/professional.css',
  './css/modules/tracker.css',
  './js/flight_plan_view.js',
  './js/vault_inspector.js',
  './js/column_resizer.js',
  './js/pulse_engine.js',
  './js/professional_engine.js',
  './js/tracker_engine.js',
  './js/focus_engine.js',
  './js/types.js',
  './js/dialog_engine.js',
  './js/streak_engine.js',
  './js/search_controller.js',
  './js/matrix_view.js',
  './js/kanban_view.js',
  './js/profile_engine.js',
  './js/auth_engine.js',
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
  './js/screentime_engine.js',
  './js/rituals_engine.js',
  './js/bucketlist_engine.js',
  './js/backlog_engine.js',
  './js/horizon_bridge.js',
  './js/docket_engine.js',
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

// Install Event - Pre-cache Assets & Immediately Skip Waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event - Clean Up Old Caches & Claim Clients Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
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

  // For Local Assets (HTML, JS, CSS): Always Network First to avoid stale mobile views
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
