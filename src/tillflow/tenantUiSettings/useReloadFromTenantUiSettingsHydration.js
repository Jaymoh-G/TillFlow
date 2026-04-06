import { useEffect } from "react";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "./events";

/**
 * Re-run `reload` when tenant UI settings are pulled from the API into localStorage (TillFlow).
 *
 * @param {() => void} reload
 */
export function useReloadFromTenantUiSettingsHydration(reload) {
  useEffect(() => {
    const fn = () => reload();
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, fn);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, fn);
  }, [reload]);
}
