function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  group: ["group", "group_key", "group key"],
  customerId: ["customer_id", "customer id"],
  issuedAt: ["issued_at", "issued at", "issue date"],
  dueAt: ["due_at", "due at", "due date"],
  status: ["status"],
  title: ["invoice_title", "title"],
  productId: ["product_id", "product id"],
  customLabel: ["custom_label", "custom label", "item_name", "item name"],
  quantity: ["quantity", "qty"],
  unitPrice: ["unit_price", "unit price"],
  taxPercent: ["tax_percent", "tax percent"]
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
export function parseInvoicesImportRows(rowsAoA) {
  const groups = new Map();
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["customerId", "productId", "quantity"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const customerId = Number(String(cells[col.get("customerId")] ?? "").trim());
    const productId = Number(String(cells[col.get("productId")] ?? "").trim());
    const quantity = Number(String(cells[col.get("quantity")] ?? "").replace(/[^0-9.-]/g, ""));
    const unitPrice = col.has("unitPrice")
      ? Number(String(cells[col.get("unitPrice")] ?? "").replace(/[^0-9.-]/g, "") || "0")
      : 0;
    const taxPercent = col.has("taxPercent")
      ? Number(String(cells[col.get("taxPercent")] ?? "").replace(/[^0-9.-]/g, "") || "0")
      : 16;
    const issuedAtRaw = col.has("issuedAt") ? String(cells[col.get("issuedAt")] ?? "").trim() : "";
    const dueAtRaw = col.has("dueAt") ? String(cells[col.get("dueAt")] ?? "").trim() : "";
    const statusRaw = col.has("status") ? String(cells[col.get("status")] ?? "").trim() : "Draft";
    const title = col.has("title") ? String(cells[col.get("title")] ?? "").trim() : "";
    const customLabel = col.has("customLabel") ? String(cells[col.get("customLabel")] ?? "").trim() : "";
    if (!Number.isFinite(customerId) || customerId <= 0) {
      errors.push({ sheetRow, message: "customer_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(productId) || productId <= 0) {
      errors.push({ sheetRow, message: "product_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ sheetRow, message: "quantity must be > 0." });
      continue;
    }
    const issuedAt = issuedAtRaw || new Date().toISOString().slice(0, 10);
    const dueAt = dueAtRaw || null;
    const groupKey = (col.has("group") ? String(cells[col.get("group")] ?? "").trim() : "") || `${customerId}|${issuedAt}|${dueAt}|${statusRaw}|${title}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sheetRow,
        customer_id: Math.floor(customerId),
        issued_at: issuedAt,
        due_at: dueAt,
        status: statusRaw || "Draft",
        invoice_title: title || null,
        discount_type: "none",
        discount_basis: "percent",
        discount_value: null,
        items: []
      });
    }
    groups.get(groupKey).items.push({
      product_id: Math.floor(productId),
      product_name: customLabel || null,
      qty: quantity,
      unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
      tax_percent: Number.isFinite(taxPercent) ? taxPercent : 16
    });
  }
  for (const g of groups.values()) rows.push(g);
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No data rows found." });
  return { rows, errors };
}

export async function parseInvoicesImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseInvoicesImportRows(rowsAoA);
}

export async function downloadInvoicesImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "customer_id", "issued_at", "due_at", "status", "invoice_title", "product_id", "quantity", "unit_price", "tax_percent"],
    ["INV001", "10", "2026-04-21", "2026-05-21", "Draft", "Imported invoice", "2001", "2", "1500", "16"],
    ["INV001", "10", "2026-04-21", "2026-05-21", "Draft", "Imported invoice", "2002", "1", "800", "16"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, `invoices-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
