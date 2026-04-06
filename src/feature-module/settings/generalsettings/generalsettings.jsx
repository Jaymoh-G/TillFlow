import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonFooter from "../../../components/footer/commonFooter";
import SettingsSideBar from "../settingssidebar";
import { useOptionalAuth } from "../../../tillflow/auth/AuthContext";
import { meRequest, updateProfileRequest, updateProfileWithAvatarRequest } from "../../../tillflow/api/auth";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import {
  loadProfileSettings,
  saveProfileSettings,
  userToProfileForm
} from "../../../utils/profileSettingsStorage";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";

const GeneralSettings = () => {
  const auth = useOptionalAuth();
  const token = auth?.token ?? sessionStorage.getItem(TILLFLOW_TOKEN_KEY);
  const refreshUser = auth?.refreshUser ?? null;
  const authBootstrapping = auth?.bootstrapping ?? false;

  const avatarInputRef = useRef(null);

  const [form, setForm] = useState(() => loadProfileSettings());
  const [baseline, setBaseline] = useState(() => loadProfileSettings());
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingMe, setLoadingMe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl && avatarPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (auth?.user) {
      const f = userToProfileForm(auth.user);
      setForm(f);
      setBaseline({ ...f });
      saveProfileSettings(f);
      setPendingAvatarFile(null);
      setAvatarPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      return;
    }

    if (auth && authBootstrapping) {
      return;
    }

    if (!token) {
      const local = loadProfileSettings();
      setForm(local);
      setBaseline({ ...local });
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingMe(true);
      setErrorMsg("");
      try {
        const data = await meRequest(token);
        if (cancelled) {
          return;
        }
        const f = userToProfileForm(data.user);
        setForm(f);
        setBaseline({ ...f });
        saveProfileSettings(f);
        setPendingAvatarFile(null);
        setAvatarPreviewUrl((prev) => {
          if (prev && prev.startsWith("blob:")) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load your profile.";
          setErrorMsg(`${msg} Showing data saved in this browser, if any.`);
          const local = loadProfileSettings();
          setForm(local);
          setBaseline({ ...local });
        }
      } finally {
        if (!cancelled) {
          setLoadingMe(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, auth?.user, auth?.user?.id, auth?.user?.email, authBootstrapping, token]);

  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearLocalAvatarPreview = useCallback(() => {
    setAvatarPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setPendingAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }, []);

  const handleCancel = useCallback(() => {
    setSavedMsg("");
    setErrorMsg("");
    clearLocalAvatarPreview();
    const b = { ...baseline };
    setForm(b);
  }, [baseline, clearLocalAvatarPreview]);

  const handleAvatarChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      if (!token) {
        setErrorMsg("Sign in via TillFlow to save a profile photo.");
        e.target.value = "";
        return;
      }
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Choose an image file (JPEG, PNG, GIF, or WebP).");
        e.target.value = "";
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg("Image must be 2 MB or smaller.");
        e.target.value = "";
        return;
      }
      setErrorMsg("");
      setSavedMsg("");
      setPendingAvatarFile(file);
      setAvatarPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(file);
      });
    },
    [token]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setSavedMsg("");
      setErrorMsg("");

      const name = form.name.trim();
      const email = form.email.trim();
      if (!name) {
        setErrorMsg("Full name is required.");
        return;
      }
      if (!email) {
        setErrorMsg("Email is required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMsg("Enter a valid email address.");
        return;
      }

      const next = {
        name,
        email,
        phone: form.phone.trim(),
        address_line: form.address_line.trim(),
        location: form.location.trim(),
        avatar_url: form.avatar_url
      };

      if (!token) {
        saveProfileSettings(next);
        setForm(next);
        setBaseline({ ...next });
        setSavedMsg("Profile saved in this browser only. Sign in via TillFlow to sync to your account.");
        return;
      }

      setSaving(true);
      try {
        const body = {
          name: next.name,
          email: next.email,
          phone: next.phone || null,
          address_line: next.address_line || null,
          location: next.location || null
        };
        const data =
          pendingAvatarFile instanceof File
            ? await updateProfileWithAvatarRequest(token, body, pendingAvatarFile)
            : await updateProfileRequest(token, body);
        const serverUser = data?.user;
        const f = userToProfileForm(serverUser || { ...next });
        const hadNewAvatar = pendingAvatarFile instanceof File;
        saveProfileSettings(f);
        setForm(f);
        setBaseline({ ...f });
        clearLocalAvatarPreview();
        setSavedMsg(hadNewAvatar ? "Profile and photo saved." : "Profile saved.");
        await refreshUser?.();
      } catch (err) {
        if (err instanceof TillFlowApiError && err.status === 422 && err.data && typeof err.data === "object") {
          const errors = err.data.errors;
          const msgs = [];
          if (errors && typeof errors === "object") {
            for (const v of Object.values(errors)) {
              if (Array.isArray(v)) {
                msgs.push(...v.map(String));
              }
            }
          }
          setErrorMsg(msgs.length ? msgs.join(" ") : err.message);
        } else {
          setErrorMsg(err instanceof Error ? err.message : "Could not save profile. Try again.");
        }
      } finally {
        setSaving(false);
      }
    },
    [form, token, refreshUser, pendingAvatarFile, clearLocalAvatarPreview]
  );

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

  const displayAvatarSrc = avatarPreviewUrl || form.avatar_url || null;

  return (
    <>
      <div className="page-wrapper">
        <div className="content settings-content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4 className="fw-bold">Settings</h4>
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
                    <h4 className="fs-18 fw-bold mb-0">Profile</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    {loadingMe ? (
                      <p className="text-muted mb-3">Loading profile…</p>
                    ) : null}
                    {savedMsg ? <div className="alert alert-success py-2 mb-3">{savedMsg}</div> : null}
                    {errorMsg ? <div className="alert alert-danger py-2 mb-3">{errorMsg}</div> : null}
                    <form onSubmit={handleSubmit}>
                      <div className="card-title-head">
                        <h6 className="fs-16 fw-bold mb-3">
                          <span className="fs-16 me-2">
                            <i className="ti ti-user" />
                          </span>
                          Basic Information
                        </h6>
                      </div>
                      <div className="profile-pic-upload d-flex flex-wrap align-items-start gap-3">
                        <div
                          className="profile-pic flex-shrink-0 position-relative overflow-hidden"
                          style={{
                            width: 96,
                            height: 96,
                            borderRadius: 8,
                            background: "#f4f6f8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                          {displayAvatarSrc ? (
                            <img
                              src={displayAvatarSrc}
                              alt=""
                              className="w-100 h-100"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <span className="text-muted text-center px-1">
                              <i className="ti ti-user-plus mb-1 fs-20 d-block" />
                              <span className="fs-12">No photo</span>
                            </span>
                          )}
                        </div>
                        <div className="new-employee-field flex-grow-1" style={{ minWidth: 200 }}>
                          <div className="mb-0">
                            <label className="form-label">Profile photo</label>
                            <input
                              ref={avatarInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              className="form-control"
                              disabled={!token || saving || loadingMe}
                              onChange={handleAvatarChange}
                            />
                            <span className="fs-13 fw-medium mt-2 d-block text-muted">
                              JPEG, PNG, GIF, or WebP · max 2 MB. {token ? "Saves with Save changes." : "Sign in to upload."}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="row mb-3 mt-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Full name <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              autoComplete="name"
                              value={form.name}
                              onChange={(ev) => updateField("name", ev.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Email <span className="text-danger">*</span>
                            </label>
                            <input
                              type="email"
                              className="form-control"
                              autoComplete="email"
                              value={form.email}
                              onChange={(ev) => updateField("email", ev.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Phone number</label>
                            <input
                              type="tel"
                              className="form-control"
                              autoComplete="tel"
                              value={form.phone}
                              onChange={(ev) => updateField("phone", ev.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="card-title-head">
                        <h6 className="fs-16 fw-bold mb-3">
                          <span className="fs-16 me-2">
                            <i className="ti ti-map-pin" />
                          </span>
                          Address and location
                        </h6>
                      </div>
                      <div className="row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Address</label>
                            <input
                              type="text"
                              className="form-control"
                              autoComplete="street-address"
                              value={form.address_line}
                              onChange={(ev) => updateField("address_line", ev.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Location</label>
                            <input
                              type="text"
                              className="form-control"
                              autoComplete="off"
                              placeholder="e.g. neighborhood, town, or area"
                              value={form.location}
                              onChange={(ev) => updateField("location", ev.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-end settings-bottom-btn mt-0">
                        <button
                          type="button"
                          className="btn btn-secondary me-2"
                          onClick={handleCancel}
                          disabled={saving}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving || loadingMe}>
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

export default GeneralSettings;
