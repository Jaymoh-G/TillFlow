import { TillFlowApiError } from "../api/errors";
import { mergeTenantUiSettingsRequest } from "../api/tenantUiSettings";
import { buildTenantUiSettingsMergeFromLocal } from "./buildTenantUiSettingsMergeFromLocal";

/** Fired when automatic sync is rejected (e.g. missing tenant.manage). Debounced to avoid spam. */
export const TILLFLOW_TENANT_UI_SETTINGS_SYNC_DENIED = "tillflow-tenant-ui-settings-sync-denied";

let lastDeniedDispatchAt = 0;
const DENIED_DEBOUNCE_MS = 5000;

function maybeDispatchSyncDenied(status) {
  if (status !== 403 && status !== 401) {
    return;
  }
  const now = Date.now();
  if (now - lastDeniedDispatchAt < DENIED_DEBOUNCE_MS) {
    return;
  }
  lastDeniedDispatchAt = now;
  window.dispatchEvent(new CustomEvent(TILLFLOW_TENANT_UI_SETTINGS_SYNC_DENIED, { detail: { status } }));
}

/**
 * Push a partial merge to the tenant UI settings API. Ignores network/403 so local saves still win on device.
 *
 * @param {string} token
 * @param {Record<string, unknown>} merge
 */
export async function mergeTenantUiSettingsBucket(token, merge) {
  if (!token || !merge || typeof merge !== "object") {
    return;
  }
  try {
    await mergeTenantUiSettingsRequest(token, merge);
    lastDeniedDispatchAt = 0;
  } catch (e) {
    if (e instanceof TillFlowApiError) {
      maybeDispatchSyncDenied(e.status);
      if (e.status === 403 || e.status === 401) {
        return;
      }
    }
    /* offline / server error — localStorage already updated by caller */
  }
}

/**
 * One-shot full push of all UI settings buckets (same shape as incremental merges).
 *
 * @param {string} token
 * @param {string|number|null|undefined} userId
 */
export async function flushTenantUiSettingsToServer(token, userId) {
  const merge = buildTenantUiSettingsMergeFromLocal(userId);
  await mergeTenantUiSettingsRequest(token, merge);
  lastDeniedDispatchAt = 0;
}

