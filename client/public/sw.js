/**
 * Onebridge Infotech Pvt Ltd HRMS - Production Service Worker
 * Version: 1.0.0
 * Features:
 *  - Cache-first strategy for static assets (images, fonts, scripts, styles)
 *  - Network-first strategy for HTML navigation & API calls with offline fallback
 *  - Offline page fallback (/offline.html)
 *  - Automatic cache cleanup across versions
 *  - Background sync listener for offline requests
 *  - Web Push notifications scaffold for HRMS events (attendance, leaves, payroll)
 */

const CACHE_VERSION = 'onebridge-hrms-v1.0.0';
const STATIC_CACHE = `onebridge-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `onebridge-dynamic-${CACHE_VERSION}`;
const API_CACHE = `onebridge-api-${CACHE_VERSION}`;

// Pre-cached essential static assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png'
];

// Install Event: Precaches static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    }).catch((err) => {
      console.warn('[Onebridge PWA SW] Precache warning:', err);
    })
  );
});

// Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(name)) {
            console.log('[Onebridge PWA SW] Deleting obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Intelligent routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-HTTP/HTTPS requests (e.g., chrome-extension)
  if (!url.protocol.startsWith('http')) return;

  // 1. Navigation Request (HTML pages): Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If network failed, try cached page first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // If not in cache, fallback to offline.html
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('You are currently offline. Please reconnect.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 2. API Requests: Network-first for GET requests; bypass cache for POST/PUT/DELETE
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      // For mutation requests, attempt network. If offline, background sync or client handling takes care of it
      return;
    }

    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: Serve previous cached API response if available
          const cachedApiResponse = await caches.match(request);
          if (cachedApiResponse) {
            return cachedApiResponse;
          }
          return new Response(JSON.stringify({ error: 'Network unavailable. You are in offline mode.', offline: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images, Icons): Cache-first with stale-while-revalidate
  const isStaticAsset =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|css|js)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached asset immediately, but revalidate in background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {
            // Ignore offline fetch errors during background revalidation
          });
          return cachedResponse;
        }

        // Fetch from network and save to cache
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Network with Dynamic Cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background Sync Listener (Attendance & Offline mutations queue)
self.addEventListener('sync', (event) => {
  console.log('[Onebridge PWA SW] Background sync event received:', event.tag);
  if (event.tag === 'sync-attendance' || event.tag === 'sync-offline-requests') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'ONEBRIDGE_BG_SYNC',
            tag: event.tag
          });
        });
      })
    );
  }
});

// Push Notifications Architecture (Attendance reminders, Leave approvals, Payroll, Announcements)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Onebridge HRMS Notification',
    body: 'You have a new update in your HR portal.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Push Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message Event: Handle update skipWaiting requests from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
