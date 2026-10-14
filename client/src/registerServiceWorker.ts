/**
 * Onebridge HRMS - Service Worker Registration & PWA Utilities
 */

import api from './services/api';

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
let refreshing = false;

export function registerServiceWorker(onUpdateAvailable?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Reload window when new service worker activates and claims the client
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[Onebridge PWA] New ServiceWorker active. Reloading application...');
      window.location.reload();
    }
  });

  const runRegister = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[Onebridge PWA] ServiceWorker registered with scope:', registration.scope);

        // Force check for updates immediately
        registration.update().catch(() => {});

        // If there's already a worker waiting, tell it to take over
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[Onebridge PWA] New content is available; taking over.');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
                if (onUpdateAvailable) {
                  onUpdateAvailable();
                }
              } else {
                console.log('[Onebridge PWA] Content is cached for offline use.');
              }
            }
          });
        });

        // Check for SW updates when user returns to app/tab
        window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
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
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    runRegister();
  } else {
    window.addEventListener('load', runRegister);
  }

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_VAPID_PUBLIC_KEY =
  'BGg-yUnjTfp7wF09oSzBuOhUnYxXY0N7vBjHOb-vxVWI5Vt6BjK6-RKAU8NxkHPL0CDGEcH6UP5eHV_m--YAt4w';

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const reg = await Promise.race([readyPromise, timeoutPromise]);
    if (reg) return reg;

    // Fallback: register directly if ready timed out
    const freshReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return freshReg;
  } catch (err) {
    console.warn('[Onebridge PWA] Error acquiring ready SW:', err);
    return null;
  }
}

/**
 * Subscribe the current PWA installation to Web Push Notifications
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Onebridge PWA] Push notifications not supported on this device/browser.');
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  try {
    const registration = await getReadyRegistration();
    if (!registration) {
      console.warn('[Onebridge PWA] No service worker registration found for push.');
      return false;
    }

    // Determine VAPID public key with immediate fallback to avoid user-gesture timeout on mobile
    let vapidPublicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const cachedKey = localStorage.getItem('obi_vapid_key');
      if (cachedKey) {
        vapidPublicKey = cachedKey;
      } else {
        const res = await api.get('/notifications/vapid-public-key');
        if (res.data?.data?.publicKey) {
          vapidPublicKey = res.data.data.publicKey;
          localStorage.setItem('obi_vapid_key', vapidPublicKey);
        }
      }
    } catch {
      // Use DEFAULT_VAPID_PUBLIC_KEY
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    let subscription = await registration.pushManager.getSubscription();

    // Verify existing subscription keys; if invalid or missing, unsubscribe and re-subscribe cleanly
    let subData = subscription ? subscription.toJSON() : null;
    if (subscription && (!subData?.keys?.p256dh || !subData?.keys?.auth)) {
      try {
        await subscription.unsubscribe();
      } catch {}
      subscription = null;
      subData = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
      subData = subscription.toJSON();
    }

    if (subscription && subData) {
      const cleanPayload = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subData.keys?.p256dh,
          auth: subData.keys?.auth,
        },
      };

      await api.post('/notifications/push-subscription', {
        subscription: cleanPayload,
      });

      console.log('[Onebridge PWA] Device push subscription successfully saved to backend.');
      return true;
    }
  } catch (err) {
    console.warn('[Onebridge PWA] Push subscription registration note:', err);
  }
  return false;
}

/**
 * Trigger a real native push notification test to the current user's device
 */
export async function sendTestPushNotification(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.post('/notifications/test-push');
    return {
      success: true,
      message: res.data?.message || 'Native phone notification sent! Check your notification tray.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.response?.data?.message || 'Could not send test notification.',
    };
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
