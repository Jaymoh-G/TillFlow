import { useCallback, useEffect, useMemo, useState } from "react";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import { listActivityLogsRequest } from "../api/activityLogs";
import { TillFlowApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { PERMISSION } from "../auth/permissions";
import { parseActivityLogsResponse } from "../utils/activityLogNotificationMap";

function subjectTypeLabel(subjectType) {
  if (!subjectType || typeof subjectType !== "string") {
    return "—";
  }
  if (subjectType.endsWith("\\InvoicePayment") || subjectType.endsWith("InvoicePayment")) {
    return "Payment";
  }
  if (subjectType.endsWith("\\Invoice") || subjectType.endsWith("Invoice")) {
    return "Invoice";
  }
  if (subjectType.endsWith("\\Customer") || subjectType.endsWith("Customer")) {
    return "Customer";
  }
  if (subjectType.endsWith("\\Quotation") || subjectType.endsWith("Quotation")) {
    return "Quotation";
  }
  if (subjectType.endsWith("\\Proposal") || subjectType.endsWith("Proposal")) {
    return "Proposal";
  }
  return subjectType.split("\\").pop() ?? subjectType;
}

function formatWhen(iso) {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summarizeProperties(props) {
  if (!props || typeof props !== "object") {
    return "";
  }
  const parts = [];
  if (props.receipt_ref) {
    parts.push(String(props.receipt_ref));
  }
  if (props.amount != null && props.amount !== "") {
    parts.push(`Ksh ${Number(props.amount).toFixed(2)}`);
  }
  if (props.payment_method) {
    parts.push(String(props.payment_method));
  }
  if (props.invoice_ref) {
    parts.push(`Inv ${props.invoice_ref}`);
  }
  if (props.quote_ref) {
    parts.push(`Quote ${props.quote_ref}`);
  }
  if (props.code && props.name) {
    parts.push(`${props.code} — ${props.name}`);
  } else if (props.name) {
    parts.push(String(props.name));
  }
  if (props.recipient_email) {
    parts.push(String(props.recipient_email));
  }
  return parts.join(" · ");
}

export default function AdminActivityLogs() {
  const { token, hasPermission } = useAuth();
  const canView = hasPermission(PERMISSION.ACTIVITY_LOGS_VIEW);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tableRows, setTableRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const load = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      setRows([]);
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const data = await listActivityLogsRequest(token, { per_page: 50, page: 1 });
      const { logs } = parseActivityLogsResponse(data);
      setRows(logs);
    } catch (e) {
      setRows([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs system.activity_logs.view)` : e.message);
      } else {
        setListError("Failed to load activity logs.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((r) => {
      const action = String(r.action ?? "").toLowerCase();
      const user = String(r.user?.name ?? "").toLowerCase();
      const detail = summarizeProperties(r.properties).toLowerCase();
      const subj = `${subjectTypeLabel(r.subject_type)} ${r.subject_id ?? ""}`.toLowerCase();
      return (
        action.includes(q) ||
        user.includes(q) ||
        detail.includes(q) ||
        subj.includes(q)
      );
    });
  }, [rows, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tableRows]);

  const columns = useMemo(
    () => [
      {
        header: "When",
        field: "created_at",
        body: (r) => <span className="small text-muted">{formatWhen(r.created_at)}</span>
      },
      {
        header: "User",
        field: "user.name",
        body: (r) => r.user?.name ?? "—"
      },
      {
        header: "Action",
        field: "action",
        body: (r) => <span className="small text-break">{r.action}</span>
      },
      {
        header: "Subject",
        field: "subject",
        body: (r) => (
          <span className="small">
            {subjectTypeLabel(r.subject_type)}
            {r.subject_id != null ? ` #${r.subject_id}` : ""}
          </span>
        )
      },
      {
        header: "Detail",
        field: "detail",
        body: (r) => <span className="small text-break">{summarizeProperties(r.properties) || "—"}</span>
      }
    ],
    []
  );

  if (!canView) {
    return (
      <div className="page-wrapper p-4">
        <p className="text-muted mb-0">You do not have permission to view activity logs.</p>
      </div>
    );
  }

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>Activity log</h4>
            <h6>Recent actions in your organization</h6>
          </div>
        </div>
        <TableTopHead onRefresh={() => void load()} />
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}

      <div className="card table-list-card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
          <div className="search-set">
            <div className="search-input">
              <span className="btn-searchset">
                <i className="feather icon-search" />
              </span>
              <div className="dataTables_filter">
                <label className="mb-0">
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search activity log"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          <PrimeDataTable
            column={columns}
            data={filtered}
            rows={tableRows}
            setRows={setTableRows}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalRecords={filtered.length}
            loading={loading}
            isPaginationEnabled
          />
        </div>
      </div>
    </div>
  );
}
