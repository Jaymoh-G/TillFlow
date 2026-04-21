function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  group: ["group", "group key", "group_key"],
  fromStoreId: ["from_store_id", "from store id"],
  toStoreId: ["to_store_id", "to store id"],
  refNumber: ["ref_number", "reference", "ref"],
  notes: ["notes", "note"],
  productId: ["product_id", "product id"],
  qty: ["qty", "quantity"]
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

export function parseStockTransferImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["fromStoreId", "toStoreId", "productId", "qty"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  const groups = new Map();
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const fromStoreId = Number(String(cells[col.get("fromStoreId")] ?? "").trim());
    const toStoreId = Number(String(cells[col.get("toStoreId")] ?? "").trim());
    const productId = Number(String(cells[col.get("productId")] ?? "").trim());
    const qty = Number(String(cells[col.get("qty")] ?? "").replace(/[^0-9.-]/g, ""));
    const refNumber = col.has("refNumber") ? String(cells[col.get("refNumber")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    if (!Number.isFinite(fromStoreId) || fromStoreId < 1) {
      errors.push({ sheetRow, message: "from_store_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(toStoreId) || toStoreId < 1) {
      errors.push({ sheetRow, message: "to_store_id must be a positive number." });
      continue;
    }
    if (fromStoreId === toStoreId) {
      errors.push({ sheetRow, message: "from_store_id and to_store_id must differ." });
      continue;
    }
    if (!Number.isFinite(productId) || productId < 1) {
      errors.push({ sheetRow, message: "product_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ sheetRow, message: "qty must be greater than zero." });
      continue;
    }
    const groupKey =
      (col.has("group") ? String(cells[col.get("group")] ?? "").trim() : "") ||
      `${fromStoreId}|${toStoreId}|${refNumber}|${notes}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sheetRow,
        from_store_id: fromStoreId,
        to_store_id: toStoreId,
        ref_number: refNumber || null,
        notes: notes || null,
        lines: []
      });
    }
    groups.get(groupKey).lines.push({ product_id: productId, qty });
  }
  for (const g of groups.values()) rows.push(g);
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No valid data rows found." });
  return { rows, errors };
}

export async function parseStockTransferImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseStockTransferImportRows(rowsAoA);
}

export async function downloadStockTransferImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "from_store_id", "to_store_id", "ref_number", "product_id", "qty", "notes"],
    ["TR001", "1", "2", "TR-1001", "2001", "4", "Weekly restock move"],
    ["TR001", "1", "2", "TR-1001", "2002", "2", "Weekly restock move"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Stock Transfers");
  XLSX.writeFile(wb, `stock-transfer-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
