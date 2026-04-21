function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  productId: ["product_id", "product id"],
  storeId: ["store_id", "store id"],
  type: ["type"],
  quantity: ["quantity", "qty"],
  reference: ["reference", "ref"],
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

function parseType(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "add" || s === "addition" || s === "+") return "add";
  if (s === "remove" || s === "deduct" || s === "-" || s === "sub") return "remove";
  return null;
}

export function parseStockAdjustmentImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["productId", "storeId", "type", "quantity"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const productId = Number(String(cells[col.get("productId")] ?? "").trim());
    const storeId = Number(String(cells[col.get("storeId")] ?? "").trim());
    const type = parseType(cells[col.get("type")]);
    const quantity = Number(String(cells[col.get("quantity")] ?? "").replace(/[^0-9.-]/g, ""));
    const reference = col.has("reference") ? String(cells[col.get("reference")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    if (!Number.isFinite(productId) || productId < 1) {
      errors.push({ sheetRow, message: "product_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(storeId) || storeId < 1) {
      errors.push({ sheetRow, message: "store_id must be a positive number." });
      continue;
    }
    if (!type) {
      errors.push({ sheetRow, message: 'type must be "add" or "remove".' });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ sheetRow, message: "quantity must be greater than zero." });
      continue;
    }
    rows.push({
      sheetRow,
      product_id: productId,
      store_id: storeId,
      type,
      quantity,
      reference: reference || null,
      notes: notes || null
    });
  }
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No valid data rows found." });
  return { rows, errors };
}

export async function parseStockAdjustmentImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseStockAdjustmentImportRows(rowsAoA);
}

export async function downloadStockAdjustmentImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["product_id", "store_id", "type", "quantity", "reference", "notes"],
    ["2001", "1", "add", "10", "PO-1001", "Opening stock"],
    ["2001", "1", "remove", "2", "DMG-22", "Damaged items"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Stock Adjustments");
  XLSX.writeFile(wb, `stock-adjustment-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
