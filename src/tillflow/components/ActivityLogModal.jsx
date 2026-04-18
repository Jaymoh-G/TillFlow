import { useCallback, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { listActivityLogsRequest } from "../api/activityLogs";
import { TillFlowApiError } from "../api/errors";

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

/**
 * @param {object} props
 * @param {boolean} props.show
 * @param {() => void} props.onHide
 * @param {string|null|undefined} props.token
 * @param {boolean} props.canView
 * @param {number|null|undefined} props.invoiceId
 * @param {string} [props.title]
 */
export default function ActivityLogModal({ show, onHide, token, canView, invoiceId, title = "Activity log" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !canView || !invoiceId) {
      setRows([]);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await listActivityLogsRequest(token, { invoice_id: invoiceId, per_page: 20, page: 1 });
      const payload = data && typeof data === "object" && "data" in data && data.data != null ? data.data : data;
      const logs = payload?.activity_logs ?? data?.activity_logs;
      setRows(Array.isArray(logs) ? logs : []);
    } catch (e) {
      setRows([]);
      if (e instanceof TillFlowApiError) {
        setError(e.status === 403 ? `${e.message} (needs system.activity_logs.view)` : e.message);
      } else {
        setError("Failed to load activity log.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, canView, invoiceId]);

  useEffect(() => {
    if (show && invoiceId) {
      void load();
    }
  }, [show, invoiceId, load]);

  const bodyNoPermission = !canView ? (
    <p className="text-muted small mb-0">
      You do not have permission to view activity logs. Ask an administrator to grant{" "}
      <code className="small">system.activity_logs.view</code>.
    </p>
  ) : null;

  const bodyNoInvoice = canView && !invoiceId ? (
    <p className="text-muted small mb-0">No invoice is selected.</p>
  ) : null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {bodyNoPermission}
        {bodyNoInvoice}
        {canView && invoiceId ? (
          <>
            {error ? <div className="alert alert-warning py-2 small mb-2">{error}</div> : null}
            {loading ? <p className="text-muted small mb-0">Loading…</p> : null}
            {!loading && !error && rows.length === 0 ? (
              <p className="text-muted small mb-0">
                No activity recorded for this invoice yet. Actions such as creating or editing the invoice, recording
                payments, sending to the customer, or cancelling will appear here after they happen.
              </p>
            ) : null}
            {!loading && rows.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Subject</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="text-nowrap small">{formatWhen(r.created_at)}</td>
                        <td className="small">{r.user?.name ?? "—"}</td>
                        <td className="small text-break">{r.action}</td>
                        <td className="small">
                          {subjectTypeLabel(r.subject_type)}
                          {r.subject_id != null ? ` #${r.subject_id}` : ""}
                        </td>
                        <td className="small text-break">{summarizeProperties(r.properties)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="text-muted small mt-2 mb-0">Showing up to 20 most recent entries.</p>
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-primary" onClick={onHide}>
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}
