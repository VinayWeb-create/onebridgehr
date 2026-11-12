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

const CACHE_VERSION = 'onebridge-hrms-v4.3.0';
const STATIC_CACHE = `onebridge-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `onebridge-dynamic-${CACHE_VERSION}`;
const API_CACHE = `onebridge-api-${CACHE_VERSION}`;
const PLANNER_CONFIG_CACHE = 'onebridge-planner-config';

// Pre-cached essential static assets (offline fallback & branding)
const PRECACHE_ASSETS = [
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

// Install Event: Precaches static assets and activates immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch((err) => {
      console.warn('[Onebridge PWA SW] Precache warning:', err);
    })
  );
});

// Activate Event: Clean up all legacy caches across versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Keep only caches of the current version (the planner config cache is version-independent)
          if (!name.includes(CACHE_VERSION) && name !== PLANNER_CONFIG_CACHE) {
            console.log('[Onebridge PWA SW] Purging obsolete cache:', name);
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
  if (event.tag === 'sync-attendance' || event.tag === 'sync-offline-requests' || event.tag === 'sync-planner') {
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
// Push Notifications Architecture (Attendance reminders, Leave approvals, Payroll, Announcements)
self.addEventListener('push', (event) => {
  // Smart Tasks reminders have their own rich handling (actions, badge, in-app hand-off)
  let peek = null;
  try {
    peek = event.data ? event.data.json() : null;
  } catch (e) {
    peek = null;
  }
  if (peek && peek.data && peek.data.planner) {
    event.waitUntil(handlePlannerPush(peek));
    return;
  }

  let data = {
    title: 'Onebridge HRMS Notification',
    body: 'You have a new update in your HR portal.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/attendance?action=checkout',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const isCheckout =
    data.type === 'CHECKOUT_REMINDER' ||
    data.type === 'MISSED_CHECKOUT_REMINDER' ||
    (data.tag && data.tag.includes('checkout'));

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-96x96.png',
    image: data.image,
    vibrate: isCheckout ? [300, 150, 300, 150, 400] : [200, 100, 200, 100, 200],
    tag: data.tag || ('onebridge-' + Date.now()),
    renotify: true,
    requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
    silent: false,
    data: {
      url: data.url || (isCheckout ? '/attendance?action=checkout' : '/'),
      type: data.type || (isCheckout ? 'CHECKOUT_REMINDER' : 'GENERAL'),
    },
    actions: data.actions || (isCheckout
      ? [
          { action: 'checkout', title: 'Check Out Now' },
          { action: 'open', title: 'Open HRMS' },
        ]
      : [
          { action: 'open', title: 'Open HRMS' },
          { action: 'close', title: 'Dismiss' },
        ]),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Push Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const pdata = event.notification.data || {};
  if (pdata.planner) {
    event.waitUntil(handlePlannerClick(event.action, pdata));
    return;
  }

  if (event.action === 'close') return;

  let targetUrl = event.notification.data?.url || '/attendance?action=checkout';
  if (event.action === 'checkout') {
    targetUrl = '/attendance?action=checkout';
  } else if (event.action === 'checkin') {
    targetUrl = '/attendance?action=checkin';
  }

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


// ===========================================================================
// Smart Tasks & Reminders — push, actions, badge, dismiss tracking
// ===========================================================================

async function plannerApiBase() {
  try {
    const cache = await caches.open(PLANNER_CONFIG_CACHE);
    const res = await cache.match('/__planner_config__');
    if (res) {
      const cfg = await res.json();
      if (cfg && cfg.apiBase) return cfg.apiBase;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

async function postToClients(message) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach((c) => c.postMessage(message));
  return list;
}

async function handlePlannerPush(payload) {
  const d = payload.data || {};
  if (typeof payload.badgeCount === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(payload.badgeCount).catch(() => {});
  }

  // If the app is open and visible, show the polished in-app toast instead of a duplicate OS banner.
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visible = windows.filter((c) => c.visibilityState === 'visible');
  if (visible.length > 0) {
    visible.forEach((c) =>
      c.postMessage({
        type: 'PLANNER_REMINDER',
        reminder: {
          reminderId: d.reminderId,
          taskId: d.taskId || null,
          title: String(payload.title || '').replace(/^\S+\s/, ''),
          body: payload.body,
          priority: d.priority || 'MEDIUM',
          dueAt: d.dueAt || null,
          kind: payload.type || 'PLANNER_TASK_REMINDER',
          url: payload.url || '/planner',
          silent: !!payload.silent,
        },
      })
    );
    return;
  }

  return self.registration.showNotification(payload.title || 'OneBridge reminder', {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-96x96.png',
    tag: payload.tag || 'planner-' + Date.now(),
    renotify: true,
    requireInteraction: !!payload.requireInteraction,
    silent: !!payload.silent,
    vibrate: payload.silent ? undefined : [200, 100, 200],
    timestamp: Date.now(),
    actions: payload.actions || [],
    data: {
      planner: true,
      url: payload.url || '/planner',
      reminderId: d.reminderId,
      taskId: d.taskId || null,
      actionToken: d.actionToken || null,
    },
  });
}

async function plannerAction(pdata, action, snooze) {
  const apiBase = await plannerApiBase();
  if (!apiBase || !pdata.actionToken) return false;
  try {
    const res = await fetch(apiBase + '/planner/reminders/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pdata.actionToken, action: action, snooze: snooze }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function openOrFocus(url) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of list) {
    if (client.url.includes(self.location.origin) && 'focus' in client) {
      if ('navigate' in client) await client.navigate(url).catch(() => {});
      return client.focus();
    }
  }
  if (self.clients.openWindow) return self.clients.openWindow(url);
}

async function handlePlannerClick(action, pdata) {
  const taskUrl = pdata.taskId ? '/planner?task=' + encodeURIComponent(pdata.taskId) : pdata.url || '/planner';

  if (action === 'planner-complete' || action === 'planner-snooze') {
    const apiAction = action === 'planner-complete' ? 'COMPLETE' : 'SNOOZE';
    const ok = await plannerAction(pdata, apiAction, '10');
    if (ok) {
      await postToClients({ type: 'PLANNER_ACTION_DONE', action: apiAction, taskId: pdata.taskId });
      return self.registration.showNotification(apiAction === 'COMPLETE' ? '✅ Task completed' : '⏰ Snoozed for 10 minutes', {
        body: apiAction === 'COMPLETE' ? 'Nice work!' : "We'll remind you again shortly.",
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: 'planner-ack',
        silent: true,
        requireInteraction: false,
      });
    }
    // Offline or token expired: let the app finish the action (it queues offline changes).
    const q = apiAction === 'COMPLETE' ? '&action=complete' : '&action=snooze&reminder=' + encodeURIComponent(pdata.reminderId || '');
    return openOrFocus(taskUrl + q);
  }

  plannerAction(pdata, 'OPEN');
  return openOrFocus(taskUrl);
}

// Swipe-away / close = "Dismiss"
self.addEventListener('notificationclose', (event) => {
  const pdata = (event.notification && event.notification.data) || {};
  if (pdata.planner && pdata.actionToken) {
    event.waitUntil(plannerAction(pdata, 'DISMISS'));
  }
});

// The app tells the worker where the API lives (the API is on a different origin in production).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PLANNER_CONFIG' && event.data.apiBase) {
    event.waitUntil(
      caches.open(PLANNER_CONFIG_CACHE).then((cache) =>
        cache.put(
          '/__planner_config__',
          new Response(JSON.stringify({ apiBase: event.data.apiBase }), { headers: { 'Content-Type': 'application/json' } })
        )
      )
    );
  }
  if (event.data && event.data.type === 'PLANNER_CLEAR_BADGE' && self.navigator && 'clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }
});
