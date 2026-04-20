import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SettingsSideBar from "../settingssidebar";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import { useOptionalAuth } from "../../../tillflow/auth/AuthContext";
import {
  defaultNotificationPreferences,
  loadNotificationPreferences,
  NOTIFICATION_TOPIC_ROWS,
  saveNotificationPreferences
} from "../../../utils/notificationPreferencesStorage";
import { TILLFLOW_TENANT_UI_SETTINGS_HYDRATED } from "../../../tillflow/tenantUiSettings/events";

const Notification = () => {
  const auth = useOptionalAuth();
  const userId = auth?.user?.id ?? null;

  const [prefs, prefsDispatch] = useState(() => loadNotificationPreferences(userId));
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    prefsDispatch(loadNotificationPreferences(userId));
  }, [userId]);

  useEffect(() => {
    const onHydrated = () => prefsDispatch(loadNotificationPreferences(userId));
    window.addEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
    return () => window.removeEventListener(TILLFLOW_TENANT_UI_SETTINGS_HYDRATED, onHydrated);
  }, [userId]);

  const persist = useCallback(
    (next) => {
      prefsDispatch(next);
      saveNotificationPreferences(userId, next);
      setSavedMsg("Preferences saved on this device.");
      window.setTimeout(() => setSavedMsg(""), 2500);
    },
    [userId]
  );

  const setChannel = (key, value) => {
    persist({ ...prefs, [key]: value });
  };

  /** @param {string} topicId @param {'push'|'sms'|'email'} field */
  const setTopic = (topicId, field, value) => {
    const prev = prefs.topics[topicId] ?? defaultNotificationPreferences().topics[topicId];
    if (!prev) {
      return;
    }
    persist({
      ...prefs,
      topics: {
        ...prefs.topics,
        [topicId]: { ...prev, [field]: value }
      }
    });
  };

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

  return (
    <>
      <div className="page-wrapper settings-notifications-page">
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
                    <h4 className="fs-18 fw-bold mb-0">Notifications</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    <p className="fs-14 text-muted mb-3">
                      Choose how you want to be notified. Preferences are saved in this browser for each signed-in
                      account. If your role includes tenant settings access, they can also be merged into tenant
                      server settings (see the sync banner when background sync is not allowed).
                    </p>
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}

                    <h6 className="fw-medium mb-2">Channels</h6>
                    <p className="fs-13 text-muted mb-3">
                      Turn on In-app (browser) to register this device for Web Push (HTTPS or localhost). The server
                      must have VAPID keys configured; activity events may trigger push notifications when your topic
                      toggles allow it.
                    </p>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div>
                        <h6 className="fw-medium mb-0">In-app (browser)</h6>
                        <p className="fs-13 text-muted mb-0">Alerts while you have the app open</p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="notif-channel-browser"
                          className="check"
                          checked={prefs.channelBrowser}
                          onChange={(e) => setChannel("channelBrowser", e.target.checked)}
                        />
                        <label htmlFor="notif-channel-browser" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div>
                        <h6 className="fw-medium mb-0">Email</h6>
                        <p className="fs-13 text-muted mb-0">Uses the address on your profile</p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="notif-channel-email"
                          className="check"
                          checked={prefs.channelEmail}
                          onChange={(e) => setChannel("channelEmail", e.target.checked)}
                        />
                        <label htmlFor="notif-channel-email" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div>
                        <h6 className="fw-medium mb-0">SMS</h6>
                        <p className="fs-13 text-muted mb-0">Requires SMS gateway configuration</p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="notif-channel-sms"
                          className="check"
                          checked={prefs.channelSms}
                          onChange={(e) => setChannel("channelSms", e.target.checked)}
                        />
                        <label htmlFor="notif-channel-sms" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>

                    <h6 className="fw-medium mb-2">By topic</h6>
                    <p className="fs-13 text-muted mb-3">Toggle delivery methods for each type of activity.</p>
                    <div className="table-responsive notification-table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>In-app</th>
                            <th>SMS</th>
                            <th>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {NOTIFICATION_TOPIC_ROWS.map((row) => {
                            const t = prefs.topics[row.id];
                            if (!t) {
                              return null;
                            }
                            return (
                              <tr key={row.id}>
                                <td>{row.label}</td>
                                <td>
                                  <div className="status-toggle modal-status">
                                    <input
                                      type="checkbox"
                                      id={`notif-${row.id}-push`}
                                      className="check"
                                      checked={t.push}
                                      onChange={(e) => setTopic(row.id, "push", e.target.checked)}
                                    />
                                    <label htmlFor={`notif-${row.id}-push`} className="checktoggle" />
                                  </div>
                                </td>
                                <td>
                                  <div className="status-toggle modal-status">
                                    <input
                                      type="checkbox"
                                      id={`notif-${row.id}-sms`}
                                      className="check"
                                      checked={t.sms}
                                      onChange={(e) => setTopic(row.id, "sms", e.target.checked)}
                                    />
                                    <label htmlFor={`notif-${row.id}-sms`} className="checktoggle" />
                                  </div>
                                </td>
                                <td>
                                  <div className="status-toggle modal-status">
                                    <input
                                      type="checkbox"
                                      id={`notif-${row.id}-email`}
                                      className="check"
                                      checked={t.email}
                                      onChange={(e) => setTopic(row.id, "email", e.target.checked)}
                                    />
                                    <label htmlFor={`notif-${row.id}-email`} className="checktoggle" />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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

export default Notification;
