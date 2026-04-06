import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonFooter from "../../../components/footer/commonFooter";
import CommonSelect from "../../../components/select/common-select";
import { loadSystemSettings, saveSystemSettings } from "../../../utils/systemSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const POSITION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" }
];

const GdprSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [all, setAll] = useState(loadSystemSettings);
  const [baseline, setBaseline] = useState(loadSystemSettings);
  const [savedMsg, setSavedMsg] = useState("");

  const g = all.gdpr;

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const next = { ...all, gdpr: { ...g } };
      saveSystemSettings(next);
      setAll(next);
      setBaseline(next);
      setSavedMsg("GDPR / cookie banner settings saved.");
      window.setTimeout(() => setSavedMsg(""), 3500);
    },
    [all, g]
  );

  const cancel = useCallback(() => {
    setAll(baseline);
    setSavedMsg("");
  }, [baseline]);

  const setGdpr = useCallback((partial) => {
    setAll((a) => ({ ...a, gdpr: { ...a.gdpr, ...partial } }));
  }, []);

  const reloadGdprFromServerCache = useCallback(() => {
    const n = loadSystemSettings();
    setAll(n);
    setBaseline(n);
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadGdprFromServerCache);

  return (
    <>
      <div className="page-wrapper">
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
                <div className="card flex-fill mb-0 min-w-0">
                  <form onSubmit={submit}>
                    <div className="card-header">
                      <h4 className="mb-1">GDPR cookies</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">Banner copy and layout (localStorage).</p>
                      ) : null}
                    </div>
                    <div className="card-body">
                      {savedMsg ? (
                        <div className="alert alert-success py-2 mb-3" role="status">
                          {savedMsg}
                        </div>
                      ) : null}
                      <div className="localization-info">
                        <div className="row">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Consent message</h6>
                            </div>
                          </div>
                          <div className="col-sm-8">
                            <textarea
                              rows={4}
                              className="form-control"
                              placeholder="We use cookies to improve your experience..."
                              value={g.consentText}
                              onChange={(e) => setGdpr({ consentText: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Banner position</h6>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <CommonSelect
                              filter={false}
                              options={POSITION_OPTIONS}
                              value={g.position}
                              onChange={(e) => setGdpr({ position: e?.value ?? "left" })}
                              placeholder="Choose"
                              appendTo="body"
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Accept button</h6>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <input
                              type="text"
                              className="form-control"
                              value={g.agreeText}
                              onChange={(e) => setGdpr({ agreeText: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Decline button</h6>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <input
                              type="text"
                              className="form-control"
                              value={g.declineText}
                              onChange={(e) => setGdpr({ declineText: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Show decline button</h6>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <div className="status-toggle modal-status d-flex justify-content-between align-items-center me-3">
                              <input
                                type="checkbox"
                                id="gdpr-decline"
                                className="check"
                                checked={g.showDecline}
                                onChange={(e) => setGdpr({ showDecline: e.target.checked })}
                              />
                              <label htmlFor="gdpr-decline" className="checktoggle" />
                            </div>
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Cookie policy URL</h6>
                            </div>
                          </div>
                          <div className="col-sm-8">
                            <input
                              type="url"
                              className="form-control"
                              placeholder="https://"
                              value={g.policyLink}
                              onChange={(e) => setGdpr({ policyLink: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-end gap-2 mt-3">
                        <button type="button" className="btn btn-secondary" onClick={cancel}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Save changes
                        </button>
                      </div>
                    </div>
                  </form>
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

export default GdprSettings;
