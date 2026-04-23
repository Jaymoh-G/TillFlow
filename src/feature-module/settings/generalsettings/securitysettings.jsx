import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CommonFooter from "../../../components/footer/commonFooter";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import SettingsSideBar from "../settingssidebar";
import { useOptionalAuth } from "../../../tillflow/auth/AuthContext";
import {
  changePasswordRequest,
  listSessionsRequest,
  meRequest,
  revokeSessionRequest
} from "../../../tillflow/api/auth";
import { TillFlowApiError } from "../../../tillflow/api/errors";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";

function formatDateTime(iso) {
  if (!iso || typeof iso !== "string") {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

const SecuritySettings = () => {
  const auth = useOptionalAuth();
  const token = auth?.token ?? sessionStorage.getItem(TILLFLOW_TOKEN_KEY);
  const refreshUser = auth?.refreshUser ?? null;
  const authBootstrapping = auth?.bootstrapping ?? false;

  const passwordModalRef = useRef(null);

  const [passwordChangedAt, setPasswordChangedAt] = useState(null);
  const [loadingUserMeta, setLoadingUserMeta] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState(null);

  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  const [passwordVisibility, setPasswordVisibility] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [pwdForm, setPwdForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: ""
  });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdFieldErrors, setPwdFieldErrors] = useState({});
  const [pwdFormError, setPwdFormError] = useState("");

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const loadSessions = useCallback(async () => {
    if (!token) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const data = await listSessionsRequest(token);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load sessions.";
      setSessionsError(msg);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (auth?.user) {
      setPasswordChangedAt(auth.user.password_changed_at ?? null);
      return;
    }
    if (auth && authBootstrapping) {
      return;
    }
    if (!token) {
      setPasswordChangedAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingUserMeta(true);
      setPageError("");
      try {
        const data = await meRequest(token);
        if (!cancelled) {
          setPasswordChangedAt(data?.user?.password_changed_at ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load account details.";
          setPageError(msg);
          setPasswordChangedAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingUserMeta(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.user, authBootstrapping, token]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const collectValidationMessages = (data) => {
    const errors = data?.errors;
    const msgs = [];
    const byField = {};
    if (errors && typeof errors === "object") {
      for (const [key, v] of Object.entries(errors)) {
        if (Array.isArray(v)) {
          const list = v.map(String);
          msgs.push(...list);
          if (list.length) {
            byField[key] = list[0];
          }
        }
      }
    }
    return { msgs, byField };
  };

  const openPasswordModal = () => {
    setPwdForm({ current_password: "", password: "", password_confirmation: "" });
    setPwdFieldErrors({});
    setPwdFormError("");
    const el = passwordModalRef.current;
    if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  };

  const hidePasswordModal = () => {
    const el = passwordModalRef.current;
    if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getInstance(el)?.hide();
    }
  };

  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdFormError("");
    setPwdFieldErrors({});
    if (!token) {
      setPwdFormError("Sign in via TillFlow to change your password.");
      return;
    }
    setPwdSubmitting(true);
    try {
      const data = await changePasswordRequest(token, pwdForm);
      const next = data?.user?.password_changed_at ?? null;
      setPasswordChangedAt(next);
      await refreshUser?.();
      hidePasswordModal();
      setPageNotice("Password updated. Your other sign-ins have been signed out.");
      void loadSessions();
    } catch (err) {
      if (err instanceof TillFlowApiError && err.status === 422 && err.data && typeof err.data === "object") {
        const { msgs, byField } = collectValidationMessages(err.data);
        setPwdFieldErrors(byField);
        setPwdFormError(msgs.length ? msgs.join(" ") : err.message);
      } else {
        setPwdFormError(err instanceof Error ? err.message : "Could not update password.");
      }
    } finally {
      setPwdSubmitting(false);
    }
  };

  const onRevokeSession = async (sessionId) => {
    if (!token || !sessionId) {
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("Sign out this session?")) {
      return;
    }
    setRevokingId(sessionId);
    setPageNotice("");
    try {
      await revokeSessionRequest(token, sessionId);
      setPageError("");
      setPageNotice("Session revoked.");
      void loadSessions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not revoke session.";
      setPageError(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin/");

  const lastChangedLabel = (() => {
    if (loadingUserMeta && passwordChangedAt == null) {
      return "Loading…";
    }
    const formatted = formatDateTime(passwordChangedAt);
    return formatted ?? "Not recorded yet (updates after your first password change with TillFlow).";
  })();

  return (
    <>
      <div className="page-wrapper security-settings-page">
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
                    <h4 className="fs-18 fw-bold mb-0">Security</h4>
                    {showTillflowBackLink ? (
                      <Link to="/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    {!token ? (
                      <div className="alert alert-warning mb-3" role="status">
                        Sign in via TillFlow to change your password and manage API sessions.
                      </div>
                    ) : null}
                    {pageError ? (
                      <div className="alert alert-danger mb-3" role="alert">
                        {pageError}
                      </div>
                    ) : null}
                    {pageNotice ? (
                      <div className="alert alert-success mb-3" role="status">
                        {pageNotice}
                      </div>
                    ) : null}

                    <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2 border-bottom mb-3 pb-3">
                        <div className="d-flex align-items-center">
                        <span className="security-settings-page__icon security-settings-page__icon--lg">
                          <i className="feather icon-lock" aria-hidden />
                          </span>
                          <div>
                          <h5 className="fs-16 fw-medium mb-1">Password</h5>
                          <p className="fs-14 mb-0 text-muted">Last updated: {lastChangedLabel}</p>
                          <p className="fs-13 text-muted mb-0 mt-1">
                            After a successful change, other sign-ins are revoked.
                          </p>
                        </div>
                      </div>
                      <button type="button" className="btn btn-primary" onClick={openPasswordModal}>
                        Change password
                      </button>
                    </div>

                    <div className="d-flex align-items-start justify-content-between flex-wrap row-gap-2 border-bottom mb-3 pb-3">
                      <div className="d-flex align-items-start">
                        <span className="security-settings-page__icon security-settings-page__icon--lg">
                          <i className="feather icon-smartphone" aria-hidden />
                          </span>
                          <div>
                          <h5 className="fs-16 fw-medium mb-1">Where you&apos;re signed in</h5>
                          <p className="fs-14 text-muted mb-0">
                            Each row is a sign-in token (device name). Revoke to sign that session out.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => void loadSessions()}
                        disabled={!token || sessionsLoading}>
                        Refresh
                      </button>
                          </div>

                    {sessionsLoading && sessions.length === 0 ? (
                      <p className="text-muted">Loading sessions…</p>
                    ) : null}
                    {sessionsError && !sessionsLoading ? (
                      <p className="text-danger mb-3">{sessionsError}</p>
                    ) : null}
                    {token && !sessionsLoading && sessions.length === 0 && !sessionsError ? (
                      <p className="text-muted mb-0">No active sessions found.</p>
                    ) : null}

                    {sessions.length > 0 ? (
                      <div className="table-responsive mb-3">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Device / name</th>
                              <th>Last used</th>
                              <th>Signed in</th>
                              <th className="text-end">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessions.map((s) => (
                              <tr key={s.id}>
                                <td>
                                  {s.name || "—"}
                                  {s.is_current ? (
                                    <span className="badge bg-success ms-2">This session</span>
                                  ) : null}
                                </td>
                                <td>{formatDateTime(s.last_used_at) ?? "—"}</td>
                                <td>{formatDateTime(s.created_at) ?? "—"}</td>
                                <td className="text-end">
                                  {!s.is_current ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      disabled={revokingId === s.id}
                                      onClick={() => void onRevokeSession(s.id)}>
                                      {revokingId === s.id ? "…" : "Revoke"}
                                    </button>
                                  ) : (
                                    <span className="text-muted fs-14">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    <p className="fs-13 text-muted mb-0 border-top pt-2 mt-1">
                      Two-factor authentication, social login, and account deletion are not available in this
                      build. Use Profile to update email and phone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div ref={passwordModalRef} className="modal fade" id="change-password" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={onPasswordSubmit}>
            <div className="modal-header">
              <div className="page-title">
                <h4 className="mb-0">Change password</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {pwdFormError ? (
                <div className="alert alert-danger py-2 mb-3" role="alert">
                  {pwdFormError}
                </div>
              ) : null}
              <div className="row">
                <div className="col-lg-12">
                  <div className="input-blocks">
                    <label className="fw-medium">
                      Current password <span className="text-danger">*</span>
                    </label>
                    <div className="pass-group">
                      <input
                        type={passwordVisibility.oldPassword ? "text" : "password"}
                        className={`pass-input form-control${pwdFieldErrors.current_password ? " is-invalid" : ""}`}
                        autoComplete="current-password"
                        value={pwdForm.current_password}
                        onChange={(ev) =>
                          setPwdForm((p) => ({ ...p, current_password: ev.target.value }))
                        }
                      />
                      <span
                        className={`feather toggle-passwords text-gray-9 ${
                          passwordVisibility.oldPassword ? "icon-eye" : "icon-eye-off"
                        }`}
                        onClick={() => togglePasswordVisibility("oldPassword")}
                        role="presentation"
                      />
                    </div>
                    {pwdFieldErrors.current_password ? (
                      <div className="invalid-feedback d-block">{pwdFieldErrors.current_password}</div>
                    ) : null}
                  </div>
                </div>
                <div className="col-lg-12">
                  <div className="input-blocks">
                    <label className="fw-medium">
                      New password <span className="text-danger">*</span>
                    </label>
                    <div className="pass-group">
                      <input
                        type={passwordVisibility.newPassword ? "text" : "password"}
                        className={`pass-input form-control${pwdFieldErrors.password ? " is-invalid" : ""}`}
                        autoComplete="new-password"
                        value={pwdForm.password}
                        onChange={(ev) => setPwdForm((p) => ({ ...p, password: ev.target.value }))}
                      />
                      <span
                        className={`feather toggle-passwords text-gray-9 ${
                          passwordVisibility.newPassword ? "icon-eye" : "icon-eye-off"
                        }`}
                        onClick={() => togglePasswordVisibility("newPassword")}
                        role="presentation"
                      />
                    </div>
                    {pwdFieldErrors.password ? (
                      <div className="invalid-feedback d-block">{pwdFieldErrors.password}</div>
                    ) : null}
                  </div>
                </div>
                <div className="col-lg-12">
                  <div className="input-blocks mb-0">
                    <label className="fw-medium">
                      Confirm new password <span className="text-danger">*</span>
                    </label>
                    <div className="pass-group">
                      <input
                        type={passwordVisibility.confirmPassword ? "text" : "password"}
                        className={`pass-input form-control${
                          pwdFieldErrors.password_confirmation ? " is-invalid" : ""
                        }`}
                        autoComplete="new-password"
                        value={pwdForm.password_confirmation}
                        onChange={(ev) =>
                          setPwdForm((p) => ({ ...p, password_confirmation: ev.target.value }))
                        }
                      />
                      <span
                        className={`feather toggle-passwords text-gray-9 ${
                          passwordVisibility.confirmPassword ? "icon-eye" : "icon-eye-off"
                        }`}
                        onClick={() => togglePasswordVisibility("confirmPassword")}
                        role="presentation"
                      />
                    </div>
                    {pwdFieldErrors.password_confirmation ? (
                      <div className="invalid-feedback d-block">{pwdFieldErrors.password_confirmation}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={pwdSubmitting || !token}>
                {pwdSubmitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default SecuritySettings;
