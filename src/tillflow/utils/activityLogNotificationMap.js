/**
 * Maps activity log API rows to notification-style items (labels, links).
 * Align with backend {@link App\Support\ActivityLogProperties} and morph classes.
 */

/** @param {unknown} subjectType */
function morphName(subjectType) {
  if (typeof subjectType !== "string" || !subjectType) {
    return "";
  }
  const parts = subjectType.split("\\");
  return parts[parts.length - 1] ?? subjectType;
}

/**
 * @param {unknown} iso
 * @returns {string}
 */
export function formatRelativeTime(iso) {
  if (!iso) {
    return "";
  }
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) {
    return "Just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  if (day < 7) {
    return `${day}d ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * @param {unknown} data
 * @returns {{ logs: object[], meta: object|null }}
 */
export function parseActivityLogsResponse(data) {
  if (!data || typeof data !== "object") {
    return { logs: [], meta: null };
  }
  const inner = "data" in data && data.data != null && typeof data.data === "object" ? data.data : data;
  const logs = Array.isArray(inner.activity_logs) ? inner.activity_logs : [];
  const meta = inner.meta && typeof inner.meta === "object" ? inner.meta : null;
  return { logs, meta };
}

/**
 * @param {Record<string, unknown>} props
 * @returns {string}
 */
function summarizeProps(props) {
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
  if (props.customer_name) {
    parts.push(String(props.customer_name));
  }
  return parts.join(" · ");
}

/**
 * @param {object} log
 * @returns {{ title: string, detail: string, to: string|null }}
 */
export function mapActivityLogToNotificationItem(log) {
  const action = String(log.action ?? "");
  const props = log.properties && typeof log.properties === "object" ? /** @type {Record<string, unknown>} */ (log.properties) : {};
  const subjectType = morphName(log.subject_type);
  const subjectId = log.subject_id != null ? Number(log.subject_id) : null;
  const actor = log.user && typeof log.user === "object" ? String(log.user.name ?? "").trim() : "";

  /** @type {string|null} */
  let to = null;
  let title = action || "Activity";
  let detail = summarizeProps(props);

  const invoiceId = props.invoice_id != null ? Number(props.invoice_id) : null;
  const quotationId = props.quotation_id != null ? Number(props.quotation_id) : null;
  const proposalId = props.proposal_id != null ? Number(props.proposal_id) : null;
  const paymentId = props.payment_id != null ? Number(props.payment_id) : null;

  if (action.startsWith("invoice_payment.")) {
    title = "Invoice payment";
    const pid = paymentId ?? subjectId;
    if (pid != null && !Number.isNaN(pid)) {
      to = `/admin/invoice-payments/${pid}`;
    }
  } else if (action === "invoice.customer_viewed") {
    title = "Invoice viewed by customer";
    const iid = invoiceId ?? (subjectType === "Invoice" ? subjectId : null);
    if (iid != null && !Number.isNaN(iid)) {
      to = `/admin/invoices/${iid}`;
    }
  } else if (action.startsWith("invoice.")) {
    title = "Invoice";
    const iid = invoiceId ?? (subjectType === "Invoice" ? subjectId : null);
    if (iid != null && !Number.isNaN(iid)) {
      to = `/admin/invoices/${iid}`;
    }
  } else if (action === "quotation.customer_viewed") {
    title = "Quotation viewed by customer";
    const qid = quotationId ?? (subjectType === "Quotation" ? subjectId : null);
    if (qid != null && !Number.isNaN(qid)) {
      to = `/admin/quotations/${qid}`;
    }
  } else if (action.startsWith("quotation.")) {
    title = "Quotation";
    const qid = quotationId ?? (subjectType === "Quotation" ? subjectId : null);
    if (qid != null && !Number.isNaN(qid)) {
      to = `/admin/quotations/${qid}`;
    }
  } else if (action === "proposal.customer_viewed") {
    title = "Proposal viewed by customer";
    const pid = proposalId ?? (subjectType === "Proposal" ? subjectId : null);
    if (pid != null && !Number.isNaN(pid)) {
      to = `/admin/proposals/${pid}`;
    }
  } else if (action.startsWith("proposal.")) {
    title = "Proposal";
    const pid = proposalId ?? (subjectType === "Proposal" ? subjectId : null);
    if (pid != null && !Number.isNaN(pid)) {
      to = `/admin/proposals/${pid}`;
    }
  } else if (action.startsWith("customer.")) {
    title = "Customer";
    to = "/admin/customers";
  }

  if (!detail) {
    detail = subjectType && subjectId != null ? `${subjectType} #${subjectId}` : "";
  }
  if (actor) {
    detail = detail ? `${detail} · ${actor}` : actor;
  }

  return { title, detail: detail || "—", to };
}
