import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import CommonFooter from "../../../components/footer/commonFooter";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import {
  EMAIL_TEMPLATE_DEFS,
  getDefaultSystemSettings,
  loadSystemSettings,
  saveSystemSettings
} from "../../../utils/systemSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const MERGE_TAGS = [
  "{Customer Name}",
  "{Company Name}",
  "{Order ID}",
  "{Invoice ID}",
  "{Receipt ID}",
  "{Login Link}",
  "{Support Email}",
  "{Password Reset Link}",
  "{Product Name}",
  "{Order Total}",
  "{Order Date}",
  "{Delivery Date}",
  "{Discount Code}"
];

const Emailtemplatesettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/admin");

  const [templates, setTemplates] = useState(() => ({ ...loadSystemSettings().emailTemplates }));
  const [openId, setOpenId] = useState(EMAIL_TEMPLATE_DEFS[0].id);
  const [savedMsg, setSavedMsg] = useState("");

  const persistAll = useCallback(() => {
    const n = loadSystemSettings();
    n.emailTemplates = templates;
    saveSystemSettings(n);
    setSavedMsg("Email templates saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, [templates]);

  const resetOne = useCallback((id) => {
    const d = getDefaultSystemSettings().emailTemplates[id];
    setTemplates((t) => ({ ...t, [id]: { ...d } }));
  }, []);

  const reloadEmailTemplatesFromServerCache = useCallback(() => {
    setTemplates({ ...loadSystemSettings().emailTemplates });
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadEmailTemplatesFromServerCache);

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
                      <h4 className="mb-0">Email templates</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">HTML/text bodies — localStorage until mail merge API exists.</p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={persistAll}>
                      Save all
                    </button>
                  </div>
                  <div className="card-body pb-0">
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="accordion-card-one">
                      {EMAIL_TEMPLATE_DEFS.map((def) => {
                        const row = templates[def.id] || { enabled: true, body: "" };
                        const open = openId === def.id;
                        return (
                          <div key={def.id} className="accordion-item pb-3 border-bottom mb-3">
                            <button
                              type="button"
                              className="accordion-button p-3 pb-0 w-100 bg-transparent border-0 text-start shadow-none"
                              onClick={() => setOpenId(open ? "" : def.id)}
                              aria-expanded={open}>
                              <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2">
                                <div className="d-flex align-items-center">
                                  <div className="status-toggle modal-status d-flex justify-content-between align-items-center me-2">
                                    <input
                                      type="checkbox"
                                      id={`et-${def.id}`}
                                      className="check"
                                      checked={row.enabled}
                                      onChange={(e) =>
                                        setTemplates((t) => ({
                                          ...t,
                                          [def.id]: { ...row, enabled: e.target.checked }
                                        }))
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <label htmlFor={`et-${def.id}`} className="checktoggle" />
                                  </div>
                                  <h5 className="mb-0">
                                    <span>{def.title}</span>
                                  </h5>
                                </div>
                                <i className="chevron-down-add" />
                              </div>
                            </button>
                            {open ? (
                              <div className="pt-3">
                                <div className="row gy-4">
                                  <div className="col-xl-7">
                                    <div className="card mb-3">
                                      <div className="card-body">
                                        <textarea
                                          className="form-control"
                                          style={{ height: 300 }}
                                          value={row.body}
                                          onChange={(e) =>
                                            setTemplates((t) => ({
                                              ...t,
                                              [def.id]: { ...row, body: e.target.value }
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="d-flex align-items-center flex-wrap row-gap-3">
                                      <button type="button" className="btn bg-cyan me-2" onClick={persistAll}>
                                        Save template
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary me-2"
                                        onClick={() => resetOne(def.id)}>
                                        Reset to default
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => window.alert(row.body.slice(0, 2000))}>
                                        Preview (first 2k chars)
                                      </button>
                                    </div>
                                  </div>
                                  <div className="col-xl-5">
                                    <div className="card mb-0">
                                      <div className="card-body">
                                        <h5 className="mb-2">Tags</h5>
                                        <div>
                                          {MERGE_TAGS.map((tag) => (
                                            <p key={tag} className="fs-12 text-orange mb-1">
                                              {tag}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
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
    </>
  );
};

export default Emailtemplatesettings;
