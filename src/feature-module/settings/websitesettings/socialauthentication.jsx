import { Link } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import { all_routes } from "../../../routes/all_routes";

const SocialAuthentication = () => {
  const routes = all_routes;
  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");
  const securityPath = showTillflowBackLink ? routes.tillflowAdminSecurity : routes.securitysettings;

  return (
    <>
      <div className="page-wrapper settings-social-auth-page">
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
                    <h4 className="fs-18 fw-bold mb-0">Social authentication</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    <p className="fs-14 text-muted mb-3">
                      Sign-in with Facebook, Google, X (Twitter), or LinkedIn is <strong>not configured</strong> in
                      this TillFlow build. Accounts use email and password (and API tokens for programmatic access).
                    </p>
                    <div className="border rounded p-3 mb-3 bg-light">
                      <div className="d-flex align-items-start gap-3">
                        <span className="security-settings-page__icon security-settings-page__icon--lg flex-shrink-0">
                          <i className="feather icon-lock" aria-hidden />
                        </span>
                        <div>
                          <h5 className="fs-16 fw-medium mb-1">Password &amp; sessions</h5>
                          <p className="fs-14 text-muted mb-3 mb-md-0">
                            Change your password and revoke other devices from Security.
                          </p>
                          <Link to={securityPath} className="btn btn-primary btn-sm">
                            Open security settings
                          </Link>
                        </div>
                      </div>
                    </div>
                    <p className="fs-13 text-muted mb-0">
                      When social login is added, provider keys and redirect URLs will be managed here per tenant.
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

export default SocialAuthentication;
