import { getCompanySettingsSnapshot, resolveQuotationFooterFromSnapshot } from "../../utils/companySettingsStorage";
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import { formatInvoiceMoneyKes, formatIsoToDisplay } from "./invoiceViewHelpers";

export function creditStatusBadgeClass(st) {
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

export function mapInvoiceItemsToCreditCandidates(items) {
  return (Array.isArray(items) ? items : []).map((it, idx) => {
    const qty = Number(it.quantity ?? 0);
    const explicitCredited = Number(it.credited_qty ?? NaN);
    const credited = Number.isFinite(explicitCredited) ? explicitCredited : 0;
    const remaining = Math.max(0, qty - credited);
    return {
      key: String(it.id ?? idx + 1),
      invoiceItemId: it.id ?? null,
      productId: it.product_id ?? null,
      productName: String(it.product_name ?? "Item"),
      description: String(it.description ?? ""),
      uom: String(it.uom ?? it.unit ?? "").trim(),
      invoiceQty: Number.isFinite(qty) ? qty : 0,
      creditedQty: Number.isFinite(credited) ? credited : 0,
      remainingQty: Number.isFinite(remaining) ? remaining : 0,
      unitPrice: Number(it.unit_price ?? 0)
    };
  });
}

export function apiCreditNoteToRow(note) {
  const items = Array.isArray(note?.items) ? note.items : [];
  const totalQty = items.reduce((acc, item) => acc + (Number(item.qty ?? 0) || 0), 0);
  const totalAmount = Number(note?.total_amount ?? items.reduce((acc, item) => acc + (Number(item.line_total ?? 0) || 0), 0));
  return {
    id: String(note?.id ?? ""),
    apiId: note?.id ?? null,
    creditNoteNo: String(note?.credit_note_no ?? `CN-${note?.id ?? "—"}`),
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
    totalQty,
    totalAmount,
    totalAmountDisplay: formatInvoiceMoneyKes(totalAmount)
  };
}

export function buildCreditNoteViewDocumentData(noteRow) {
  const company = getCompanySettingsSnapshot();
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const footer = resolveQuotationFooterFromSnapshot(company);
  const logo = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();

  const lineRows = (Array.isArray(noteRow?.items) ? noteRow.items : []).map((item, idx) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    const unit = Number(item.unit_price ?? 0);
    const lineTotal = Number(item.line_total ?? qty * unit);
    return {
      key: String(item.id ?? idx + 1),
      title: String(item.product_name ?? "Item"),
      desc: String(item.description ?? "").trim(),
      uom: String(item.uom ?? "").trim(),
      qty: Number.isFinite(qty) ? qty : 0,
      unit: formatInvoiceMoneyKes(unit),
      lineTotal: formatInvoiceMoneyKes(lineTotal)
    };
  });

  const totalQty = lineRows.reduce((acc, row) => acc + Number(row.qty || 0), 0);
  const totalAmount = Number(noteRow?.totalAmount ?? 0);

  return {
    noteNo: String(noteRow?.creditNoteNo ?? "CN-000000"),
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
      totalAmount: formatInvoiceMoneyKes(totalAmount)
    },
    notes: String(noteRow?.notes ?? "").trim(),
    footer,
    logoSrc: logo,
    logoDarkSrc: logo
  };
}

