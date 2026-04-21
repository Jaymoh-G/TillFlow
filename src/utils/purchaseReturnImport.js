function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  date: ["date", "return date", "return_date"],
  supplier: ["supplier", "supplier name", "supplier_name"],
  reference: ["reference", "ref"],
  refunded: ["refunded", "paid", "refund amount", "refund_amount"],
  due: ["due", "due amount", "due_amount"],
  status: ["status"],
  paymentStatus: ["payment status", "payment_status"],
  description: ["description", "notes"]
};

function mapHeaders(headerCells) {
  const col = new Map();
  const indexed = headerCells.map((c) => normHeader(c));
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < indexed.length; i++) {
      if (aliases.includes(indexed[i])) {
        if (!col.has(canonical)) col.set(canonical, i);
        break;
      }
    }
  }
  return col;
}

function rowEmpty(cells) {
  return cells.every((c) => String(c ?? "").trim() === "");
}

export function parsePurchaseReturnImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["date", "supplier", "refunded"]) {
    if (!col.has(req)) {
      const name = req === "date" ? "Date" : req === "supplier" ? "Supplier" : "Refunded";
      errors.push({ sheetRow: 1, message: `Missing required column "${name}".` });
      return { rows, errors };
    }
  }

  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const date = String(cells[col.get("date")] ?? "").trim();
    const supplier = String(cells[col.get("supplier")] ?? "").trim();
    const reference = col.has("reference") ? String(cells[col.get("reference")] ?? "").trim() : "";
    const refundedRaw = String(cells[col.get("refunded")] ?? "").trim();
    const dueRaw = col.has("due") ? String(cells[col.get("due")] ?? "").trim() : "";
    const status = col.has("status") ? String(cells[col.get("status")] ?? "").trim() : "Returned";
    const paymentStatus = col.has("paymentStatus")
      ? String(cells[col.get("paymentStatus")] ?? "").trim()
      : "Refunded";
    const description = col.has("description") ? String(cells[col.get("description")] ?? "").trim() : "";

    const refunded = Number(refundedRaw.replace(/,/g, ""));
    const due = dueRaw ? Number(dueRaw.replace(/,/g, "")) : 0;
    if (!date || Number.isNaN(Date.parse(date))) {
      errors.push({ sheetRow, message: "Date is required and must be valid." });
      continue;
    }
    if (!supplier) {
      errors.push({ sheetRow, message: "Supplier is required." });
      continue;
    }
    if (!Number.isFinite(refunded) || refunded < 0) {
      errors.push({ sheetRow, message: "Refunded must be a valid number." });
      continue;
    }
    if (!Number.isFinite(due) || due < 0) {
      errors.push({ sheetRow, message: "Due must be a valid number." });
      continue;
    }

    rows.push({
      sheetRow,
      date,
      supplier,
      reference: reference || null,
      refunded,
      due,
      status: status || "Returned",
      paymentStatus: paymentStatus || "Refunded",
      description: description || null
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parsePurchaseReturnImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parsePurchaseReturnImportRows(rowsAoA);
}

const TEMPLATE_HEADERS = [
  "Date",
  "Supplier",
  "Reference",
  "Refunded",
  "Due",
  "Status",
  "Payment Status",
  "Description"
];
const TEMPLATE_EXAMPLES = [
  ["2026-04-21", "Electro Mart", "RT001", "1500", "0", "Returned", "Refunded", "Defective stock returned"],
  ["2026-04-22", "Prime Bazaar", "RT002", "800", "100", "Returned", "Unrefunded", ""]
];

export async function downloadPurchaseReturnImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Returns");
  XLSX.writeFile(wb, `purchase-returns-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
