/**
 * Onebridge HRMS - Service Worker Registration & PWA Utilities
 */

interface OfflineAction {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'onebridge_offline_mutation_queue';

/**
 * Register the Service Worker
 */
export function registerServiceWorker(onUpdateAvailable?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[Onebridge PWA] ServiceWorker registered with scope:', registration.scope);

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[Onebridge PWA] New content is available; please refresh.');
                if (onUpdateAvailable) {
                  onUpdateAvailable();
                }
              } else {
                console.log('[Onebridge PWA] Content is cached for offline use.');
              }
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[Onebridge PWA] ServiceWorker registration failed:', error);
      });

    // Listen for messages from Service Worker (e.g., BG Sync)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'ONEBRIDGE_BG_SYNC') {
        console.log('[Onebridge PWA] Received BG Sync message from SW:', event.data.tag);
        processOfflineQueue();
      }
    });
  });

  // Automatically trigger sync when coming online
  window.addEventListener('online', () => {
    console.log('[Onebridge PWA] Network restored. Processing offline queue...');
    processOfflineQueue();
  });
}

/**
 * Push Notification Scaffolding
 * Prepares permissions for Attendance reminders, Leave approvals, Payroll notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Onebridge PWA] Notifications not supported on this browser.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Trigger Native Notification (if permission granted)
 */
export async function showAppNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      ...options
    });
  } else {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      ...options
    });
  }
}

/**
 * Queue a failed or offline mutation request to execute when back online
 */
export function enqueueOfflineAction(url: string, method: string, body: any) {
  try {
    const existing: OfflineAction[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    const newAction: OfflineAction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      method,
      body,
      timestamp: Date.now()
    };
    existing.push(newAction);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
    console.log('[Onebridge PWA] Queued offline action:', url);

    // Request background sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg: any) => {
        reg.sync?.register('sync-offline-requests').catch(() => {});
      });
    }
  } catch (err) {
    console.error('[Onebridge PWA] Failed to queue offline action:', err);
  }
}

/**
 * Replay stored offline requests when internet connection returns
 */
export async function processOfflineQueue() {
  try {
    const queue: OfflineAction[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`[Onebridge PWA] Syncing ${queue.length} offline actions...`);
    const remaining: OfflineAction[] = [];

    for (const item of queue) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (!res.ok && res.status >= 500) {
          // Server error, keep in queue for next retry
          remaining.push(item);
        } else {
          console.log('[Onebridge PWA] Successfully synced offline action:', item.url);
        }
      } catch (err) {
        // Still offline or failed network call
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.error('[Onebridge PWA] Error processing offline queue:', e);
  }
}
