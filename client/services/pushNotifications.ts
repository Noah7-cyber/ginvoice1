import { loadAuthToken, buildUrl } from './api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeUserToPush = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Push notifications are not supported by this browser.');
    return false;
  }

  try {
    const permissionResult = await Notification.requestPermission();
    if (permissionResult !== 'granted') {
      console.warn('[WebPush] User denied or dismissed the permission prompt.');
      return false;
    }

    console.log('[WebPush] Permission granted. Waiting for service worker ready...');
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      if (!VAPID_PUBLIC_KEY) {
        console.warn('[WebPush] VAPID public key is missing from environment variables.');
        return false;
      }

      console.log('[WebPush] Generating new subscription...');
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    console.log('[WebPush] Subscription generated:', JSON.stringify(subscription));

    const token = loadAuthToken();
    if (!token) {
      console.warn('[WebPush] No auth token found. Cannot save subscription to backend.');
      return false;
    }

    console.log('[WebPush] Sending subscription to backend...');
    const response = await fetch(buildUrl('/api/push/save-subscription'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      console.error('[WebPush] Failed to save subscription to server:', await response.text());
      return false;
    } else {
      console.log('[WebPush] Successfully subscribed and saved subscription natively.');
      return true;
    }
  } catch (error) {
    console.error('[WebPush] Error during push subscription:', error);
    return false;
  }
};
