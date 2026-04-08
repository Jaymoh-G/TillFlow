import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CommonFooter from "../../../components/footer/commonFooter";
import { companyLogo, logoSmall, whiteCompanyLogo } from "../../../utils/imagepath";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import SettingsSideBar from "../settingssidebar";
import {
  formToCompanyProfileApiBody,
  loadCompanySettings,
  profileApiToForm,
  QUOTATION_FOOTER_DEFAULTS,
  saveCompanySettings
} from "../../../utils/companySettingsStorage";
import { useOptionalAuth } from "../../../tillflow/auth/AuthContext";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import {
  getTenantCompanyProfileRequest,
  updateTenantCompanyProfileRequest
} from "../../../tillflow/api/tenantCompany";
import {
  getTenantUiSettingsRequest,
  mergeTenantUiSettingsRequest
} from "../../../tillflow/api/tenantUiSettings";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";
const TILLFLOW_COMPANY_LOGOS_KEY = "retailpos_company_logo_settings_v1";

function normalizeLogos(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    icon: typeof src.icon === "string" && src.icon.trim() ? src.icon : null,
    favicon: typeof src.favicon === "string" && src.favicon.trim() ? src.favicon : null,
    logo: typeof src.logo === "string" && src.logo.trim() ? src.logo : null,
    darkLogo: typeof src.darkLogo === "string" && src.darkLogo.trim() ? src.darkLogo : null
  };
}

function loadSavedLogos() {
  if (typeof window === "undefined") {
    return normalizeLogos(null);
  }
  try {
    const raw = localStorage.getItem(TILLFLOW_COMPANY_LOGOS_KEY);
    if (!raw) {
      return normalizeLogos(null);
    }
    return normalizeLogos(JSON.parse(raw));
  } catch {
    return normalizeLogos(null);
  }
}

function saveSavedLogos(logos) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(TILLFLOW_COMPANY_LOGOS_KEY, JSON.stringify(normalizeLogos(logos)));
  } catch {
    /* ignore */
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

const CompanySettings = () => {
  const auth = useOptionalAuth();
  const token = auth?.token ?? sessionStorage.getItem(TILLFLOW_TOKEN_KEY);
  const refreshUser = auth?.refreshUser;

  const [form, setForm] = useState(() => loadCompanySettings());
  const [baseline, setBaseline] = useState(() => loadCompanySettings());
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageSource, setStorageSource] = useState(/** @type {"server" | "local"} */ ("local"));
  const [savedLogos, setSavedLogos] = useState(() => loadSavedLogos());
  const [baselineLogos, setBaselineLogos] = useState(() => loadSavedLogos());
  /** Remount file inputs after clear so the same file can be selected again and `onChange` fires. */
  const [logoFileKeys, setLogoFileKeys] = useState(() => ({
    icon: 0,
    favicon: 0,
    logo: 0,
    darkLogo: 0
  }));

  useEffect(() => {
    if (!token) {
      setStorageSource("local");
      return;
    }
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      setErrorMsg("");
      try {
        const [data, uiData] = await Promise.all([
          getTenantCompanyProfileRequest(token),
          getTenantUiSettingsRequest(token)
        ]);
        if (cancelled) {
          return;
        }
        const f = profileApiToForm(data.profile);
        setForm(f);
        setBaseline({ ...f });
        saveCompanySettings(f);
        const logos = normalizeLogos(uiData?.settings?.website?.companyLogos);
        setSavedLogos(logos);
        setBaselineLogos(logos);
        saveSavedLogos(logos);
        setStorageSource("server");
      } catch (e) {
        if (!cancelled) {
          setStorageSource("local");
          const msg = e instanceof Error ? e.message : "Could not load company profile.";
          setErrorMsg(`${msg} Showing data saved in this browser.`);
        }
      } finally {
        if (!cancelled) {
          setApiLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleFile = useCallback(
    async (field, fileList) => {
      const file = fileList?.[0];
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg("Image must be 5 MB or smaller.");
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        setErrorMsg("");
        setSavedLogos((prev) => {
          const next = { ...prev, [field]: dataUrl || null };
          saveSavedLogos(next);
          return next;
        });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Could not load selected image.");
      }
    },
    []
  );

  const clearPreview = useCallback((field) => {
    setSavedLogos((prev) => {
      const next = { ...prev, [field]: null };
      saveSavedLogos(next);
      return next;
    });
    setLogoFileKeys((prev) => ({
      ...prev,
      [field]: (prev[field] ?? 0) + 1
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setSavedMsg("");
      setErrorMsg("");
      const name = form.companyName.trim();
      const email = form.email.trim();
      const phone = form.phone.trim();
      if (!name) {
        setErrorMsg("Company name is required.");
        return;
      }
      if (!email) {
        setErrorMsg("Company email is required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMsg("Enter a valid email address.");
        return;
      }
      if (!phone) {
        setErrorMsg("Phone number is required.");
        return;
      }
      if (!form.location.trim()) {
        setErrorMsg("Location is required.");
        return;
      }

      const next = {
        ...form,
        companyName: name,
        email,
        phone,
        website: form.website.trim(),
        location: form.location.trim()
      };

      if (token) {
        setSaving(true);
        try {
          const body = formToCompanyProfileApiBody(next);
          await updateTenantCompanyProfileRequest(token, body);
          await mergeTenantUiSettingsRequest(token, {
            website: { companyLogos: normalizeLogos(savedLogos) }
          });
          saveCompanySettings(next);
          saveSavedLogos(savedLogos);
          setForm(next);
          setBaseline({ ...next });
          setBaselineLogos({ ...savedLogos });
          setStorageSource("server");
          setSavedMsg("Company profile saved to the database for your store.");
          await refreshUser?.();
        } catch (e) {
          if (e instanceof TillFlowApiError && e.status === 403) {
            setErrorMsg(
              "You do not have permission to update company settings. Ask an owner or administrator."
            );
          } else {
            setErrorMsg(
              e instanceof Error ? e.message : "Could not save to the server. Try again."
            );
          }
        } finally {
          setSaving(false);
        }
        return;
      }

      saveCompanySettings(next);
      setForm(next);
      setBaseline({ ...next });
      setSavedMsg("Company settings saved in this browser only. Sign in via TillFlow to sync to the database.");
    },
    [form, token, refreshUser, savedLogos]
  );

  const handleCancel = useCallback(() => {
    setSavedMsg("");
    setErrorMsg("");
    const b = { ...baseline };
    setForm(b);
    setSavedLogos({ ...baselineLogos });
    saveSavedLogos(baselineLogos);
    setLogoFileKeys((k) => ({
      icon: k.icon + 1,
      favicon: k.favicon + 1,
      logo: k.logo + 1,
      darkLogo: k.darkLogo + 1
    }));
  }, [baseline, baselineLogos]);

  const defaultFor = {
    icon: logoSmall,
    favicon: logoSmall,
    logo: companyLogo,
    darkLogo: whiteCompanyLogo
  };

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

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
                  <div className="card-header">
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                      <h4 className="fs-18 fw-bold mb-0">Company Settings</h4>
                      {showTillflowBackLink ? (
                        <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm flex-shrink-0">
                          Back to admin
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-muted small mb-0">
                      {token ? (
                        storageSource === "server" ? (
                          <>
                            Signed in — profile loads from your{" "}
                            <strong>tenant database</strong>. Saving updates the server (requires admin /
                            owner permission).
                          </>
                        ) : (
                          <>
                            Signed in — using <strong>browser backup</strong> because the server profile
                            could not be loaded. Saves stay local until the API is available.
                          </>
                        )
                      ) : (
                        <>
                          Not signed in to TillFlow — data is kept in <strong>this browser only</strong>.
                          Log in through TillFlow to save company details to the database for all users.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="card-body">
                    {apiLoading ? (
                      <div className="alert alert-light border py-2 mb-3" role="status">
                        Loading company profile…
                      </div>
                    ) : null}
                    {savedMsg ? (
                      <div className="alert alert-success py-2" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    {errorMsg ? (
                      <div className="alert alert-danger py-2" role="alert">
                        {errorMsg}
                      </div>
                    ) : null}
                    <form onSubmit={handleSubmit} aria-busy={saving || apiLoading}>
                      <div className="border-bottom mb-3">
                        <div className="card-title-head">
                          <h6 className="fs-16 fw-bold mb-2">
                            <span className="fs-16 me-2">
                              <i className="ti ti-building" />
                            </span>
                            Company Information
                          </h6>
                        </div>
                        <div className="row">
                          <div className="col-xl-4 col-lg-6 col-md-4">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-name">
                                Company Name <span className="text-danger">*</span>
                              </label>
                              <input
                                id="co-name"
                                type="text"
                                className="form-control"
                                autoComplete="organization"
                                value={form.companyName}
                                onChange={(e) => updateField("companyName", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-xl-4 col-lg-6 col-md-4">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-email">
                                Company Email Address <span className="text-danger">*</span>
                              </label>
                              <input
                                id="co-email"
                                type="email"
                                className="form-control"
                                autoComplete="email"
                                value={form.email}
                                onChange={(e) => updateField("email", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-phone">
                                Phone Number <span className="text-danger">*</span>
                              </label>
                              <input
                                id="co-phone"
                                type="text"
                                className="form-control"
                                autoComplete="tel"
                                value={form.phone}
                                onChange={(e) => updateField("phone", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-web">
                                Website <span className="text-muted fw-normal">(optional)</span>
                              </label>
                              <input
                                id="co-web"
                                type="text"
                                className="form-control"
                                inputMode="url"
                                autoComplete="url"
                                placeholder="https:// or yourdomain.com"
                                value={form.website}
                                onChange={(e) => updateField("website", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-bottom mb-3 pb-3">
                        <div className="card-title-head">
                          <h6 className="fs-16 fw-bold mb-2">
                            <span className="fs-16 me-2">
                              <i className="ti ti-photo" />
                            </span>
                            Company Images
                          </h6>
                          <p className="text-muted small">
                            Previews are for this session only until file upload is wired to storage.
                          </p>
                        </div>
                        <div className="row align-items-center gy-3">
                          {[
                            { key: "icon", title: "Company Icon", hint: "Company icon / avatar" },
                            { key: "favicon", title: "Favicon", hint: "Browser tab icon" },
                            { key: "logo", title: "Company Logo", hint: "Primary logo" },
                            { key: "darkLogo", title: "Company Dark Logo", hint: "For dark backgrounds", darkBg: true }
                          ].map(({ key, title, hint, darkBg }) => (
                            <div className="col-12" key={key}>
                              <div className="row align-items-center gy-2">
                              <div className="col-xl-9">
                                <div className="row gy-3 align-items-center">
                                  <div className="col-lg-4">
                                    <div className="logo-info">
                                      <h6 className="fw-medium">{title}</h6>
                                      <p className="mb-0">{hint}</p>
                                    </div>
                                  </div>
                                  <div className="col-lg-8">
                                    <div className="profile-pic-upload mb-0 justify-content-lg-end">
                                      <div className="new-employee-field">
                                        <div className="mb-0">
                                          <div className="image-upload mb-0">
                                            <input
                                              key={`company-logo-${key}-${logoFileKeys[key] ?? 0}`}
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => handleFile(key, e.target.files)}
                                            />
                                            <div className="image-uploads">
                                              <h4>
                                                <i className="ti ti-upload me-1" />
                                                Upload Image
                                              </h4>
                                            </div>
                                          </div>
                                          <span className="mt-1 d-inline-block">
                                            Recommended 450×450 px or similar. Max 5 MB.
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="col-xl-3">
                                <div className={`new-logo ms-xl-auto ${darkBg ? "bg-secondary rounded p-1" : ""}`}>
                                  <div className="text-center text-xl-start">
                                    <img src={savedLogos[key] || defaultFor[key]} alt="" className="img-fluid d-block mx-auto mx-xl-0" />
                                    <button
                                      type="button"
                                      className="btn btn-link text-danger text-decoration-none p-0 mt-2 d-inline-flex align-items-center small"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        clearPreview(key);
                                      }}
                                      title="Remove custom image for this slot (use Save to sync server)">
                                      <i className="ti ti-x me-1" aria-hidden />
                                      Clear preview
                                    </button>
                                  </div>
                                </div>
                              </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="company-address">
                        <div className="card-title-head">
                          <h6 className="fs-16 fw-bold mb-2">
                            <span className="fs-16 me-2">
                              <i className="ti ti-map-pin" />
                            </span>
                            Location
                          </h6>
                        </div>
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-location">
                                Location <span className="text-danger">*</span>
                              </label>
                              <textarea
                                id="co-location"
                                className="form-control"
                                rows={3}
                                autoComplete="street-address"
                                placeholder="Address, city, region, country — as you want it to appear"
                                value={form.location}
                                onChange={(e) => updateField("location", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-bottom mb-3 pb-3">
                        <div className="card-title-head">
                          <h6 className="fs-16 fw-bold mb-2">
                            <span className="fs-16 me-2">
                              <i className="ti ti-file-invoice" />
                            </span>
                            Quotation footer
                          </h6>
                          <p className="text-muted small mb-0">
                            Shown at the bottom of quotation view, PDF, and customer email attachments.
                            Leave blank to use the sample wording as a default.
                          </p>
                        </div>
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-qfoot-pay">
                                Payment instructions
                              </label>
                              <textarea
                                id="co-qfoot-pay"
                                className="form-control"
                                rows={2}
                                placeholder={QUOTATION_FOOTER_DEFAULTS.paymentLine}
                                value={form.quotationFooterPaymentLine}
                                onChange={(e) =>
                                  updateField("quotationFooterPaymentLine", e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label" htmlFor="co-qfoot-bank">
                                Bank / payment details
                              </label>
                              <textarea
                                id="co-qfoot-bank"
                                className="form-control"
                                rows={2}
                                placeholder={QUOTATION_FOOTER_DEFAULTS.bankLine}
                                value={form.quotationFooterBankLine}
                                onChange={(e) =>
                                  updateField("quotationFooterBankLine", e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label" htmlFor="co-qfoot-close">
                                Closing line
                              </label>
                              <textarea
                                id="co-qfoot-close"
                                className="form-control"
                                rows={2}
                                placeholder={QUOTATION_FOOTER_DEFAULTS.closingLine}
                                value={form.quotationFooterClosingLine}
                                onChange={(e) =>
                                  updateField("quotationFooterClosingLine", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-end settings-bottom-btn mt-0">
                        <button type="button" className="btn btn-secondary me-2" onClick={handleCancel}>
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving || apiLoading}>
                          {saving ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </form>
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

export default CompanySettings;
