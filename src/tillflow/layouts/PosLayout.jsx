import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "../tenantUiSettings/events";
import { loadCompanyLogoSettings } from "../../utils/companySettingsStorage";
import {
  avator1,
  clockIcon,
  logoPng,
  logoSmallPng,
  logoWhitePng,
  logOut
} from "../../utils/imagepath";
import { resolveMediaUrl } from "../utils/resolveMediaUrl";

function formatClock(d) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function formatDateLabel(d) {
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}

export default function PosLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [companyLogos, setCompanyLogos] = useState(() => loadCompanyLogoSettings());
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const primaryLogoSrc = companyLogos.logo || logoPng;
  const darkBgLogoSrc = companyLogos.darkLogo || companyLogos.logo || logoWhitePng;
  const smallLogoSrc = companyLogos.icon || companyLogos.logo || logoSmallPng;

  const displayName = user?.name?.trim() || user?.email?.trim() || "User";
  const profileAvatarSrc = resolveMediaUrl(user?.avatar_url) ?? avator1;
  const roleLabel =
    typeof user?.role === "string" && user.role.trim()
      ? user.role.trim()
      : typeof user?.role_label === "string" && user.role_label.trim()
        ? user.role_label.trim()
        : "Account";

  useEffect(() => {
    const refreshLogos = () => setCompanyLogos(loadCompanyLogoSettings());
    refreshLogos();
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, refreshLogos);
    window.addEventListener("focus", refreshLogos);
    return () => {
      window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, refreshLogos);
      window.removeEventListener("focus", refreshLogos);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/tillflow/login", { replace: true });
  }, [logout, navigate]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async (e) => {
    e.preventDefault();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openLatestReceipt = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("tillflow:open-latest-receipt"));
  }, []);

  const openAddCustomer = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("tillflow:open-add-customer"));
  }, []);

  return (
    <div className="main-wrapper pos-three tf-pos-shell">
      <div className="header pos-header">
        <div className="header-left active">
          <Link to="/tillflow/admin" className="logo logo-normal">
            <img src={primaryLogoSrc} alt="" />
          </Link>
          <Link to="/tillflow/admin" className="logo logo-white">
            <img src={darkBgLogoSrc} alt="" />
          </Link>
          <Link to="/tillflow/admin" className="logo-small">
            <img src={smallLogoSrc} alt="" />
          </Link>
          <div className="d-none d-md-flex align-items-center ms-2">
            <span className="fw-semibold text-dark">
              Logged in, {displayName} | {formatDateLabel(now)}
            </span>
          </div>
        </div>

        <Link id="mobile_btn" className="mobile_btn d-none" to="#sidebar">
          <span className="bar-icon">
            <span />
            <span />
            <span />
          </span>
        </Link>

        <ul className="nav user-menu">
          <li className="nav-item time-nav">
            <span className="d-inline-flex align-items-center text-dark fw-semibold">
              <img src={clockIcon} alt="" className="me-2" aria-hidden />
              <time dateTime={now.toISOString()}>{formatClock(now)}</time>
            </span>
          </li>
          <li className="nav-item pos-nav">
            <Link to="/tillflow/admin" className="btn btn-purple btn-md d-inline-flex align-items-center">
              <i className="ti ti-layout-dashboard me-1" aria-hidden />
              Dashboard
            </Link>
          </li>
          <li className="nav-item pos-nav">
            <button
              type="button"
              className="btn btn-outline-primary btn-md d-inline-flex align-items-center"
              onClick={openAddCustomer}>
              <i className="ti ti-user-plus me-1" />
              Add Customer
            </button>
          </li>

          <li className="nav-item nav-item-box">
            <Link to="#" id="btnFullscreen" onClick={toggleFullscreen} className={isFullscreen ? "Exit Fullscreen" : "Go Fullscreen"}>
              <i className="ti ti-maximize" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link
              to="#"
              title="Cash register summary"
              aria-label="Cash register summary"
              data-bs-toggle="modal"
              data-bs-target="#cash-register">
              <i className="ti ti-cash" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" onClick={openLatestReceipt}>
              <i className="ti ti-printer" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link
              to="#"
              title="Today's sale summary"
              aria-label="Today's sale summary"
              data-bs-toggle="modal"
              data-bs-target="#today-sale">
              <i className="ti ti-progress" />
            </Link>
          </li>
          <li className="nav-item dropdown has-arrow main-drop profile-nav">
            <Link to="#" className="nav-link userset" data-bs-toggle="dropdown" title={user?.email ?? ""}>
              <span className="user-info p-0">
                <span className="user-letter">
                  <img
                    src={user?.avatar_url || avator1}
                    alt=""
                    className="img-fluid"
                  />
                </span>
              </span>
            </Link>
            <div className="dropdown-menu menu-drop-user">
              <div className="profilename">
                <div className="profileset">
                  <span className="user-img">
                    <img src={profileAvatarSrc} alt="" />
                    <span className="status online" />
                  </span>
                  <div className="profilesets">
                    <h6>{displayName}</h6>
                    <h5>{roleLabel}</h5>
                  </div>
                </div>
                <hr className="m-0" />
                <Link className="dropdown-item" to="/tillflow/admin/settings/profile">
                  <i className="ti ti-user me-2" />
                  My Profile
                </Link>
                <Link className="dropdown-item" to="/tillflow/admin/settings/system">
                  <i className="ti ti-settings me-2" />
                  Settings
                </Link>
                <hr className="m-0" />
                <Link
                  className="dropdown-item logout pb-0"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleLogout();
                  }}>
                  <img src={logOut} className="me-2" alt="" />
                  Logout
                </Link>
              </div>
            </div>
          </li>
        </ul>

        <div className="dropdown mobile-user-menu">
          <Link to="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <i className="fa fa-ellipsis-v" />
          </Link>
          <div className="dropdown-menu dropdown-menu-right">
            <Link className="dropdown-item" to="/tillflow/admin/settings/profile">My Profile</Link>
            <Link className="dropdown-item" to="/tillflow/admin/settings/system">Settings</Link>
            <Link
              className="dropdown-item"
              to="#"
              onClick={(e) => {
                e.preventDefault();
                void handleLogout();
              }}>
              Logout
            </Link>
          </div>
        </div>
      </div>

      <div className="page-wrapper pos-pg-wrapper ms-0">
        <div className="content pos-design p-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
