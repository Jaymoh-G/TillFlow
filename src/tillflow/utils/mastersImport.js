function normHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function rowEmpty(cells) {
  return cells.every((c) => String(c ?? "").trim() === "");
}

export function parseSimpleNameRows(rowsAoA, opts = {}) {
  const {
    requiredHeaders = ["name"],
    aliases = { name: ["name"] },
    buildRow,
    missingMessage = "Missing required name column."
  } = opts;
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) return { rows, errors: [{ sheetRow: 1, message: "File must include header and data rows." }] };
  const header = rowsAoA[0].map((c) => normHeader(c));
  const col = new Map();
  for (const [key, values] of Object.entries(aliases)) {
    const idx = header.findIndex((h) => values.includes(h));
    if (idx >= 0) col.set(key, idx);
  }
  for (const req of requiredHeaders) {
    if (!col.has(req)) return { rows, errors: [{ sheetRow: 1, message: missingMessage }] };
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => String(c ?? ""));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const row = buildRow({ cells, col, sheetRow });
    if (row?.error) errors.push({ sheetRow, message: row.error });
    else rows.push(row);
  }
  return { rows, errors };
}

export async function parseXlsxRows(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
}

export async function writeTemplate(filenamePrefix, sheetName, headerRow, sampleRow) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
