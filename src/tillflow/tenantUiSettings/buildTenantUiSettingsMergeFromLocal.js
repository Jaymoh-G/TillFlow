import { loadAppSettings } from "../../utils/appSettingsStorage";
import { loadNotificationPreferences } from "../../utils/notificationPreferencesStorage";
import { loadSystemSettings } from "../../utils/systemSettingsStorage";
import {
  loadStorePreferences,
  loadSystemIntegrations
} from "../../utils/websiteLocalSettingsStorage";

/**
 * Full tenant UI settings document from current localStorage (for manual “Sync to server”).
 *
 * @param {string|number|null|undefined} userId
 * @returns {Record<string, unknown>}
 */
export function buildTenantUiSettingsMergeFromLocal(userId) {
  /** @type {Record<string, unknown>} */
  const merge = {
    website: {
      systemIntegrations: loadSystemIntegrations(),
      storePreferences: loadStorePreferences()
    },
    app: loadAppSettings(),
    system: loadSystemSettings()
  };
  if (userId != null && String(userId).trim() !== "") {
    merge.notifications = { [String(userId)]: loadNotificationPreferences(userId) };
  }
  return merge;
}
