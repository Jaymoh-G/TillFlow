import { resolveInvoiceLogoUrl } from "../../constants/defaultBrandLogo";
import { getCompanySettingsSnapshot, resolveQuotationFooterFromSnapshot } from "../../utils/companySettingsStorage";
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import { formatInvoiceMoneyKes, formatIsoToDisplay } from "./invoiceViewHelpers";

export function deliveryStatusBadgeClass(st) {
  const s = String(st ?? "").trim().toLowerCase();
  if (s === "cancelled") {
    return "badge-soft-dark";
  }
  if (s === "draft") {
    return "badge-soft-secondary";
  }
  if (s === "issued") {
    return "badge-soft-success";
  }
  return "badge-soft-primary";
}

export function invoiceDeliveryStatusLabel(invoiceRow) {
  const items = Array.isArray(invoiceRow?.items) ? invoiceRow.items : [];
  let invoiced = 0;
  let delivered = 0;
  for (const item of items) {
    const invQty = Number(item.quantity ?? 0);
    const deliveredQty = Number(item.delivered_qty ?? 0);
    if (Number.isFinite(invQty)) {
      invoiced += invQty;
    }
    if (Number.isFinite(deliveredQty)) {
      delivered += Math.max(0, deliveredQty);
    }
  }
  if (invoiced <= 0 || delivered <= 0) {
    return "Not delivered";
  }
  if (delivered >= invoiced) {
    return "Fully delivered";
  }
  return "Partially delivered";
}

export function mapInvoiceItemsToDeliveryCandidates(items) {
  return (Array.isArray(items) ? items : []).map((it, idx) => {
    const qty = Number(it.quantity ?? 0);
    const delivered = Number(it.delivered_qty ?? 0);
    const explicitRemaining = Number(it.remaining_qty ?? NaN);
    const remaining = Number.isFinite(explicitRemaining) ? explicitRemaining : Math.max(0, qty - delivered);
    return {
      key: String(it.id ?? idx + 1),
      invoiceItemId: it.id ?? null,
      productId: it.product_id ?? null,
      productName: String(it.product_name ?? "Item"),
      uom: String(it.uom ?? it.unit ?? "").trim(),
      invoiceQty: Number.isFinite(qty) ? qty : 0,
      deliveredQty: Number.isFinite(delivered) ? delivered : 0,
      remainingQty: Number.isFinite(remaining) ? remaining : 0
    };
  });
}

export function apiDeliveryNoteToRow(note) {
  const items = Array.isArray(note?.items) ? note.items : [];
  const totalQty = items.reduce((acc, item) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    return acc + (Number.isFinite(qty) ? qty : 0);
  }, 0);
  return {
    id: String(note?.id ?? ""),
    apiId: note?.id ?? null,
    deliveryNoteNo: String(note?.delivery_note_no ?? note?.note_no ?? `DN-${note?.id ?? "—"}`),
    invoiceId: note?.invoice_id ?? null,
    invoiceRef: String(note?.invoice_ref ?? ""),
    customerName: String(note?.customer_name ?? ""),
    customerEmail: String(note?.customer_email ?? ""),
    status: String(note?.status ?? "Issued"),
    issueAtIso: String(note?.issued_at ?? "").slice(0, 10),
    issueDate: formatIsoToDisplay(note?.issued_at),
    notes: String(note?.notes ?? ""),
    items,
    totalItems: Number(note?.total_items ?? items.length ?? 0),
    totalQty
  };
}

export function buildDeliveryNoteViewDocumentData(noteRow) {
  const company = getCompanySettingsSnapshot();
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const footer = resolveQuotationFooterFromSnapshot(company);
  const logo = resolveInvoiceLogoUrl(invoiceSettings.invoiceLogoDataUrl);

  const lineRows = (Array.isArray(noteRow?.items) ? noteRow.items : []).map((item, idx) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    return {
      key: String(item.id ?? idx + 1),
      title: String(item.product_name ?? "Item"),
      desc: String(item.description ?? "").trim(),
      uom: String(item.uom ?? "").trim(),
      qty: Number.isFinite(qty) ? qty : 0
    };
  });

  const totalQty = lineRows.reduce((acc, row) => acc + Number(row.qty || 0), 0);

  return {
    noteNo: String(noteRow?.deliveryNoteNo ?? "DN-000000"),
    invoiceNo: String(noteRow?.invoiceRef ?? ""),
    issueDateDisplay: formatIsoToDisplay(noteRow?.issueAtIso) || "—",
    statusLabel: String(noteRow?.status ?? "Issued"),
    seller: {
      companyName: company.companyName || "Your business",
      address: company.location || "—",
      website: company.website || "",
      email: company.email || "—",
      phone: company.phone || "—"
    },
    buyer: {
      name: String(noteRow?.customerName ?? "Customer"),
      email: String(noteRow?.customerEmail ?? "")
    },
    lineRows,
    totals: {
      totalItems: lineRows.length,
      totalQty,
      totalQtyFormatted: formatInvoiceMoneyKes(totalQty)
    },
    notes: String(noteRow?.notes ?? "").trim(),
    footer,
    logoSrc: logo,
    logoDarkSrc: logo
  };
}
