function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  group: ["group", "group_key", "group key"],
  invoiceId: ["invoice_id", "invoice id"],
  invoiceItemId: ["invoice_item_id", "invoice item id"],
  qty: ["qty", "quantity"],
  issuedAt: ["issued_at", "issued at", "issue date"],
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

export function parseCreditNotesImportRows(rowsAoA) {
  const groups = new Map();
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["invoiceId", "invoiceItemId", "qty"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const invoiceId = Number(String(cells[col.get("invoiceId")] ?? "").trim());
    const invoiceItemId = Number(String(cells[col.get("invoiceItemId")] ?? "").trim());
    const qty = Number(String(cells[col.get("qty")] ?? "").replace(/[^0-9.-]/g, ""));
    const issuedAtRaw = col.has("issuedAt") ? String(cells[col.get("issuedAt")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    const groupKeyRaw = col.has("group") ? String(cells[col.get("group")] ?? "").trim() : "";
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      errors.push({ sheetRow, message: "invoice_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(invoiceItemId) || invoiceItemId <= 0) {
      errors.push({ sheetRow, message: "invoice_item_id must be a positive number." });
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ sheetRow, message: "qty must be a number greater than 0." });
      continue;
    }
    let issuedAt = "";
    if (issuedAtRaw) {
      const d = new Date(issuedAtRaw);
      if (Number.isNaN(d.getTime())) {
        errors.push({ sheetRow, message: "issued_at/issue date must be a valid date." });
        continue;
      }
      issuedAt = d.toISOString().slice(0, 10);
    }
    const key = groupKeyRaw || `${invoiceId}|${issuedAt}|${notes}`;
    if (!groups.has(key)) {
      groups.set(key, {
        sheetRow,
        invoiceId: Math.floor(invoiceId),
        issued_at: issuedAt || undefined,
        notes: notes || null,
        items: []
      });
    }
    const g = groups.get(key);
    if (g.invoiceId !== Math.floor(invoiceId)) {
      errors.push({ sheetRow, message: `Group "${key}" mixes multiple invoice_id values.` });
      continue;
    }
    g.items.push({
      invoice_item_id: Math.floor(invoiceItemId),
      qty
    });
  }
  for (const g of groups.values()) rows.push(g);
  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parseCreditNotesImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseCreditNotesImportRows(rowsAoA);
}

export async function downloadCreditNotesImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "invoice_id", "invoice_item_id", "qty", "issued_at", "notes"],
    ["CN001", "101", "9001", "1", "2026-04-21", "Damaged item credit"],
    ["CN001", "101", "9002", "2", "2026-04-21", "Damaged item credit"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "CreditNotes");
  XLSX.writeFile(wb, `credit-notes-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
