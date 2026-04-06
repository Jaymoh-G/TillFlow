import { Link } from "react-router-dom";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import SettingsSideBar from "../settingssidebar";
import { all_routes } from "../../../routes/all_routes";

const ConnectedApps = () => {
  const routes = all_routes;

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

  const securityPath = showTillflowBackLink ? routes.tillflowAdminSecurity : routes.securitysettings;

  return (
    <>
      <div className="page-wrapper settings-connected-apps-page">
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
                    <h4 className="fs-18 fw-bold mb-0">Connected apps</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    <p className="fs-14 text-muted mb-4">
                      TillFlow does not use third-party OAuth connections (Calendar, Slack, etc.) in this version.
                      Access to the API is via your account sign-in and personal API tokens.
                    </p>

                    <div className="border rounded p-3 mb-3 bg-light">
                      <div className="d-flex align-items-start gap-3">
                        <span className="security-settings-page__icon security-settings-page__icon--lg flex-shrink-0">
                          <i className="feather icon-link" aria-hidden />
                        </span>
                        <div>
                          <h5 className="fs-16 fw-medium mb-1">API &amp; sign-ins</h5>
                          <p className="fs-14 text-muted mb-3 mb-md-0">
                            Each login creates a token (shown as a device or client name). You can review and revoke
                            sessions under Security.
                          </p>
                          <Link to={securityPath} className="btn btn-primary btn-sm">
                            Open security settings
                          </Link>
                        </div>
                      </div>
                    </div>

                    <p className="fs-13 text-muted mb-0">
                      Future releases may add integrations (accounting, messaging, identity). Those will appear here when
                      available.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConnectedApps;
