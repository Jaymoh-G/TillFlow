import { tillflowFetch } from "./client";

/**
 * @returns {Promise<{ message?: string, settings: Record<string, unknown> }>}
 */
export function getTenantUiSettingsRequest(token) {
  return tillflowFetch("/tenant/ui-settings", { token });
}

/**
 * Deep-merged on server into tenant `ui_settings` (requires `tenant.manage`).
 *
 * @param {string} token
 * @param {Record<string, unknown>} merge — e.g. `{ website: { storePreferences: {...} } }`
 * @returns {Promise<{ message?: string, settings: Record<string, unknown> }>}
 */
export function mergeTenantUiSettingsRequest(token, merge) {
  return tillflowFetch("/tenant/ui-settings", { method: "PATCH", token, body: { merge } });
}
