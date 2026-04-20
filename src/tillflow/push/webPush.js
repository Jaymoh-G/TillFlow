import { deletePushSubscriptionRequest, getVapidPublicKeyRequest, storePushSubscriptionRequest } from "../api/pushSubscriptions";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * @param {string|null|undefined} token
 */
export async function registerTillflowWebPush(token) {
  if (!token || typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  if (!("PushManager" in window)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const data = await getVapidPublicKeyRequest(token);
    const publicKey =
      data && typeof data === "object" ? data.public_key ?? data.publicKey : null;
    if (typeof publicKey !== "string" || !publicKey.trim()) {
      return;
    }
    const key = urlBase64ToUint8Array(publicKey.trim());
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        return;
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return;
    }
    await storePushSubscriptionRequest(token, {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      },
      content_encoding: json.contentEncoding
    });
  } catch {
    /* offline, 503, or user denied */
  }
}

/**
 * @param {string|null|undefined} token
 */
export async function unregisterTillflowWebPush(token) {
  if (!token || typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      if (json.endpoint) {
        try {
          await deletePushSubscriptionRequest(token, { endpoint: json.endpoint });
        } catch {
          /* ignore */
        }
      }
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}
