function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  group: ["group", "group_key", "group key"],
  customerId: ["customer_id", "customer id"],
  invoiceId: ["invoice_id", "invoice id"],
  posOrderId: ["pos_order_id", "pos order id"],
  productId: ["product_id", "product id"],
  storeId: ["store_id", "store id"],
  quantity: ["quantity", "qty"],
  returnedAt: ["returned_at", "returned at", "date"],
  status: ["status"],
  amountPaid: ["amount_paid", "amount paid", "paid"],
  paymentStatus: ["payment_status", "payment status"],
  notes: ["notes", "note"]
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

function parseStatus(raw) {
  return String(raw ?? "").trim().toLowerCase() === "received" ? "Received" : "Pending";
}
function parsePaymentStatus(raw) {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "paid") return "Paid";
  if (t === "overdue") return "Overdue";
  return "Unpaid";
}

export function parseSalesReturnsImportRows(rowsAoA) {
  const groups = new Map();
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["productId", "storeId", "quantity"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const customerIdRaw = col.has("customerId") ? String(cells[col.get("customerId")] ?? "").trim() : "";
    const invoiceIdRaw = col.has("invoiceId") ? String(cells[col.get("invoiceId")] ?? "").trim() : "";
    const posOrderIdRaw = col.has("posOrderId") ? String(cells[col.get("posOrderId")] ?? "").trim() : "";
    const productId = Number(String(cells[col.get("productId")] ?? "").trim());
    const storeId = Number(String(cells[col.get("storeId")] ?? "").trim());
    const quantity = Number(String(cells[col.get("quantity")] ?? "").replace(/[^0-9.-]/g, ""));
    const returnedAtRaw = col.has("returnedAt") ? String(cells[col.get("returnedAt")] ?? "").trim() : "";
    const status = col.has("status") ? parseStatus(cells[col.get("status")]) : "Pending";
    const paymentStatus = col.has("paymentStatus") ? parsePaymentStatus(cells[col.get("paymentStatus")]) : "Unpaid";
    const amountPaid = col.has("amountPaid")
      ? Number(String(cells[col.get("amountPaid")] ?? "").replace(/[^0-9.-]/g, "") || "0")
      : 0;
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    const groupKeyRaw = col.has("group") ? String(cells[col.get("group")] ?? "").trim() : "";

    if (!Number.isFinite(productId) || productId <= 0) {
      errors.push({ sheetRow, message: "product_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(storeId) || storeId <= 0) {
      errors.push({ sheetRow, message: "store_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push({ sheetRow, message: "quantity must be a number >= 1." });
      continue;
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      errors.push({ sheetRow, message: "amount_paid must be a valid non-negative number." });
      continue;
    }
    let returnedAtIso = "";
    if (returnedAtRaw) {
      const d = new Date(returnedAtRaw);
      if (Number.isNaN(d.getTime())) {
        errors.push({ sheetRow, message: "returned_at/date must be a valid date/time." });
        continue;
      }
      returnedAtIso = d.toISOString();
    }
    const groupKey =
      groupKeyRaw || `${customerIdRaw}|${invoiceIdRaw}|${posOrderIdRaw}|${status}|${paymentStatus}|${returnedAtIso}|${notes}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sheetRow,
        customer_id: customerIdRaw ? Number(customerIdRaw) : undefined,
        invoice_id: invoiceIdRaw ? Number(invoiceIdRaw) : undefined,
        pos_order_id: posOrderIdRaw ? Number(posOrderIdRaw) : undefined,
        status,
        amount_paid: amountPaid,
        payment_status: paymentStatus,
        notes: notes || null,
        returned_at: returnedAtIso || undefined,
        lines: []
      });
    }
    groups.get(groupKey).lines.push({
      product_id: Math.floor(productId),
      store_id: Math.floor(storeId),
      quantity: Math.floor(quantity)
    });
  }
  for (const g of groups.values()) rows.push(g);
  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parseSalesReturnsImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseSalesReturnsImportRows(rowsAoA);
}

export async function downloadSalesReturnsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "group",
      "customer_id",
      "invoice_id",
      "pos_order_id",
      "product_id",
      "store_id",
      "quantity",
      "returned_at",
      "status",
      "amount_paid",
      "payment_status",
      "notes"
    ],
    ["SR001", "10", "101", "", "2001", "1", "1", "2026-04-21 12:00", "Pending", "0", "Unpaid", "Imported return"],
    ["SR001", "10", "101", "", "2002", "1", "2", "2026-04-21 12:00", "Pending", "0", "Unpaid", "Imported return"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "SalesReturns");
  XLSX.writeFile(wb, `sales-returns-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
