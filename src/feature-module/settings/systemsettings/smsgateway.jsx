import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import CommonFooter from "../../../components/footer/commonFooter";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import { smsIcon01, smsIcon02, smsIcon03 } from "../../../utils/imagepath";
import { loadSystemSettings, saveSystemSettings } from "../../../utils/systemSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

function ModalFrame({ title, onClose, children, footer }) {
  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered custom-modal-two" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title mb-0">{title}</h4>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

const SmsGateway = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [all, setAll] = useState(loadSystemSettings);
  const [savedMsg, setSavedMsg] = useState("");
  const [modal, setModal] = useState(/** @type {null | "nexmo" | "twilio" | "twoFactor"} */ (null));

  const g = all.smsGateways;
  const d = all.smsDelivery;

  const persist = useCallback((next) => {
    saveSystemSettings(next);
    setAll(next);
    setSavedMsg("SMS settings saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, []);

  const reloadSmsFromServerCache = useCallback(() => {
    setAll(loadSystemSettings());
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadSmsFromServerCache);

  const toggle = useCallback(
    (key, enabled) => {
      setAll((a) => ({
        ...a,
        smsGateways: { ...a.smsGateways, [key]: { ...a.smsGateways[key], enabled } }
      }));
    },
    []
  );

  const setGateway = useCallback((key, partial) => {
    setAll((a) => ({
      ...a,
      smsGateways: {
        ...a.smsGateways,
        [key]: { ...a.smsGateways[key], ...partial }
      }
    }));
  }, []);

  const cards = [
    { key: "nexmo", title: "Nexmo / Vonage", img: smsIcon01, id: "nexmo" },
    { key: "twoFactor", title: "2Factor / local SMS API", img: smsIcon02, id: "twoFactor" },
    { key: "twilio", title: "Twilio", img: smsIcon03, id: "twilio" }
  ];

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
                  <div className="card-header d-flex flex-wrap align-items-start justify-content-between gap-2">
                    <div>
                      <h4 className="mb-0">SMS gateways</h4>
                      <p className="text-muted small mb-0">
                        Enable providers under <strong>SMS Gateways</strong> in the sidebar. “SMS Settings” opens
                        this screen.
                      </p>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">Credentials are stored locally (localStorage).</p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => persist({ ...all })}>
                      Save all
                    </button>
                  </div>
                  <div className="card-body pb-0">
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="row">
                      {cards.map(({ key, title, img, id }) => (
                        <div key={key} className="col-xl-4 col-lg-6 col-md-4 col-sm-6 d-flex">
                          <div className="card flex-fill">
                            <div className="card-body">
                              <div className="w-100 d-flex justify-content-between align-items-center">
                                <div>
                                  <img src={img} alt="" />
                                  <span className="d-block small text-muted mt-1">{title}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <button
                                    type="button"
                                    className="btn btn-link p-1 text-dark"
                                    title="Configure"
                                    onClick={() => setModal(/** @type {typeof modal} */ (id))}>
                                    <i className="feather icon-settings" />
                                  </button>
                                  <div className="status-toggle modal-status d-flex justify-content-between align-items-center ms-2">
                                    <input
                                      type="checkbox"
                                      id={`sms-${key}`}
                                      className="check"
                                      checked={Boolean(g[key].enabled)}
                                      onChange={(ev) => toggle(key, ev.target.checked)}
                                    />
                                    <label htmlFor={`sms-${key}`} className="checktoggle" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-top pt-3 mt-3">
                      <h6 className="mb-3">Delivery defaults</h6>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Default sender label / ID</label>
                          <input
                            type="text"
                            className="form-control"
                            value={d.senderLabel}
                            onChange={(ev) =>
                              setAll((a) => ({
                                ...a,
                                smsDelivery: { ...a.smsDelivery, senderLabel: ev.target.value }
                              }))
                            }
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Internal notes</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Optional"
                            value={d.notes}
                            onChange={(ev) =>
                              setAll((a) => ({
                                ...a,
                                smsDelivery: { ...a.smsDelivery, notes: ev.target.value }
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {modal === "nexmo" ? (
        <ModalFrame
          title="Nexmo / Vonage"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  persist({ ...all });
                  setModal(null);
                }}>
                Save
              </button>
            </>
          }>
          <>
            <div className="mb-3">
              <label className="form-label">API key</label>
              <input
                type="text"
                className="form-control"
                value={g.nexmo.apiKey}
                onChange={(ev) => setGateway("nexmo", { apiKey: ev.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">API secret</label>
              <input
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={g.nexmo.apiSecret}
                onChange={(ev) => setGateway("nexmo", { apiSecret: ev.target.value })}
              />
            </div>
            <div className="mb-0">
              <label className="form-label">Sender ID</label>
              <input
                type="text"
                className="form-control"
                value={g.nexmo.senderId}
                onChange={(ev) => setGateway("nexmo", { senderId: ev.target.value })}
              />
            </div>
          </>
        </ModalFrame>
      ) : null}

      {modal === "twilio" ? (
        <ModalFrame
          title="Twilio"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  persist({ ...all });
                  setModal(null);
                }}>
                Save
              </button>
            </>
          }>
          <>
            <div className="mb-3">
              <label className="form-label">Account SID</label>
              <input
                type="text"
                className="form-control"
                value={g.twilio.accountSid}
                onChange={(ev) => setGateway("twilio", { accountSid: ev.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Auth token</label>
              <input
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={g.twilio.authToken}
                onChange={(ev) => setGateway("twilio", { authToken: ev.target.value })}
              />
            </div>
            <div className="mb-0">
              <label className="form-label">From number</label>
              <input
                type="text"
                className="form-control"
                placeholder="+15551234567"
                value={g.twilio.fromNumber}
                onChange={(ev) => setGateway("twilio", { fromNumber: ev.target.value })}
              />
            </div>
          </>
        </ModalFrame>
      ) : null}

      {modal === "twoFactor" ? (
        <ModalFrame
          title="2Factor / HTTP SMS"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  persist({ ...all });
                  setModal(null);
                }}>
                Save
              </button>
            </>
          }>
          <>
            <div className="mb-3">
              <label className="form-label">API key</label>
              <input
                type="text"
                className="form-control"
                value={g.twoFactor.apiKey}
                onChange={(ev) => setGateway("twoFactor", { apiKey: ev.target.value })}
              />
            </div>
            <div className="mb-0">
              <label className="form-label">Sender ID</label>
              <input
                type="text"
                className="form-control"
                value={g.twoFactor.senderId}
                onChange={(ev) => setGateway("twoFactor", { senderId: ev.target.value })}
              />
            </div>
          </>
        </ModalFrame>
      ) : null}
    </>
  );
};

export default SmsGateway;
