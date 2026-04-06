import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { TillFlowApiError } from "../api/errors";
import {
  flushTenantUiSettingsToServer,
  TILLFLOW_TENANT_UI_SETTINGS_SYNC_DENIED
} from "./mergeTenantUiSettings";

/**
 * One-shot notice when background UI-settings sync is denied (e.g. cashier without tenant.manage).
 * Offers a manual “Sync to server” retry (full merge) for users who gain permission or for admins.
 */
export default function TenantUiSettingsSyncBanner() {
  const { token, user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onDenied = () => {
      setError("");
      setOpen(true);
    };
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_SYNC_DENIED, onDenied);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_SYNC_DENIED, onDenied);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    setError("");
  }, []);

  const syncToServer = useCallback(async () => {
    if (!token || user?.id == null) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await flushTenantUiSettingsToServer(token, user.id);
      setOpen(false);
    } catch (e) {
      if (e instanceof TillFlowApiError && (e.status === 403 || e.status === 401)) {
        setError("Your account cannot sync tenant-wide settings. Ask an admin to sign in and use Sync to server.");
      } else if (e instanceof TillFlowApiError) {
        setError(e.message || "Sync failed.");
      } else {
        setError("Sync failed. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [token, user?.id]);

  if (!isAuthenticated || !open) {
    return null;
  }

  return (
    <div className="tf-sync-banner" role="status">
      <div className="tf-sync-banner__inner">
        <div className="tf-sync-banner__text">
          <strong>Saved on this device only.</strong> Tenant-wide sync needs permission to update settings on the
          server. Use <strong>Sync to server</strong> when an authorized user is ready, or dismiss if you will sync
          later.
        </div>
        <div className="tf-sync-banner__actions">
          <button type="button" className="tf-btn tf-btn--primary tf-btn--sm" disabled={busy} onClick={syncToServer}>
            {busy ? "Syncing…" : "Sync to server"}
          </button>
          <button type="button" className="tf-btn tf-btn--ghost tf-btn--sm" disabled={busy} onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
      {error ? (
        <div className="tf-sync-banner__error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
