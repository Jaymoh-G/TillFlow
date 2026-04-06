import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonFooter from "../../../components/footer/commonFooter";
import CommonSelect from "../../../components/select/common-select";
import { loadSystemSettings, saveSystemSettings } from "../../../utils/systemSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const CHANNEL_OPTIONS = [
  { value: "SMS", label: "SMS" },
  { value: "EMail", label: "Email" }
];

const DIGIT_OPTIONS = [
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "8", label: "8" }
];

const DURATION_OPTIONS = [
  { value: "5mins", label: "5 minutes" },
  { value: "10mins", label: "10 minutes" },
  { value: "15mins", label: "15 minutes" },
  { value: "30mins", label: "30 minutes" }
];

const OtpSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [all, setAll] = useState(loadSystemSettings);
  const [baseline, setBaseline] = useState(loadSystemSettings);
  const [savedMsg, setSavedMsg] = useState("");

  const o = all.otp;

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const next = { ...all, otp: { ...o } };
      saveSystemSettings(next);
      setAll(next);
      setBaseline(next);
      setSavedMsg("OTP settings saved.");
      window.setTimeout(() => setSavedMsg(""), 3500);
    },
    [all, o]
  );

  const cancel = useCallback(() => {
    setAll(baseline);
    setSavedMsg("");
  }, [baseline]);

  const reloadOtpFromServerCache = useCallback(() => {
    const n = loadSystemSettings();
    setAll(n);
    setBaseline(n);
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadOtpFromServerCache);

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
                      <h4 className="mb-1">OTP</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">Stored in this browser (localStorage).</p>
                      ) : null}
                    </div>
                    <div className="card-body">
                      {savedMsg ? (
                        <div className="alert alert-success py-2 mb-3" role="status">
                          {savedMsg}
                        </div>
                      ) : null}
                      <div className="localization-info">
                        <div className="row align-items-center">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>OTP channel</h6>
                              <p>How one-time codes are delivered</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <CommonSelect
                              filter={false}
                              options={CHANNEL_OPTIONS}
                              value={o.channel}
                              onChange={(e) =>
                                setAll((a) => ({
                                  ...a,
                                  otp: { ...a.otp, channel: e?.value ?? "SMS" }
                                }))
                              }
                              placeholder="Choose"
                              appendTo="body"
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>OTP length</h6>
                              <p>Number of digits</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <CommonSelect
                              filter={false}
                              options={DIGIT_OPTIONS}
                              value={o.digits}
                              onChange={(e) =>
                                setAll((a) => ({
                                  ...a,
                                  otp: { ...a.otp, digits: e?.value ?? "6" }
                                }))
                              }
                              placeholder="Choose"
                              appendTo="body"
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>OTP expiry</h6>
                              <p>How long a code stays valid</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <CommonSelect
                              filter={false}
                              options={DURATION_OPTIONS}
                              value={o.expire}
                              onChange={(e) =>
                                setAll((a) => ({
                                  ...a,
                                  otp: { ...a.otp, expire: e?.value ?? "10mins" }
                                }))
                              }
                              placeholder="Choose"
                              appendTo="body"
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

export default OtpSettings;
