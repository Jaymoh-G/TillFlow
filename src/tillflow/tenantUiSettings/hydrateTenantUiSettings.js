import { replaceAppSettingsFromServer } from "../../utils/appSettingsStorage";
import { replaceNotificationPreferencesFromServer } from "../../utils/notificationPreferencesStorage";
import {
  replaceStorePreferencesFromServer,
  replaceSystemIntegrationsFromServer
} from "../../utils/websiteLocalSettingsStorage";
import { replaceSystemSettingsFromServer } from "../../utils/systemSettingsStorage";

/**
 * Apply tenant UI settings from API into localStorage read cache (no sync listeners).
 *
 * @param {unknown} settings
 * @param {string|number|null|undefined} userId
 */
export function hydrateTenantUiSettings(settings, userId) {
  if (!settings || typeof settings !== "object") {
    return;
  }
  const s = /** @type {Record<string, unknown>} */ (settings);

  const website = s.website && typeof s.website === "object" ? /** @type {Record<string, unknown>} */ (s.website) : null;
  if (website?.storePreferences) {
    replaceStorePreferencesFromServer(website.storePreferences);
  }
  if (website?.systemIntegrations) {
    replaceSystemIntegrationsFromServer(website.systemIntegrations);
  }

  if (s.app && typeof s.app === "object") {
    replaceAppSettingsFromServer(s.app);
  }
  if (s.system && typeof s.system === "object") {
    replaceSystemSettingsFromServer(s.system);
  }

  const notifications =
    s.notifications && typeof s.notifications === "object"
      ? /** @type {Record<string, unknown>} */ (s.notifications)
      : null;
  if (notifications && userId != null && String(userId).trim() !== "") {
    const slice = notifications[String(userId)];
    if (slice && typeof slice === "object") {
      replaceNotificationPreferencesFromServer(userId, slice);
    }
  }
}
