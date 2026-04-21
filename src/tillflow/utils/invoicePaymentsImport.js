function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  invoiceId: ["invoice_id", "invoice id"],
  amount: ["amount", "paid amount", "paid"],
  method: ["method", "payment_method", "payment method"],
  paidAt: ["paid_at", "paid at", "date"],
  transactionId: ["transaction_id", "transaction id", "txn id"],
  notes: ["notes", "note"]
};

function mapHeaders(headerCells) {
  const col = new Map();
  const indexed = headerCells.map((c) => normHeader(c));
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < indexed.length; i++) {
      if (aliases.includes(indexed[i])) {
        if (!col.has(canonical)) {
          col.set(canonical, i);
        }
        break;
      }
    }
  }
  return col;
}

function rowEmpty(cells) {
  return cells.every((c) => String(c ?? "").trim() === "");
}

function parseMethod(raw) {
  const m = String(raw ?? "").trim().toLowerCase();
  if (["cash", "bank_transfer", "mpesa", "card", "cheque", "other"].includes(m)) {
    return m;
  }
  return "cash";
}

export function parseInvoicePaymentsImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["invoiceId", "amount"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req === "invoiceId" ? "invoice_id" : "amount"}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const invoiceId = Number(String(cells[col.get("invoiceId")] ?? "").trim());
    const amount = Number(String(cells[col.get("amount")] ?? "").replace(/[^0-9.-]/g, ""));
    const method = col.has("method") ? parseMethod(cells[col.get("method")]) : "cash";
    const paidAtRaw = col.has("paidAt") ? String(cells[col.get("paidAt")] ?? "").trim() : "";
    const transactionId = col.has("transactionId") ? String(cells[col.get("transactionId")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      errors.push({ sheetRow, message: "invoice_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ sheetRow, message: "amount must be a number greater than 0." });
      continue;
    }
    let paidAt = null;
    if (paidAtRaw) {
      const dt = new Date(paidAtRaw);
      if (Number.isNaN(dt.getTime())) {
        errors.push({ sheetRow, message: "paid_at/date must be a valid date/time." });
        continue;
      }
      paidAt = dt.toISOString();
    }
    rows.push({
      sheetRow,
      invoiceId: Math.floor(invoiceId),
      amount,
      payment_method: method,
      paid_at: paidAt,
      transaction_id: transactionId || null,
      notes: notes || null
    });
  }
  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parseInvoicePaymentsImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseInvoicePaymentsImportRows(rowsAoA);
}

export async function downloadInvoicePaymentsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["invoice_id", "amount", "payment_method", "paid_at", "transaction_id", "notes"],
    ["101", "3500", "mpesa", "2026-04-21 10:30", "QWE123", "Imported payment"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "InvoicePayments");
  XLSX.writeFile(wb, `invoice-payments-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
