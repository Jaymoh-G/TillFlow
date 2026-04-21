function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  name: ["name", "store_name", "store name"],
  location: ["location"],
  code: ["code", "store_code", "store code"]
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

export function parseStoresImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  if (!col.has("name")) {
    errors.push({ sheetRow: 1, message: 'Missing required column "name".' });
    return { rows, errors };
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const name = String(cells[col.get("name")] ?? "").trim();
    const location = col.has("location") ? String(cells[col.get("location")] ?? "").trim() : "";
    const code = col.has("code") ? String(cells[col.get("code")] ?? "").trim() : "";
    if (!name) {
      errors.push({ sheetRow, message: "name is required." });
      continue;
    }
    rows.push({
      sheetRow,
      name,
      store_name: name,
      location: location || null,
      code: code || null
    });
  }
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No valid data rows found." });
  return { rows, errors };
}

export async function parseStoresImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseStoresImportRows(rowsAoA);
}

export async function downloadStoresImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "location", "code"],
    ["Main outlet", "Nairobi CBD", "ST-001"],
    ["Warehouse", "Industrial Area", "ST-002"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Stores");
  XLSX.writeFile(wb, `stores-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
