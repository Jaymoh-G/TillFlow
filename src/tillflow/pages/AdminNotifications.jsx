import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TableTopHead from "../../components/table-top-head";
import { listActivityLogsRequest } from "../api/activityLogs";
import { TillFlowApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { PERMISSION } from "../auth/permissions";
import { advanceNotificationsLastSeen } from "../utils/notificationSeenStorage";
import {
  formatRelativeTime,
  mapActivityLogToNotificationItem,
  parseActivityLogsResponse
} from "../utils/activityLogNotificationMap";

const PER_PAGE = 20;

export default function AdminNotifications() {
  const { token, user, hasPermission } = useAuth();
  const userId = user?.id ?? null;
  const canView = hasPermission(PERMISSION.ACTIVITY_LOGS_VIEW);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const load = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      setRows([]);
      setMeta(null);
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const raw = await listActivityLogsRequest(token, { per_page: PER_PAGE, page });
      const { logs, meta: m } = parseActivityLogsResponse(raw);
      setRows(Array.isArray(logs) ? logs : []);
      setMeta(m);
    } catch (e) {
      setRows([]);
      setMeta(null);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs system.activity_logs.view)` : e.message);
      } else {
        setListError("Failed to load notifications.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, canView, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canView || userId == null || loading || listError) {
      return;
    }
    advanceNotificationsLastSeen(userId, rows);
  }, [canView, userId, loading, listError, rows]);

  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? rows.length;

  const cards = useMemo(
    () =>
      rows.map((log) => {
        const { title, detail, to } = mapActivityLogToNotificationItem(log);
        const when = formatRelativeTime(log.created_at);
        return (
          <div key={log.id} className="card mb-3 border shadow-sm">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between gap-2 flex-wrap">
                <div>
                  <h6 className="mb-1">{title}</h6>
                  <p className="text-muted small mb-2">{detail}</p>
                  <p className="text-muted small mb-0">{when}</p>
                </div>
                {to ? (
                  <Link to={to} className="btn btn-sm btn-outline-primary align-self-start">
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        );
      }),
    [rows]
  );

  if (!canView) {
    return (
      <div className="page-wrapper p-4">
        <p className="text-muted mb-0">
          You do not have permission to view notifications. Ask an admin to grant <code>system.activity_logs.view</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>Notifications</h4>
            <h6>Recent activity in your organization</h6>
          </div>
        </div>
        <TableTopHead onRefresh={() => void load()} />
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}

      <p className="text-muted small mb-3">
        For a detailed table view, see{" "}
        <Link to="/tillflow/admin/activity-logs">Activity log</Link>.
      </p>

      {loading ? (
        <div className="text-muted py-4">Loading…</div>
      ) : (
        <>
          {cards}
          {rows.length === 0 && !listError ? <p className="text-muted">No activity yet.</p> : null}
          {lastPage > 1 ? (
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
              <span className="text-muted small">
                Page {page} of {lastPage}
                {total != null ? ` · ${total} total` : ""}
              </span>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
