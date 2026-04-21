function normHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  name: ["name", "item", "product"],
  sku: ["sku", "barcode"],
  store_id: ["store_id", "store id"],
  category_id: ["category_id", "category id"],
  brand_id: ["brand_id", "brand id"],
  unit_id: ["unit_id", "unit id"],
  warranty_id: ["warranty_id", "warranty id"],
  buying_price: ["buying_price", "buying price"],
  selling_price: ["selling_price", "selling price"],
  qty: ["qty", "quantity"],
  qty_alert: ["qty_alert", "qty alert"],
  manufactured_at: ["manufactured_at", "manufactured at"],
  expires_at: ["expires_at", "expires at"]
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

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseItemsImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) return { rows, errors: [{ sheetRow: 1, message: "File must include header and data rows." }] };
  const col = mapHeaders(rowsAoA[0].map((c) => String(c ?? "")));
  if (!col.has("name")) return { rows, errors: [{ sheetRow: 1, message: 'Missing required column "name".' }] };
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => String(c ?? ""));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const name = String(cells[col.get("name")] ?? "").trim();
    if (!name) {
      errors.push({ sheetRow, message: "name is required." });
      continue;
    }
    const body = { sheetRow, name };
    for (const idKey of ["store_id", "category_id", "brand_id", "unit_id", "warranty_id"]) {
      if (col.has(idKey)) {
        const n = toNum(cells[col.get(idKey)]);
        if (n != null && n > 0) body[idKey] = n;
      }
    }
    if (col.has("sku")) {
      const sku = String(cells[col.get("sku")] ?? "").trim();
      if (sku) body.sku = sku;
    }
    if (col.has("buying_price")) {
      const n = toNum(cells[col.get("buying_price")]);
      if (n != null && n >= 0) body.buying_price = n;
    }
    if (col.has("selling_price")) {
      const n = toNum(cells[col.get("selling_price")]);
      if (n != null && n >= 0) body.selling_price = n;
    }
    if (body.buying_price != null && body.selling_price != null && body.selling_price <= body.buying_price) {
      errors.push({ sheetRow, message: "selling_price must be greater than buying_price." });
      continue;
    }
    if (col.has("qty")) {
      const n = toNum(cells[col.get("qty")]);
      if (n != null && n >= 0) body.qty = n;
    }
    if (col.has("qty_alert")) {
      const n = toNum(cells[col.get("qty_alert")]);
      if (n != null && n >= 0) body.qty_alert = n;
    }
    if (col.has("manufactured_at")) {
      const v = String(cells[col.get("manufactured_at")] ?? "").trim();
      if (v) body.manufactured_at = v;
    }
    if (col.has("expires_at")) {
      const v = String(cells[col.get("expires_at")] ?? "").trim();
      if (v) body.expires_at = v;
    }
    rows.push(body);
  }
  return { rows, errors };
}

export async function parseItemsImportFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseItemsImportRows(rowsAoA);
}

export async function downloadItemsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "sku", "store_id", "category_id", "brand_id", "unit_id", "buying_price", "selling_price", "qty", "qty_alert", "manufactured_at", "expires_at"],
    ["Sample Item A", "SKU-001", "1", "2", "3", "4", "100", "150", "20", "5", "2026-04-01", "2027-04-01"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  XLSX.writeFile(wb, `items-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
