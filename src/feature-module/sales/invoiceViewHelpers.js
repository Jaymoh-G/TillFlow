import { paymentMethodLabel } from "../../tillflow/api/invoicePayments";
import { getCompanySettingsSnapshot, resolveQuotationFooterFromSnapshot } from "../../utils/companySettingsStorage";
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import { stockImg01 } from "../../utils/imagepath";
import { roundMoney } from "../../utils/salesDocumentLineItems";

const INVOICE_STATUSES_EXPORT = ["Draft", "Unpaid", "Partially_paid", "Paid", "Overdue", "Cancelled"];
export { INVOICE_STATUSES_EXPORT as INVOICE_STATUSES };

export function invoiceStatusBadgeClass(st) {
  const s = String(st ?? "");
  if (s === "Paid") {
    return "badge-soft-success";
  }
  if (s === "Draft") {
    return "badge-soft-secondary";
  }
  if (s === "Cancelled") {
    return "badge-soft-dark";
  }
  if (s === "Overdue") {
    return "badge-soft-warning text-dark";
  }
  if (s === "Unpaid") {
    return "badge-soft-danger";
  }
  if (s === "Partially_paid") {
    return "badge-soft-primary";
  }
  return "badge-soft-warning text-dark";
}

export function formatInvoiceMoneyKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

export function formatIsoToDisplay(iso) {
  if (!iso) {
    return "";
  }
  const raw = String(iso).trim();
  const d = new Date(raw.length >= 10 ? `${raw.slice(0, 10)}T12:00:00` : raw);
  if (Number.isNaN(d.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatReceiptPaidAtDisplay(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

/** Human-readable relative time, e.g. "2 hours ago" (en-GB). */
export function formatRelativeTimeAgoEn(iso) {
  if (!iso) {
    return "";
  }
  const t = new Date(String(iso).trim()).getTime();
  if (Number.isNaN(t)) {
    return "";
  }
  let deltaSec = Math.round((Date.now() - t) / 1000);
  if (deltaSec < 0) {
    deltaSec = 0;
  }
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (deltaSec < 45) {
    return rtf.format(-deltaSec, "second");
  }
  const min = Math.floor(deltaSec / 60);
  if (min < 60) {
    return rtf.format(-min, "minute");
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    return rtf.format(-hr, "hour");
  }
  const day = Math.floor(hr / 24);
  if (day < 30) {
    return rtf.format(-day, "day");
  }
  const month = Math.floor(day / 30);
  if (month < 12) {
    return rtf.format(-month, "month");
  }
  const year = Math.floor(day / 365);
  return rtf.format(-year, "year");
}

/** True only after an email send to customer was actually recorded. */
export function invoiceWasIssuedToCustomer(row) {
  return row?.emailSentConfirmed === true;
}

/** Tooltip for actions when the invoice was already sent to customer. */
export function invoiceSentToCustomerHoverTitle(row) {
  if (!invoiceWasIssuedToCustomer(row)) {
    return "";
  }
  const iso = String(row?.sentToCustomerAt ?? "").trim();
  const rel = iso ? formatRelativeTimeAgoEn(iso) : "";
  return rel
    ? `This invoice is already sent to the customer ${rel}.`
    : "This invoice is already sent to the customer.";
}

export function receiptWasSentToCustomer(payment) {
  const raw = String(payment?.sent_to_customer_at ?? payment?.sentToCustomerAt ?? "").trim();
  if (!raw) {
    return false;
  }
  if (!raw.includes(":")) {
    return false;
  }
  return Number.isFinite(Date.parse(raw));
}

export function buildReceiptViewData(payment, invoiceRow) {
  const company = getCompanySettingsSnapshot();
  const footer = resolveQuotationFooterFromSnapshot(company);
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const logo = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();

  const totalNum =
    invoiceRow != null
      ? Number(invoiceRow.totalNum ?? 0)
      : Number(payment?.invoice_total_amount ?? NaN);
  const paidNum =
    invoiceRow != null
      ? Number(invoiceRow.paidNum ?? 0)
      : Number(payment?.invoice_amount_paid ?? NaN);
  const dueNum =
    Number.isFinite(totalNum) && Number.isFinite(paidNum)
      ? roundMoney(Math.max(0, totalNum - paidNum))
      : NaN;

  const hasInvoiceSnapshot =
    invoiceRow != null ||
    (payment?.invoice_total_amount != null && !Number.isNaN(Number(payment.invoice_total_amount)));

  const invoiceDateDisplay =
    (invoiceRow?.issueDate && String(invoiceRow.issueDate).trim()) ||
    formatIsoToDisplay(String(invoiceRow?.issueAtIso ?? payment?.invoice_issued_at ?? "").trim()) ||
    "—";

  const invoiceAmountFormatted =
    invoiceRow != null && String(invoiceRow.amount ?? "").trim()
      ? String(invoiceRow.amount).trim()
      : hasInvoiceSnapshot && Number.isFinite(totalNum)
        ? formatInvoiceMoneyKes(totalNum)
        : "—";

  const amountDueFormatted =
    invoiceRow != null && String(invoiceRow.amountdue ?? "").trim()
      ? String(invoiceRow.amountdue).trim()
      : hasInvoiceSnapshot && Number.isFinite(dueNum)
        ? formatInvoiceMoneyKes(dueNum)
        : "—";

  const payAmtRaw = Number(payment?.amount ?? 0);
  const paymentAmountFormatted = Number.isFinite(payAmtRaw) ? formatInvoiceMoneyKes(payAmtRaw) : "—";
  const paymentDateDisplay = formatReceiptPaidAtDisplay(payment?.paid_at);

  const transactionIdDisplay = String(payment?.transaction_id ?? "").trim();

  return {
    receiptRef: String(payment?.receipt_ref ?? ""),
    invoiceNo: String(invoiceRow?.invoiceno ?? payment?.invoice_ref ?? ""),
    customerName: String(invoiceRow?.customer ?? payment?.customer_name ?? ""),
    paymentDateDisplay,
    invoiceDateDisplay,
    invoiceAmountFormatted,
    paymentAmountFormatted,
    amountDueFormatted,
    amountFormatted: paymentAmountFormatted,
    paymentMethodLabel: paymentMethodLabel(payment?.payment_method),
    transactionIdDisplay: transactionIdDisplay || null,
    paidAtDisplay: paymentDateDisplay,
    seller: {
      companyName: company.companyName || "Your business",
      address: company.location || "—",
      phone: company.phone || "—"
    },
    footer,
    logoSrc: logo,
    logoDarkSrc: logo
  };
}

export function parseMoneyish(s) {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Sum of line taxes for list display (matches invoice view: line total minus ex-tax subtotal).
 */
export function taxTotalFromInvoiceLineItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  let sum = 0;
  for (const it of items) {
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unit_price ?? 0);
    const lineTotalRaw = it.line_total;
    if (lineTotalRaw != null && String(lineTotalRaw).trim() !== "") {
      const lineTotal = Number(lineTotalRaw);
      if (Number.isFinite(lineTotal)) {
        const lineSubEx = roundMoney((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0));
        sum += roundMoney(lineTotal - lineSubEx);
        continue;
      }
    }
    const pctRaw = parseFloat(String(it.tax_percent ?? 0).replace(/[^0-9.-]/g, ""));
    const pct = Number.isNaN(pctRaw) || pctRaw < 0 ? 0 : Math.min(pctRaw, 100);
    const subEx = roundMoney((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0));
    sum += roundMoney(subEx * (pct / 100));
  }
  return roundMoney(sum);
}

/** Map API invoice to list row (when backend is available). */
export function apiInvoiceToRow(inv) {
  const emailStatusNorm = String(inv.email_status ?? inv.mail_status ?? "").trim().toLowerCase();
  const emailSentAtPrimaryRaw =
    inv.email_sent_at ??
    inv.last_email_sent_at ??
    inv.sent_email_at ??
    inv.email_last_sent_at ??
    inv.last_sent_at ??
    null;
  const legacySentAtRaw = inv.sent_to_customer_at ?? inv.sentToCustomerAt ?? null;
  const emailSentAt = String(emailSentAtPrimaryRaw ?? legacySentAtRaw ?? "").trim();
  const emailTimestampLooksValid = emailSentAt.includes(":") && Number.isFinite(Date.parse(emailSentAt));
  const createdAtForHeuristicRaw = String(inv.created_at ?? "").trim();
  const createdAtForHeuristicTs = createdAtForHeuristicRaw ? Date.parse(createdAtForHeuristicRaw) : NaN;
  const sentAtTs = emailTimestampLooksValid ? Date.parse(emailSentAt) : NaN;
  const sentLooksLikeCreateStamp =
    Number.isFinite(createdAtForHeuristicTs) &&
    Number.isFinite(sentAtTs) &&
    Math.abs(sentAtTs - createdAtForHeuristicTs) < 15000;
  const emailSentConfirmed =
    emailStatusNorm === "sent" ||
    emailStatusNorm === "delivered" ||
    (emailTimestampLooksValid && !sentLooksLikeCreateStamp);
  const total = Number(inv.total_amount ?? 0);
  const paid = Number(inv.amount_paid ?? 0);
  const due = roundMoney(Math.max(0, total - paid));
  const cImg = inv.customer_image_url ? String(inv.customer_image_url) : stockImg01;
  const nestedCustomer = inv.customer && typeof inv.customer === "object" ? inv.customer : null;
  const invoiceTitle = String(
    inv.invoice_title ?? inv.title ?? inv.subject ?? inv.subject_line ?? inv.invoice_for ?? ""
  ).trim();
  const createdAtRaw = String(inv.created_at ?? "").trim();
  const createdAtTs = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;
  const statusNorm = String(inv.status ?? "Draft");
  const recurringEnabled = Boolean(
    inv.is_recurring ??
      inv.recurring ??
      inv.recurring_enabled ??
      inv.isRecurring
  );
  const recurringEveryRaw =
    inv.recurring_interval_value ??
    inv.recurring_interval ??
    inv.recurring_every ??
    inv.recurring_every_months ??
    inv.repeat_every ??
    inv.interval_value;
  const recurringEveryNum = Number(recurringEveryRaw ?? 0);
  const recurringEvery = Number.isFinite(recurringEveryNum) && recurringEveryNum > 0 ? recurringEveryNum : 1;
  const recurringUnitRaw =
    inv.recurring_interval_unit ??
    inv.recurring_unit ??
    inv.repeat_unit ??
    inv.interval_unit;
  const recurringUnitNorm = String(recurringUnitRaw ?? "month").toLowerCase();
  const recurringUnit = recurringUnitNorm === "day" || recurringUnitNorm === "week" ? recurringUnitNorm : "month";
  const rawRef = inv.invoice_ref != null ? String(inv.invoice_ref).trim() : "";
  let invoiceRefStored = rawRef;
  if (invoiceRefStored === "" && statusNorm !== "Draft") {
    invoiceRefStored = String(inv.id ?? "");
  }
  const invoiceno = statusNorm === "Draft" ? "INV-DRAFT" : invoiceRefStored;
  return {
    id: String(inv.id),
    apiId: inv.id,
    invoiceno,
    invoiceRefStored,
    image: cImg,
    customer: String(inv.customer_name ?? ""),
    customerId: inv.customer_id != null ? String(inv.customer_id) : String(nestedCustomer?.id ?? ""),
    customerEmail: String(inv.customer_email ?? nestedCustomer?.email ?? ""),
    customerPhone: String(inv.customer_phone ?? nestedCustomer?.phone ?? ""),
    customerLocation: String(inv.customer_location ?? nestedCustomer?.location ?? ""),
    issueDate: formatIsoToDisplay(inv.issued_at),
    issueAtIso: inv.issued_at ? String(inv.issued_at).slice(0, 10) : "",
    duedate: formatIsoToDisplay(inv.due_at),
    dueAtIso: inv.due_at ? String(inv.due_at).slice(0, 10) : "",
    amount: formatInvoiceMoneyKes(total),
    paid: formatInvoiceMoneyKes(paid),
    amountdue: formatInvoiceMoneyKes(due),
    status: String(inv.status ?? "Draft"),
    totalNum: total,
    paidNum: paid,
    invoiceTitle,
    termsAndConditions: String(inv.terms_and_conditions ?? ""),
    notes: String(inv.notes ?? ""),
    discountType: String(inv.discount_type ?? "none"),
    discountBasis: String(inv.discount_basis ?? "percent"),
    discountValue: Number(inv.discount_value ?? 0),
    items: Array.isArray(inv.items) ? inv.items : [],
    taxNum: taxTotalFromInvoiceLineItems(Array.isArray(inv.items) ? inv.items : []),
    payments: Array.isArray(inv.payments) ? inv.payments : [],
    isRecurring: recurringEnabled,
    recurringEveryMonths: recurringEvery,
    recurringIntervalUnit: recurringUnit,
    paymentCount:
      typeof inv.payment_count === "number"
        ? inv.payment_count
        : Array.isArray(inv.payments)
          ? inv.payments.length
          : 0,
    createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : null,
    sentToCustomerAt: emailTimestampLooksValid ? emailSentAt : null,
    emailSentConfirmed
  };
}

export function parseRowDateFlexible(row) {
  if (row.issueAtIso) {
    const d = new Date(`${row.issueAtIso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseRowDateStr(row.issueDate);
}

export function parseRowDateStr(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildInvoiceViewDocumentData(row) {
  const company = getCompanySettingsSnapshot();
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const footer = resolveQuotationFooterFromSnapshot(company);
  const invoiceLogo = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();
  const issueDate = row?.issueAtIso || "";
  const dueDate = row?.dueAtIso || "";
  const items = Array.isArray(row?.items) ? row.items : [];
  const totalNum = Number(row?.totalNum ?? 0);
  const paidNum = Number(row?.paidNum ?? 0);

  let subtotalExTax = 0;
  let taxTotal = 0;
  const lineRows = (items.length > 0 ? items : [{ product_name: "Invoice total", quantity: 1, unit_price: totalNum, line_total: totalNum }]).map((it, idx) => {
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unit_price ?? 0);
    const lineTotal = Number(it.line_total ?? qty * unit);
    const lineSubEx = roundMoney((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0));
    const lineTax = roundMoney(lineTotal - lineSubEx);
    subtotalExTax += lineSubEx;
    taxTotal += lineTax;
    return {
      key: String(it.id ?? idx + 1),
      title: String(it.product_name ?? "Item"),
      desc: String(it.description ?? "").trim(),
      qty: Number.isFinite(qty) ? String(qty) : "0",
      cost: formatInvoiceMoneyKes(unit),
      discount: "—",
      total: formatInvoiceMoneyKes(lineTotal)
    };
  });

  subtotalExTax = roundMoney(subtotalExTax);
  taxTotal = roundMoney(taxTotal);
  const gross = roundMoney(subtotalExTax + taxTotal);
  const discountAmt = roundMoney(Math.max(0, gross - totalNum));
  const paidRounded = roundMoney(Math.max(0, paidNum));
  const amountDueNum = roundMoney(Math.max(0, totalNum - paidNum));

  return {
    invoiceNo: String(row?.invoiceno ?? "INV-000000"),
    issueDateDisplay: formatIsoToDisplay(issueDate) || "—",
    dueDateDisplay: formatIsoToDisplay(dueDate) || "—",
    statusLabel: String(row?.status ?? "Draft"),
    subjectLine: String(row?.invoiceTitle ?? "").trim(),
    seller: {
      companyName: company.companyName || "Your business",
      address: company.location || "—",
      website: company.website || "",
      email: company.email || "—",
      phone: company.phone || "—"
    },
    buyer: {
      name: String(row?.customer ?? "Customer"),
      address: String(row?.customerLocation ?? ""),
      email: String(row?.customerEmail ?? ""),
      phone: String(row?.customerPhone ?? "")
    },
    qrSrc: "",
    lineRows,
    totals: {
      sub: formatInvoiceMoneyKes(subtotalExTax),
      discountLine: discountAmt > 0 ? "Discount (aggregate)" : "",
      discountAmt: discountAmt > 0 ? formatInvoiceMoneyKes(discountAmt) : "",
      taxLine: "Tax",
      taxAmt: formatInvoiceMoneyKes(taxTotal),
      grandTotal: formatInvoiceMoneyKes(totalNum),
      amountPaid: formatInvoiceMoneyKes(paidRounded),
      amountDue: formatInvoiceMoneyKes(amountDueNum),
      amountInWords: ""
    },
    terms: String(row?.termsAndConditions ?? "").trim(),
    notes: String(row?.notes ?? "").trim(),
    footer,
    signBlock: null,
    logoSrc: invoiceLogo,
    logoDarkSrc: invoiceLogo
  };
}

/** Build POST /invoices body to duplicate an API invoice (no payments). */
export function buildInvoiceCloneCreateBody(rawInvoice) {
  const title = String(rawInvoice.invoice_title ?? "").trim();
  const items = (rawInvoice.items || []).map((it) => ({
    product_id: it.product_id != null ? Number(it.product_id) : null,
    product_name: String(it.product_name ?? "Item"),
    description: it.description != null ? String(it.description) : null,
    quantity: Number(it.quantity ?? 1),
    unit_price: it.unit_price != null ? Number(it.unit_price) : 0,
    tax_percent: it.tax_percent != null ? Number(it.tax_percent) : null
  }));
  return {
    invoice_ref: null,
    invoice_title: title ? `Copy of ${title}` : null,
    issued_at: new Date().toISOString().slice(0, 10),
    due_at: rawInvoice.due_at || null,
    customer_id: Number(rawInvoice.customer_id),
    status: "Draft",
    amount_paid: 0,
    notes: rawInvoice.notes ?? null,
    terms_and_conditions: rawInvoice.terms_and_conditions ?? null,
    discount_type: rawInvoice.discount_type ?? "none",
    discount_basis: rawInvoice.discount_basis ?? "percent",
    discount_value:
      rawInvoice.discount_type === "none" || rawInvoice.discount_type == null
        ? null
        : Number(rawInvoice.discount_value ?? 0),
    items
  };
}
