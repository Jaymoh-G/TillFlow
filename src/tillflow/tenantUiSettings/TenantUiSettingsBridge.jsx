import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getTenantUiSettingsRequest } from "../api/tenantUiSettings";
import { addAfterSaveAppSettingsListener } from "../../utils/appSettingsStorage";
import { addAfterSaveSystemSettingsListener } from "../../utils/systemSettingsStorage";
import {
  addAfterSaveStorePreferencesListener,
  addAfterSaveSystemIntegrationsListener
} from "../../utils/websiteLocalSettingsStorage";
import { addAfterSaveNotificationPreferencesListener } from "../../utils/notificationPreferencesStorage";
import { hydrateTenantUiSettings } from "./hydrateTenantUiSettings";
import { mergeTenantUiSettingsBucket } from "./mergeTenantUiSettings";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "./events";

/**
 * When TillFlow auth is active: hydrate local settings from API once per session user,
 * and push local saves (website / app / system / notifications) to API for users with `tenant.manage`.
 */
export default function TenantUiSettingsBridge() {
  const { token, user, bootstrapping, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const unsubs = [
      addAfterSaveAppSettingsListener((data) => {
        void mergeTenantUiSettingsBucket(token, { app: data });
      }),
      addAfterSaveSystemSettingsListener((data) => {
        void mergeTenantUiSettingsBucket(token, { system: data });
      }),
      addAfterSaveStorePreferencesListener((data) => {
        void mergeTenantUiSettingsBucket(token, { website: { storePreferences: data } });
      }),
      addAfterSaveSystemIntegrationsListener((data) => {
        void mergeTenantUiSettingsBucket(token, { website: { systemIntegrations: data } });
      }),
      addAfterSaveNotificationPreferencesListener((userId, prefs) => {
        if (userId == null || String(userId).trim() === "") {
          return;
        }
        void mergeTenantUiSettingsBucket(token, {
          notifications: { [String(userId)]: prefs }
        });
      })
    ];

    return () => {
      for (const u of unsubs) {
        u();
      }
    };
  }, [token]);

  useEffect(() => {
    if (bootstrapping || !isAuthenticated || !token || !user?.id) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getTenantUiSettingsRequest(token);
        if (cancelled) {
          return;
        }
        hydrateTenantUiSettings(res.settings, user.id);
        window.dispatchEvent(new CustomEvent(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED));
      } catch {
        /* offline or API error — keep existing local cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapping, isAuthenticated, token, user?.id]);

  return null;
}
