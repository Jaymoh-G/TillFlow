function normHeader(h) {
  return String(h ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  group: ["group", "group_key", "group key"],
  storeId: ["store_id", "store id"],
  customerId: ["customer_id", "customer id"],
  customerName: ["customer_name", "customer name"],
  customerEmail: ["customer_email", "customer email"],
  notes: ["notes", "note"],
  productId: ["product_id", "product id"],
  productName: ["product_name", "product name", "item_name", "item name"],
  quantity: ["quantity", "qty"],
  unitPrice: ["unit_price", "unit price"],
  taxPercent: ["tax_percent", "tax percent"],
  paymentMethod: ["payment_method", "payment method", "method"],
  paymentAmount: ["payment_amount", "payment amount", "amount"]
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
function normPaymentMethod(raw) {
  const m = String(raw ?? "").trim().toLowerCase();
  if (["cash", "card", "mpesa", "bank_transfer", "other", "mixed", "cheque"].includes(m)) return m;
  return "cash";
}
export function parseOrdersImportRows(rowsAoA) {
  const groups = new Map();
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["storeId", "productName", "quantity", "unitPrice"]) {
    if (!col.has(req) && !(req === "productName" && col.has("productId"))) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req === "productName" ? "product_name or product_id" : req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const storeId = Number(String(cells[col.get("storeId")] ?? "").trim());
    const customerIdRaw = col.has("customerId") ? String(cells[col.get("customerId")] ?? "").trim() : "";
    const customerName = col.has("customerName") ? String(cells[col.get("customerName")] ?? "").trim() : "";
    const customerEmail = col.has("customerEmail") ? String(cells[col.get("customerEmail")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    const productIdRaw = col.has("productId") ? String(cells[col.get("productId")] ?? "").trim() : "";
    const productName = col.has("productName") ? String(cells[col.get("productName")] ?? "").trim() : "";
    const quantity = Number(String(cells[col.get("quantity")] ?? "").replace(/[^0-9.-]/g, ""));
    const unitPrice = Number(String(cells[col.get("unitPrice")] ?? "").replace(/[^0-9.-]/g, ""));
    const taxPercent = col.has("taxPercent")
      ? Number(String(cells[col.get("taxPercent")] ?? "").replace(/[^0-9.-]/g, "") || "0")
      : 0;
    const paymentMethod = col.has("paymentMethod") ? normPaymentMethod(cells[col.get("paymentMethod")]) : "cash";
    const paymentAmount = col.has("paymentAmount")
      ? Number(String(cells[col.get("paymentAmount")] ?? "").replace(/[^0-9.-]/g, "") || "0")
      : null;
    if (!productIdRaw && !productName) {
      errors.push({ sheetRow, message: "Either product_id or product_name is required." });
      continue;
    }
    if (!Number.isFinite(storeId) || storeId < 1) {
      errors.push({ sheetRow, message: "store_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ sheetRow, message: "quantity must be > 0." });
      continue;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push({ sheetRow, message: "unit_price must be a valid non-negative number." });
      continue;
    }
    const groupKey = (col.has("group") ? String(cells[col.get("group")] ?? "").trim() : "") || `${storeId}|${customerIdRaw}|${customerName}|${customerEmail}|${notes}|${paymentMethod}|${paymentAmount}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sheetRow,
        store_id: storeId,
        customer_id: customerIdRaw ? Number(customerIdRaw) : null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        currency: "KES",
        discount_amount: 0,
        notes: notes || null,
        items: [],
        payments: paymentAmount != null ? [{ method: paymentMethod, amount: paymentAmount }] : []
      });
    }
    groups.get(groupKey).items.push({
      product_id: productIdRaw ? Number(productIdRaw) : null,
      sku: null,
      product_name: productName || `Product #${productIdRaw}`,
      description: null,
      quantity,
      unit_price: unitPrice,
      tax_percent: Number.isFinite(taxPercent) ? taxPercent : 0
    });
  }
  for (const g of groups.values()) rows.push(g);
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No data rows found." });
  return { rows, errors };
}

export async function parseOrdersImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseOrdersImportRows(rowsAoA);
}

export async function downloadOrdersImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "store_id", "customer_id", "customer_name", "customer_email", "product_id", "product_name", "quantity", "unit_price", "tax_percent", "payment_method", "payment_amount", "notes"],
    ["ORD001", "1", "10", "John Doe", "john@example.com", "2001", "Product A", "2", "1500", "16", "cash", "3480", "Imported order"],
    ["ORD001", "1", "10", "John Doe", "john@example.com", "2002", "Product B", "1", "500", "16", "cash", "3480", "Imported order"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, `orders-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
