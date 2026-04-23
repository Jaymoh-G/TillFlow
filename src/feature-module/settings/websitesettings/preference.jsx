import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import {
  defaultStorePreferences,
  loadStorePreferences,
  saveStorePreferences
} from "../../../utils/websiteLocalSettingsStorage";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "../../../tillflow/tenantUiSettings/events";

const FLAGS = [
  { key: "maintenanceMode", label: "Maintenance mode", hint: "Planned: block storefront when enabled server-side." },
  { key: "coupons", label: "Coupons", hint: "Discount codes at checkout." },
  { key: "offers", label: "Offers / promotions", hint: "Time-bound deals and bundles." },
  { key: "multiLanguage", label: "Multiple languages", hint: "UI and labels in more than one locale." },
  { key: "multiCurrency", label: "Multiple currencies", hint: "Prices and totals in customer currency." },
  { key: "sms", label: "SMS features", hint: "OTP and SMS notifications when gateway is configured." },
  { key: "stores", label: "Stores", hint: "Multi-store inventory and routing." },
  { key: "warehouses", label: "Warehouses", hint: "Extra stock locations beyond a single store." },
  { key: "barcode", label: "Barcode", hint: "Scan and print barcodes for products." },
  { key: "qrCode", label: "QR codes", hint: "QR-based labels or payment links." },
  { key: "hrms", label: "HR / payroll", hint: "Staff, attendance, payroll modules." }
];

const Preference = () => {
  const [prefs, setPrefs] = useState(() => loadStorePreferences());
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    setPrefs(loadStorePreferences());
  }, []);

  useEffect(() => {
    const onHydrated = () => setPrefs(loadStorePreferences());
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
  }, []);

  const persist = useCallback((next) => {
    setPrefs(next);
    saveStorePreferences(next);
    setSavedMsg("Preferences saved on this device.");
    window.setTimeout(() => setSavedMsg(""), 2200);
  }, []);

  const toggle = (key) => {
    persist({ ...prefs, [key]: !prefs[key] });
  };

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin/");

  return (
    <>
      <div className="page-wrapper settings-preference-page">
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
                    <h4 className="fs-18 fw-bold mb-0">Preference</h4>
                    {showTillflowBackLink ? (
                      <Link to="/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    <p className="fs-14 text-muted mb-3">
                      Feature switches for this workspace. Values are kept in <strong>local storage</strong> until the
                      API can persist tenant configuration.
                    </p>
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="row">
                      {FLAGS.map((row) => (
                        <div key={row.key} className="col-xl-4 col-lg-6 col-md-4 col-sm-6">
                          <div className="card mb-3">
                            <div className="card-body">
                              <div className="d-flex align-items-center justify-content-between">
                                <div>
                                  <h5 className="fw-medium mb-0">{row.label}</h5>
                                  <p className="fs-12 text-muted mb-0 mt-1">{row.hint}</p>
                                </div>
                                <div className="status-toggle modal-status d-flex justify-content-between align-items-center ms-2 flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    id={`pref-${row.key}`}
                                    className="check"
                                    checked={Boolean(prefs[row.key])}
                                    onChange={() => toggle(row.key)}
                                  />
                                  <label htmlFor={`pref-${row.key}`} className="checktoggle" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-end settings-bottom-btn mt-0">
                      <button
                        type="button"
                        className="btn btn-outline-secondary me-2"
                        onClick={() => persist(defaultStorePreferences())}>
                        Reset defaults
                      </button>
                    </div>
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

export default Preference;
