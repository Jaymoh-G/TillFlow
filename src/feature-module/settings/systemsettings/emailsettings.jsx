import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CommonFooter from "../../../components/footer/commonFooter";
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
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
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

const EmailSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [all, setAll] = useState(loadSystemSettings);
  const [savedMsg, setSavedMsg] = useState("");
  const [modal, setModal] = useState(/** @type {null | "php" | "smtp" | "sendgrid" | "test"} */ (null));

  const persist = useCallback((next) => {
    saveSystemSettings(next);
    setAll(next);
    setSavedMsg("Saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, []);

  const setEmail = useCallback((partial) => {
    setAll((a) => ({
      ...a,
      email: { ...a.email, ...partial }
    }));
  }, []);

  const toggleProvider = useCallback(
    (key, enabled) => {
      const next = loadSystemSettings();
      next.email[key] = { ...next.email[key], enabled };
      persist(next);
    },
    [persist]
  );

  const reloadEmailFromServerCache = useCallback(() => {
    setAll(loadSystemSettings());
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadEmailFromServerCache);

  const cards = [
    {
      key: "phpMailer",
      title: "PHP Mailer",
      desc: "Send mail using PHP’s mail() transport (simple hosting setups).",
      modal: "php"
    },
    {
      key: "smtp",
      title: "SMTP",
      desc: "Use an SMTP server (recommended for production).",
      modal: "smtp"
    },
    {
      key: "sendGrid",
      title: "SendGrid",
      desc: "Cloud email API — good for high volume and analytics.",
      modal: "sendgrid"
    }
  ];

  const e = all.email;

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
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <h4 className="mb-0">Email settings</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          Stored in this browser until tenant mail API is connected.
                        </p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => setModal("test")}>
                      Send test email
                    </button>
                  </div>
                  <div className="card-body pb-0">
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="row">
                      {cards.map(({ key, title, desc, modal: m }) => {
                        const row = e[key];
                        const on = Boolean(row.enabled);
                        return (
                          <div key={key} className="col-xxl-4 col-xl-6 col-lg-12 col-md-6 d-flex">
                            <div className="card flex-fill">
                              <div className="card-body">
                                <div className="d-flex align-items-center justify-content-between w-100 mb-3">
                                  <h5 className="mb-0">{title}</h5>
                                  <span
                                    className={`badge ${on ? "bg-outline-success" : "bg-light text-dark border"}`}>
                                    {on ? "Enabled" : "Off"}
                                  </span>
                                </div>
                                <p className="mb-3">{desc}</p>
                                <div className="d-flex align-items-center justify-content-between">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setModal(/** @type {"php"|"smtp"|"sendgrid"} */ (m))}>
                                    <i className="ti ti-tool me-2" />
                                    Configure
                                  </button>
                                  <div className="status-toggle modal-status d-flex justify-content-between align-items-center ms-2">
                                    <input
                                      type="checkbox"
                                      id={`email-${key}`}
                                      className="check"
                                      checked={on}
                                      onChange={(ev) => toggleProvider(key, ev.target.checked)}
                                    />
                                    <label htmlFor={`email-${key}`} className="checktoggle" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {modal === "php" ? (
        <ModalFrame
          title="PHP Mailer"
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
              <label className="form-label">From email address</label>
              <input
                type="email"
                className="form-control"
                value={e.phpMailer.fromEmail}
                onChange={(ev) =>
                  setEmail({ phpMailer: { ...e.phpMailer, fromEmail: ev.target.value } })
                }
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password / app password</label>
              <input
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={e.phpMailer.password}
                onChange={(ev) =>
                  setEmail({ phpMailer: { ...e.phpMailer, password: ev.target.value } })
                }
              />
            </div>
            <div className="mb-0">
              <label className="form-label">From name</label>
              <input
                type="text"
                className="form-control"
                value={e.phpMailer.fromName}
                onChange={(ev) =>
                  setEmail({ phpMailer: { ...e.phpMailer, fromName: ev.target.value } })
                }
              />
            </div>
          </>
        </ModalFrame>
      ) : null}

      {modal === "smtp" ? (
        <ModalFrame
          title="SMTP"
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
              <label className="form-label">From email</label>
              <input
                type="email"
                className="form-control"
                value={e.smtp.fromEmail}
                onChange={(ev) => setEmail({ smtp: { ...e.smtp, fromEmail: ev.target.value } })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">From name</label>
              <input
                type="text"
                className="form-control"
                value={e.smtp.fromName}
                onChange={(ev) => setEmail({ smtp: { ...e.smtp, fromName: ev.target.value } })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={e.smtp.password}
                onChange={(ev) => setEmail({ smtp: { ...e.smtp, password: ev.target.value } })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Host</label>
              <input
                type="text"
                className="form-control"
                value={e.smtp.host}
                onChange={(ev) => setEmail({ smtp: { ...e.smtp, host: ev.target.value } })}
              />
            </div>
            <div className="mb-0">
              <label className="form-label">Port</label>
              <input
                type="text"
                className="form-control"
                value={e.smtp.port}
                onChange={(ev) => setEmail({ smtp: { ...e.smtp, port: ev.target.value } })}
              />
            </div>
          </>
        </ModalFrame>
      ) : null}

      {modal === "sendgrid" ? (
        <ModalFrame
          title="SendGrid"
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
                type="password"
                className="form-control"
                autoComplete="new-password"
                value={e.sendGrid.apiKey}
                onChange={(ev) =>
                  setEmail({ sendGrid: { ...e.sendGrid, apiKey: ev.target.value } })
                }
              />
            </div>
            <div className="mb-0">
              <label className="form-label">From email</label>
              <input
                type="email"
                className="form-control"
                value={e.sendGrid.fromEmail}
                onChange={(ev) =>
                  setEmail({ sendGrid: { ...e.sendGrid, fromEmail: ev.target.value } })
                }
              />
            </div>
          </>
        </ModalFrame>
      ) : null}

      {modal === "test" ? (
        <ModalFrame
          title="Test email"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  persist({ ...all, testRecipient: all.testRecipient.trim() });
                  setModal(null);
                }}>
                Save address
              </button>
            </>
          }>
          <p className="text-muted small">
            No message is sent from this demo UI — only the saved recipient is stored locally.
          </p>
          <label className="form-label">Recipient email</label>
          <input
            type="email"
            className="form-control"
            value={all.testRecipient}
            onChange={(ev) => setAll((a) => ({ ...a, testRecipient: ev.target.value }))}
          />
        </ModalFrame>
      ) : null}
    </>
  );
};

export default EmailSettings;
