import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listActivityLogsRequest } from "../api/activityLogs";
import { TillFlowApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { PERMISSION } from "../auth/permissions";
import {
  advanceNotificationsLastSeen,
  countUnreadNotificationLogs
} from "../utils/notificationSeenStorage";
import {
  formatRelativeTime,
  mapActivityLogToNotificationItem,
  parseActivityLogsResponse
} from "../utils/activityLogNotificationMap";

const PREVIEW_LIMIT = 8;

export default function TillflowNotificationMenu({ className = "" }) {
  const { token, user, hasPermission } = useAuth();
  const userId = user?.id ?? null;
  const canView = hasPermission(PERMISSION.ACTIVITY_LOGS_VIEW);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [seenRev, setSeenRev] = useState(0);
  const toggleRef = useRef(null);

  const unreadCount = useMemo(
    () => countUnreadNotificationLogs(items, userId),
    [items, userId, seenRev]
  );

  const load = useCallback(async () => {
    if (!token || !canView) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const raw = await listActivityLogsRequest(token, { per_page: PREVIEW_LIMIT, page: 1 });
      const { logs } = parseActivityLogsResponse(raw);
      setItems(Array.isArray(logs) ? logs : []);
    } catch (e) {
      setItems([]);
      if (e instanceof TillFlowApiError) {
        setError(e.status === 403 ? "No access to activity feed." : e.message);
      } else {
        setError("Could not load notifications.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, canView]);

  useEffect(() => {
    if (!canView) {
      return undefined;
    }
    void load();
    return undefined;
  }, [canView, load]);

  useEffect(() => {
    const bump = () => setSeenRev((r) => r + 1);
    window.addEventListener("tillflow-notifications-seen", bump);
    return () => window.removeEventListener("tillflow-notifications-seen", bump);
  }, []);

  useEffect(() => {
    const el = toggleRef.current;
    if (!el || !canView) {
      return undefined;
    }
    const onShown = () => {
      advanceNotificationsLastSeen(userId, items);
      setSeenRev((r) => r + 1);
    };
    el.addEventListener("shown.bs.dropdown", onShown);
    return () => el.removeEventListener("shown.bs.dropdown", onShown);
  }, [canView, userId, items]);

  if (!canView) {
    return null;
  }

  return (
    <div className={`dropdown nav-item-box tf-notif-menu ${className}`.trim()}>
      <button
        ref={toggleRef}
        type="button"
        className="dropdown-toggle nav-link tf-notif-menu__toggle border-0 bg-transparent p-0"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="Notifications">
        <i className="ti ti-bell" aria-hidden />
        {unreadCount > 0 ? (
          <span className="tf-notif-menu__badge rounded-pill">{Math.min(unreadCount, 9)}</span>
        ) : null}
      </button>
      <div className="dropdown-menu dropdown-menu-end notifications tf-notif-menu__panel">
        <div className="topnav-dropdown-header d-flex align-items-center justify-content-between gap-2">
          <h5 className="notification-title mb-0">Notifications</h5>
          <Link to="/admin/notifications" className="clear-noti text-primary small">
            View all
          </Link>
        </div>
        <div className="noti-content">
          {loading ? (
            <div className="p-3 text-muted small">Loading…</div>
          ) : error ? (
            <div className="p-3 text-danger small">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-muted small">No recent activity.</div>
          ) : (
            <ul className="notification-list mb-0 list-unstyled">
              {items.map((log) => {
                const { title, detail, to } = mapActivityLogToNotificationItem(log);
                const when = formatRelativeTime(log.created_at);
                const inner = (
                  <div className="media d-flex py-2 px-3 border-bottom">
                    <div className="flex-grow-1">
                      <p className="noti-details mb-1">
                        <span className="noti-title">{title}</span> {detail}
                      </p>
                      <p className="noti-time text-muted mb-0 small">{when}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={log.id} className="notification-message">
                    {to ? (
                      <Link to={to} className="text-decoration-none text-body">
                        {inner}
                      </Link>
                    ) : (
                      <div className="text-body">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
