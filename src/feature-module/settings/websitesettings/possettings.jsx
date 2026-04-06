import { useCallback, useState } from "react";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonFooter from "../../../components/footer/commonFooter";
import CommonSelect from "../../../components/select/common-select";
import { useLocation } from "react-router-dom";
import { loadAppSettings, saveAppSettings } from "../../../utils/appSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const PAPER_OPTIONS = [
  { value: "58mm", label: "58mm thermal" },
  { value: "80mm", label: "80mm thermal" },
  { value: "A4", label: "A4 (full page)" }
];

const PAYMENT_LABELS = [
  { key: "cod", label: "COD" },
  { key: "cheque", label: "Cheque" },
  { key: "card", label: "Card" },
  { key: "paypal", label: "PayPal" },
  { key: "bankTransfer", label: "Bank transfer" },
  { key: "cash", label: "Cash" }
];

const PosSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [pos, setPos] = useState(() => loadAppSettings().pos);
  const [baseline, setBaseline] = useState(() => loadAppSettings().pos);
  const [savedMsg, setSavedMsg] = useState("");

  const togglePayment = useCallback((key) => {
    setPos((p) => ({
      ...p,
      paymentMethods: { ...p.paymentMethods, [key]: !p.paymentMethods[key] }
    }));
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const app = loadAppSettings();
      app.pos = { ...pos };
      saveAppSettings(app);
      setBaseline({ ...pos });
      setSavedMsg("POS settings saved.");
      window.setTimeout(() => setSavedMsg(""), 3500);
    },
    [pos]
  );

  const handleCancel = useCallback(() => {
    setPos({ ...baseline });
    setSavedMsg("");
  }, [baseline]);

  const reloadPosFromServerCache = useCallback(() => {
    const p = loadAppSettings().pos;
    setPos({ ...p });
    setBaseline({ ...p });
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadPosFromServerCache);

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
                <div className="card flex-fill mb-0">
                  <form onSubmit={handleSubmit}>
                    <div className="card-header">
                      <h4 className="mb-1">POS settings</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          Receipt layout and tenders available at the register (localStorage for now).
                        </p>
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
                              <h6>Receipt / ticket width</h6>
                              <p>Used when printing from POS</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <CommonSelect
                              filter={false}
                              options={PAPER_OPTIONS}
                              placeholder="Choose"
                              value={pos.receiptPaper}
                              onChange={(e) =>
                                setPos((p) => ({ ...p, receiptPaper: e?.value ?? "80mm" }))
                              }
                              appendTo="body"
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-4">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Payment methods</h6>
                              <p>Shown as quick tenders in POS</p>
                            </div>
                          </div>
                          <div className="col-sm-8">
                            <div className="localization-select pos-payment-method d-flex flex-wrap align-items-center mb-0 w-100 gap-3">
                              {PAYMENT_LABELS.map(({ key, label }) => (
                                <div className="custom-control custom-checkbox" key={key}>
                                  <label className="checkboxs mb-0 pb-0 line-height-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(pos.paymentMethods[key])}
                                      onChange={() => togglePayment(key)}
                                    />
                                    <span className="checkmarks" />
                                    {label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="row align-items-center mt-4">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Sound effects</h6>
                              <p>Beeps on scan / payment (when the device supports it)</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <div className="localization-select d-flex align-items-center">
                              <div className="status-toggle modal-status d-flex justify-content-between align-items-center me-3">
                                <input
                                  type="checkbox"
                                  id="pos-sound"
                                  className="check"
                                  checked={pos.soundEnabled}
                                  onChange={(e) =>
                                    setPos((p) => ({ ...p, soundEnabled: e.target.checked }))
                                  }
                                />
                                <label htmlFor="pos-sound" className="checktoggle" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-end gap-2 mt-3">
                        <button type="button" className="btn btn-secondary" onClick={handleCancel}>
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

export default PosSettings;
