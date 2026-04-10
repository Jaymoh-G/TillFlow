import { useCallback, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import {
  avator1,
  clockIcon,
  logoPng,
  logoSmallPng,
  logoWhitePng,
  logOut,
  store_01,
  store_02,
  store_03,
  store_04
} from "../../utils/imagepath";

function formatClock(d) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export default function PosLayout() {
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  return (
    <div className="main-wrapper pos-three tf-pos-shell">
      <div className="header pos-header">
        <div className="header-left active">
          <Link to="/tillflow/admin" className="logo logo-normal">
            <img src={logoPng} alt="Img" />
          </Link>
          <Link to="/tillflow/admin" className="logo logo-white">
            <img src={logoWhitePng} alt="Img" />
          </Link>
          <Link to="/tillflow/admin" className="logo-small">
            <img src={logoSmallPng} alt="Img" />
          </Link>
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
            <span className="bg-teal text-white d-inline-flex align-items-center">
              <img src={clockIcon} alt="img" className="me-2" />
              {formatClock(now)}
            </span>
          </li>
          <li className="nav-item pos-nav">
            <Link to="/tillflow/admin" className="btn btn-purple btn-md d-inline-flex align-items-center">
              <i className="ti ti-world me-1" />
              Dashboard
            </Link>
          </li>

          <li className="nav-item dropdown has-arrow main-drop select-store-dropdown">
            <Link to="#" className="dropdown-toggle nav-link select-store" data-bs-toggle="dropdown">
              <span className="user-info">
                <span className="user-letter">
                  <img src={store_01} alt="Store Logo" className="img-fluid" />
                </span>
                <span className="user-detail">
                  <span className="user-name">Freshmart</span>
                </span>
              </span>
            </Link>
            <div className="dropdown-menu dropdown-menu-right">
              <Link to="#" className="dropdown-item"><img src={store_01} alt="Store Logo" className="img-fluid" />Freshmart</Link>
              <Link to="#" className="dropdown-item"><img src={store_02} alt="Store Logo" className="img-fluid" />Grocery Apex</Link>
              <Link to="#" className="dropdown-item"><img src={store_03} alt="Store Logo" className="img-fluid" />Grocery Bevy</Link>
              <Link to="#" className="dropdown-item"><img src={store_04} alt="Store Logo" className="img-fluid" />Grocery Eden</Link>
            </div>
          </li>

          <li className="nav-item nav-item-box">
            <Link to="#" data-bs-toggle="modal" data-bs-target="#calculator" className="bg-orange border-orange text-white">
              <i className="ti ti-calculator" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" id="btnFullscreen" onClick={toggleFullscreen} className={isFullscreen ? "Exit Fullscreen" : "Go Fullscreen"}>
              <i className="ti ti-maximize" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" data-bs-toggle="modal" data-bs-target="#cash-register">
              <i className="ti ti-cash" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" data-bs-toggle="modal" data-bs-target="#print-receipt">
              <i className="ti ti-printer" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" data-bs-toggle="modal" data-bs-target="#today-sale">
              <i className="ti ti-progress" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="#" data-bs-toggle="modal" data-bs-target="#today-profit">
              <i className="ti ti-chart-infographic" />
            </Link>
          </li>
          <li className="nav-item nav-item-box">
            <Link to="/tillflow/admin/settings/pos">
              <i className="ti ti-settings" />
            </Link>
          </li>

          <li className="nav-item dropdown has-arrow main-drop profile-nav">
            <Link to="#" className="nav-link userset" data-bs-toggle="dropdown">
              <span className="user-info p-0">
                <span className="user-letter">
                  <img src={avator1} alt="Img" className="img-fluid" />
                </span>
              </span>
            </Link>
            <div className="dropdown-menu menu-drop-user">
              <div className="profilename">
                <div className="profileset">
                  <span className="user-img">
                    <img src={avator1} alt="Img" />
                    <span className="status online" />
                  </span>
                  <div className="profilesets">
                    <h6>John Smilga</h6>
                    <h5>Super Admin</h5>
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
                <Link className="dropdown-item logout pb-0" to="/tillflow/login">
                  <img src={logOut} className="me-2" alt="img" />
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
            <Link className="dropdown-item" to="/tillflow/login">Logout</Link>
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
