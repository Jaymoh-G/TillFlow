function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  supplier: ["supplier", "supplier name", "supplier_name"],
  reference: ["reference", "ref", "purchase no", "purchase_no"],
  date: ["date", "purchase date", "purchase_date"],
  type: ["type", "purchase type", "purchase_type"],
  status: ["status"],
  description: ["description", "notes", "note"],
  product: ["product", "product name", "product_name", "item"],
  qty: ["qty", "quantity", "ordered qty", "ordered_qty"],
  unitPrice: ["unit price", "unit_price", "price", "cost"]
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

function parseMoney(raw) {
  const n = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normType(v) {
  return String(v ?? "").trim().toLowerCase() === "expense" ? "expense" : "stock";
}

function normStatusLabel(v) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (["draft", "partial", "received", "pending", "ordered"].includes(raw)) {
    return raw[0].toUpperCase() + raw.slice(1);
  }
  return "Draft";
}

function parseDateIso(v) {
  const t = String(v ?? "").trim();
  if (!t) {
    return new Date().toISOString().slice(0, 10);
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Returns grouped purchases by (supplier, reference, date, type, status).
 */
export function parsePurchaseImportRows(rowsAoA) {
  const purchases = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { purchases, errors };
  }

  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["supplier", "product", "qty", "unitPrice"]) {
    if (!col.has(req)) {
      const label =
        req === "supplier" ? "Supplier" : req === "product" ? "Product" : req === "qty" ? "Qty" : "Unit Price";
      errors.push({ sheetRow: 1, message: `Missing required column "${label}".` });
      return { purchases, errors };
    }
  }

  const groups = new Map();
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) {
      continue;
    }
    const sheetRow = i + 1;
    const supplier = String(cells[col.get("supplier")] ?? "").trim();
    const product = String(cells[col.get("product")] ?? "").trim();
    const qtyRaw = String(cells[col.get("qty")] ?? "").trim();
    const priceRaw = String(cells[col.get("unitPrice")] ?? "").trim();
    const reference = col.has("reference") ? String(cells[col.get("reference")] ?? "").trim() : "";
    const dateIso = col.has("date") ? parseDateIso(cells[col.get("date")]) : new Date().toISOString().slice(0, 10);
    const type = col.has("type") ? normType(cells[col.get("type")]) : "stock";
    const status = col.has("status") ? normStatusLabel(cells[col.get("status")]) : "Draft";
    const description = col.has("description") ? String(cells[col.get("description")] ?? "").trim() : "";

    const qty = parseMoney(qtyRaw);
    const unitPrice = parseMoney(priceRaw);
    if (!supplier) {
      errors.push({ sheetRow, message: "Supplier is required." });
      continue;
    }
    if (!product) {
      errors.push({ sheetRow, message: "Product is required." });
      continue;
    }
    if (!dateIso) {
      errors.push({ sheetRow, message: "Date must be valid (e.g. 2026-04-21)." });
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ sheetRow, message: "Qty must be a number greater than 0." });
      continue;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push({ sheetRow, message: "Unit Price must be a valid non-negative number." });
      continue;
    }

    const key = [supplier.toLowerCase(), reference.toLowerCase(), dateIso, type, status, description].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        supplier,
        reference,
        purchase_date: dateIso,
        purchase_type: type,
        status,
        description: description || null,
        lines: []
      });
    }
    groups.get(key).lines.push({
      product_name: product,
      qty,
      unit_price: unitPrice,
      tax_percent: 0
    });
  }

  for (const item of groups.values()) {
    purchases.push(item);
  }
  if (purchases.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { purchases, errors };
}

export async function parsePurchaseImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { purchases: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  }
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parsePurchaseImportRows(rowsAoA);
}

const TEMPLATE_HEADERS = [
  "Supplier",
  "Reference",
  "Date",
  "Type",
  "Status",
  "Description",
  "Product",
  "Qty",
  "Unit Price"
];

const TEMPLATE_EXAMPLES = [
  ["Apex Computers", "PO-100", "2026-04-21", "stock", "ordered", "Restock keyboards", "Keyboard K120", "20", "15.50"],
  ["Apex Computers", "PO-100", "2026-04-21", "stock", "ordered", "Restock keyboards", "Mouse M185", "20", "9.00"]
];

export async function downloadPurchaseImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  XLSX.utils.book_append_sheet(wb, ws, "Purchases");
  XLSX.writeFile(wb, `purchases-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
