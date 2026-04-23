import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import CommonFooter from "../../../components/footer/commonFooter";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import { all_routes as route } from "../../../routes/all_routes";
import {
  getDefaultAutomationSettings,
  loadSystemSettings,
  saveSystemSettings
} from "../../../utils/systemSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "../../../tillflow/tenantUiSettings/events";

function ChannelRow({ label, channels, onChange }) {
  return (
    <div className="row align-items-center mb-2">
      <div className="col-md-4">
        <span className="text-muted small">{label}</span>
      </div>
      <div className="col-md-8 d-flex gap-3">
        <label className="form-check form-check-inline mb-0">
          <input
            type="checkbox"
            className="form-check-input"
            checked={Boolean(channels?.email)}
            onChange={(e) => onChange({ ...channels, email: e.target.checked })}
          />
          <span className="form-check-label">Email</span>
        </label>
        <label className="form-check form-check-inline mb-0">
          <input
            type="checkbox"
            className="form-check-input"
            checked={Boolean(channels?.sms)}
            onChange={(e) => onChange({ ...channels, sms: e.target.checked })}
          />
          <span className="form-check-label">SMS</span>
        </label>
      </div>
    </div>
  );
}

const AutomationSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/admin");

  const [all, setAll] = useState(loadSystemSettings);
  const [savedMsg, setSavedMsg] = useState("");

  const automation = all.automation ?? getDefaultAutomationSettings();

  const persist = useCallback(
    (next) => {
      saveSystemSettings(next);
      setAll(next);
      setSavedMsg("Automation settings saved.");
      window.setTimeout(() => setSavedMsg(""), 3500);
    },
    []
  );

  const reloadFromHydration = useCallback(() => {
    setAll(loadSystemSettings());
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadFromHydration);

  useEffect(() => {
    const onHydrated = () => reloadFromHydration();
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
  }, [reloadFromHydration]);

  const setAutomation = useCallback(
    (patch) => {
      setAll((a) => ({
        ...a,
        automation: { ...getDefaultAutomationSettings(), ...(a.automation || {}), ...patch }
      }));
    },
    []
  );

  const setChannels = useCallback((key, next) => {
    setAll((a) => ({
      ...a,
      automation: {
        ...getDefaultAutomationSettings(),
        ...(a.automation || {}),
        [key]: next
      }
    }));
  }, []);

  return (
    <>
      <div className="page-wrapper">
        <div className="content settings-content">
          <div className="page-header settings-pg-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Settings</h4>
                <h6>Automation and scheduled reminders</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>
          <div className="row">
            <div className="col-xl-12">
              <div className="settings-wrapper d-flex">
                <SettingsSideBar />
                <div className="card flex-fill mb-0 min-w-0">
                  <div className="card-header d-flex flex-wrap align-items-start justify-content-between gap-2">
                    <div>
                      <h4 className="mb-0">Automation</h4>
                      <p className="text-muted small mb-0">
                        Reminders run in the background at the hour you choose (server must run Laravel&apos;s
                        scheduler). Configure SMS under{" "}
                        {isTillflow ? (
                          <Link to={route.tillflowAdminSmsGateway}>SMS gateways</Link>
                        ) : (
                          "SMS gateways"
                        )}
                        .
                      </p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => persist({ ...all })}>
                      Save
                    </button>
                  </div>
                  <div className="card-body">
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}

                    <h6 className="mb-3">Schedule</h6>
                    <div className="row g-3 mb-4">
                      <div className="col-md-4">
                        <label className="form-label">Hour of day (0–23)</label>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          className="form-control"
                          value={automation.runHourLocal}
                          onChange={(e) =>
                            setAutomation({ runHourLocal: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })
                          }
                        />
                      </div>
                      <div className="col-md-8">
                        <label className="form-label">Timezone (IANA)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Africa/Nairobi"
                          value={automation.timezone}
                          onChange={(e) => setAutomation({ timezone: e.target.value })}
                        />
                      </div>
                    </div>

                    <h6 className="mb-3">Invoices</h6>
                    <div className="row g-3 mb-2">
                      <div className="col-md-3">
                        <label className="form-label">Default due date (days after issue date)</label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          className="form-control"
                          value={automation.invoiceDefaultDueDays}
                          onChange={(e) =>
                            setAutomation({
                              invoiceDefaultDueDays: Math.max(1, Number(e.target.value) || 1)
                            })
                          }
                        />
                        <p className="text-muted small mt-1 mb-0">
                          Applied when a new invoice is created without a due date.
                        </p>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Due reminder (days before due date)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          className="form-control"
                          value={automation.dueReminderDaysBefore}
                          onChange={(e) => setAutomation({ dueReminderDaysBefore: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">First overdue notice (days after due date)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          className="form-control"
                          value={automation.overdueFirstNoticeDaysAfterDue}
                          onChange={(e) =>
                            setAutomation({ overdueFirstNoticeDaysAfterDue: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Resend overdue every (days, 0 = no repeat)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          className="form-control"
                          value={automation.overdueResendEveryDays}
                          onChange={(e) =>
                            setAutomation({ overdueResendEveryDays: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <ChannelRow
                      label="Due reminder channels"
                      channels={automation.invoiceDueReminderChannels}
                      onChange={(c) => setChannels("invoiceDueReminderChannels", c)}
                    />
                    <ChannelRow
                      label="Overdue channels"
                      channels={automation.invoiceOverdueChannels}
                      onChange={(c) => setChannels("invoiceOverdueChannels", c)}
                    />

                    <h6 className="mt-4 mb-3">Quotations and proposals</h6>
                    <div className="row g-3 mb-2">
                      <div className="col-md-3">
                        <label className="form-label">Quote expiry reminder (days before)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          className="form-control"
                          value={automation.quoteExpiryReminderDaysBefore}
                          onChange={(e) =>
                            setAutomation({ quoteExpiryReminderDaysBefore: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Proposal expiry reminder (days before)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          className="form-control"
                          value={automation.proposalExpiryReminderDaysBefore}
                          onChange={(e) =>
                            setAutomation({ proposalExpiryReminderDaysBefore: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Default quote validity (days)</label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          className="form-control"
                          value={automation.quoteDefaultValidDays}
                          onChange={(e) =>
                            setAutomation({ quoteDefaultValidDays: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Default proposal validity (days)</label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          className="form-control"
                          value={automation.proposalDefaultValidDays}
                          onChange={(e) =>
                            setAutomation({
                              proposalDefaultValidDays: Math.max(1, Number(e.target.value) || 1)
                            })
                          }
                        />
                      </div>
                    </div>
                    <ChannelRow
                      label="Quote expiry channels"
                      channels={automation.quoteExpiryReminderChannels}
                      onChange={(c) => setChannels("quoteExpiryReminderChannels", c)}
                    />
                    <ChannelRow
                      label="Proposal expiry channels"
                      channels={automation.proposalExpiryReminderChannels}
                      onChange={(c) => setChannels("proposalExpiryReminderChannels", c)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
    </>
  );
};

export default AutomationSettings;
