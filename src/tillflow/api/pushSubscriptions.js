import { tillflowFetch } from "./client";

/**
 * @param {string|null|undefined} token
 */
export function getVapidPublicKeyRequest(token) {
  return tillflowFetch("/push/vapid-public-key", { token });
}

/**
 * @param {string|null|undefined} token
 * @param {{ endpoint: string, keys: { p256dh: string, auth: string }, content_encoding?: string }} body
 */
export function storePushSubscriptionRequest(token, body) {
  return tillflowFetch("/push/subscriptions", { method: "POST", token, body });
}

/**
 * @param {string|null|undefined} token
 * @param {{ endpoint: string }} body
 */
export function deletePushSubscriptionRequest(token, body) {
  return tillflowFetch("/push/subscriptions", { method: "DELETE", token, body });
}
