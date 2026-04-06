import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import { logoSmallPng } from "../../../utils/imagepath";
import CommonSelect from "../../../components/select/common-select";
import {
  defaultInvoiceSettings,
  loadAppSettings,
  saveAppSettings
} from "../../../utils/appSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const DUE_OPTIONS = Array.from({ length: 90 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1)
}));

const ROUNDOFF_OPTIONS = [
  { value: "up", label: "Round up" },
  { value: "down", label: "Round down" },
  { value: "nearest", label: "Round to nearest" }
];

const InvoiceSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [form, setForm] = useState(() => loadAppSettings().invoice);
  const [baseline, setBaseline] = useState(() => loadAppSettings().invoice);
  const [savedMsg, setSavedMsg] = useState("");

  const logoSrc = form.invoiceLogoDataUrl || logoSmallPng;

  const update = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const handleLogo = useCallback((fileList) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    if (file.size > 800 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : null;
      update({ invoiceLogoDataUrl: url });
    };
    reader.readAsDataURL(file);
  }, [update]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const app = loadAppSettings();
      app.invoice = { ...form };
      saveAppSettings(app);
      setBaseline({ ...form });
      setSavedMsg("Invoice settings saved.");
      window.setTimeout(() => setSavedMsg(""), 4000);
    },
    [form]
  );

  const handleCancel = useCallback(() => {
    setForm({ ...baseline });
    setSavedMsg("");
  }, [baseline]);

  const handleResetDefaults = useCallback(() => {
    const d = defaultInvoiceSettings();
    setForm(d);
    setSavedMsg("");
  }, []);

  const reloadInvoiceFromServerCache = useCallback(() => {
    const inv = loadAppSettings().invoice;
    setForm({ ...inv });
    setBaseline({ ...inv });
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadInvoiceFromServerCache);

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
                      <h4 className="mb-1">Invoice Settings</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          Saved in this browser (localStorage) until a tenant API is wired for invoicing.
                        </p>
                      ) : null}
                    </div>
                    <div className="card-body ">
                      {savedMsg ? (
                        <div className="alert alert-success py-2 mb-3" role="status">
                          {savedMsg}
                        </div>
                      ) : null}
                      <ul className="logo-company">
                        <li>
                          <div className="row">
                            <div className="col-md-4">
                              <div className="logo-info me-0 mb-3 mb-md-0">
                                <h6>Invoice logo</h6>
                                <p>Image shown on PDFs and printed invoices (stored locally).</p>
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="profile-pic-upload mb-0 me-0">
                                <div className="new-employee-field">
                                  <div className="mb-3 mb-md-0">
                                    <div className="image-upload mb-0">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleLogo(e.target.files)}
                                      />
                                      <div className="image-uploads">
                                        <h4>
                                          <i className="feather icon-upload" />
                                          Upload photo
                                        </h4>
                                      </div>
                                    </div>
                                    <span>For best results use a square logo, max 800 KB.</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-2">
                              <div className="new-logo ms-auto">
                                <Link to="#" onClick={(e) => e.preventDefault()}>
                                  <img src={logoSrc} alt="Invoice logo preview" className="img-fluid" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>
                      <div className="localization-info">
                        <div className="row align-items-center">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Invoice prefix</h6>
                              <p>Prefix before the invoice number</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <input
                              type="text"
                              className="form-control"
                              value={form.prefix}
                              onChange={(e) => update({ prefix: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Invoice due</h6>
                              <p>Default payment due days on new invoices</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <div className="localization-select d-flex align-items-center fixed-width">
                              <CommonSelect
                                filter
                                options={DUE_OPTIONS}
                                value={form.dueDays}
                                onChange={(e) => update({ dueDays: e?.value ?? "7" })}
                                placeholder="Choose"
                              />
                              <span className="ms-2 text-muted">days</span>
                            </div>
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Invoice round off</h6>
                              <p>Adjust totals on invoices</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <div className="localization-select d-flex align-items-center flex-wrap gap-2">
                              <div className="status-toggle modal-status d-flex justify-content-between align-items-center me-3">
                                <input
                                  type="checkbox"
                                  id="inv-roundoff"
                                  className="check"
                                  checked={form.roundOffEnabled}
                                  onChange={(e) => update({ roundOffEnabled: e.target.checked })}
                                />
                                <label htmlFor="inv-roundoff" className="checktoggle" />
                              </div>
                              <CommonSelect
                                filter={false}
                                options={ROUNDOFF_OPTIONS}
                                value={form.roundOffMode}
                                onChange={(e) => update({ roundOffMode: e?.value ?? "up" })}
                                placeholder="Mode"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="row align-items-center mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Show company details</h6>
                              <p>Show your company block on invoices</p>
                            </div>
                          </div>
                          <div className="col-sm-4">
                            <div className="status-toggle modal-status d-flex justify-content-between align-items-center me-3">
                              <input
                                type="checkbox"
                                id="inv-company"
                                className="check"
                                checked={form.showCompanyDetails}
                                onChange={(e) => update({ showCompanyDetails: e.target.checked })}
                              />
                              <label htmlFor="inv-company" className="checktoggle" />
                            </div>
                          </div>
                        </div>
                        <div className="row mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Invoice header terms</h6>
                            </div>
                          </div>
                          <div className="col-sm-8">
                            <textarea
                              rows={4}
                              className="form-control"
                              placeholder="Shown above line items"
                              value={form.headerTerms}
                              onChange={(e) => update({ headerTerms: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row mt-3">
                          <div className="col-sm-4">
                            <div className="setting-info">
                              <h6>Invoice footer terms</h6>
                            </div>
                          </div>
                          <div className="col-sm-8">
                            <textarea
                              rows={4}
                              className="form-control"
                              placeholder="Payment instructions, legal text, etc."
                              value={form.footerTerms}
                              onChange={(e) => update({ footerTerms: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-end flex-wrap gap-2 mt-3">
                        <button type="button" className="btn btn-outline-secondary" onClick={handleResetDefaults}>
                          Reset defaults
                        </button>
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
      </div>
    </>
  );
};

export default InvoiceSettings;
