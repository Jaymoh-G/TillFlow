function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  name: ["name", "lead"],
  phone: ["phone"],
  email: ["email"],
  company: ["company"],
  location: ["location"],
  source: ["source"],
  status: ["status"],
  lastContactedAt: ["last_contacted_at", "last contacted at", "last contacted"]
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

function sanitizePhone(raw) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 20);
}

export function parseLeadsImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }
  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const req of ["name", "phone", "source", "status"]) {
    if (!col.has(req)) {
      errors.push({ sheetRow: 1, message: `Missing required column "${req}".` });
      return { rows, errors };
    }
  }
  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;
    const sheetRow = i + 1;
    const name = String(cells[col.get("name")] ?? "").trim();
    const phone = sanitizePhone(cells[col.get("phone")]);
    const source = String(cells[col.get("source")] ?? "").trim();
    const status = String(cells[col.get("status")] ?? "").trim();
    const email = col.has("email") ? String(cells[col.get("email")] ?? "").trim() : "";
    const company = col.has("company") ? String(cells[col.get("company")] ?? "").trim() : "";
    const location = col.has("location") ? String(cells[col.get("location")] ?? "").trim() : "";
    const lastContactedAt = col.has("lastContactedAt") ? String(cells[col.get("lastContactedAt")] ?? "").trim() : "";
    if (!name) {
      errors.push({ sheetRow, message: "name is required." });
      continue;
    }
    if (!phone) {
      errors.push({ sheetRow, message: "phone is required (digits only)." });
      continue;
    }
    if (!source) {
      errors.push({ sheetRow, message: "source is required." });
      continue;
    }
    if (!status) {
      errors.push({ sheetRow, message: "status is required." });
      continue;
    }
    rows.push({
      sheetRow,
      name,
      phone,
      source,
      status,
      email: email || null,
      company: company || null,
      location: location || null,
      last_contacted_at: lastContactedAt || null
    });
  }
  if (rows.length === 0 && errors.length === 0) errors.push({ sheetRow: 2, message: "No data rows found." });
  return { rows, errors };
}

export async function parseLeadsImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseLeadsImportRows(rowsAoA);
}

export async function downloadLeadsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "phone", "email", "company", "location", "source", "status", "last_contacted_at"],
    ["John Doe", "254712345678", "john@example.com", "Acme Ltd", "Nairobi", "Website", "NewLead", "2026-04-21T10:30"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `leads-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
