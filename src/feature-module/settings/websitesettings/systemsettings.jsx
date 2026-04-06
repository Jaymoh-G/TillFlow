import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import {
  defaultSystemIntegrations,
  loadSystemIntegrations,
  saveSystemIntegrations
} from "../../../utils/websiteLocalSettingsStorage";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "../../../tillflow/tenantUiSettings/events";

const INTEGRATIONS = [
  {
    key: "captcha",
    title: "Spam protection (reCAPTCHA etc.)",
    description: "When wired to the backend, helps block bots on sign-in and forms.",
    icon: "icon-shield"
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "Optional traffic and usage metrics (e.g. privacy-respecting analytics).",
    icon: "icon-bar-chart-2"
  },
  {
    key: "adsense",
    title: "Display ads",
    description: "Advertising slots are not active in this build; toggle is for future use.",
    icon: "icon-layout"
  },
  {
    key: "maps",
    title: "Maps",
    description: "Store locator or address widgets using a maps provider API key.",
    icon: "icon-map-pin"
  }
];

const SystemSettings = () => {
  const [prefs, setPrefs] = useState(() => loadSystemIntegrations());
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    setPrefs(loadSystemIntegrations());
  }, []);

  useEffect(() => {
    const onHydrated = () => setPrefs(loadSystemIntegrations());
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
  }, []);

  const persist = useCallback((next) => {
    setPrefs(next);
    saveSystemIntegrations(next);
    setSavedMsg("Saved on this device.");
    window.setTimeout(() => setSavedMsg(""), 2200);
  }, []);

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

  return (
    <>
      <div className="page-wrapper settings-system-page">
        <div className="content settings-content">
          <div className="page-header settings-pg-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Settings</h4>
                <h6>Manage your settings on portal</h6>
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
                <div className="card flex-fill mb-0">
                  <div className="card-header d-flex flex-wrap align-items-center gap-2 justify-content-between">
                    <h4 className="fs-18 fw-bold mb-0">System settings</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body pb-0">
                    <p className="fs-14 text-muted mb-3">
                      Integration flags are stored in this browser only. Connecting real API keys and server-side
                      enforcement will ship in a later backend release.
                    </p>
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="row">
                      {INTEGRATIONS.map((row) => (
                        <div key={row.key} className="col-xl-6 col-lg-12 col-md-6 d-flex">
                          <div className="card flex-fill mb-3">
                            <div className="card-body">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center">
                                  <span className="security-settings-page__icon security-settings-page__icon--lg">
                                    <i className={`feather ${row.icon}`} aria-hidden />
                                  </span>
                                  <div className="security-title">
                                    <h5 className="fs-16 fw-medium mb-0">{row.title}</h5>
                                  </div>
                                </div>
                                <div className="status-toggle modal-status d-flex justify-content-between align-items-center ms-2">
                                  <input
                                    type="checkbox"
                                    id={`sys-int-${row.key}`}
                                    className="check"
                                    checked={Boolean(prefs[row.key])}
                                    onChange={(e) =>
                                      persist({ ...prefs, [row.key]: e.target.checked })
                                    }
                                  />
                                  <label htmlFor={`sys-int-${row.key}`} className="checktoggle">
                                    {" "}
                                  </label>
                                </div>
                              </div>
                              <p className="fs-14 mb-0 text-muted">{row.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="fs-13 text-muted mb-4">
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => persist(defaultSystemIntegrations())}>
                        Reset to defaults
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemSettings;
