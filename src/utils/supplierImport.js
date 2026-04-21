function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  code: ["code"],
  name: ["name", "supplier", "supplier name", "supplier_name"],
  email: ["email"],
  phone: ["phone"],
  location: ["location"],
  status: ["status"]
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

export function isValidSupplierEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

function parseSupplierStatus(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!t) {
    return "Active";
  }
  if (["inactive", "0", "no", "false", "n", "off"].includes(t)) {
    return "Inactive";
  }
  if (["active", "1", "yes", "true", "y", "on"].includes(t)) {
    return "Active";
  }
  return "Active";
}

/**
 * @param {unknown[][]} rowsAoA
 * @returns {{ rows: Array<{ name: string, phone: string, email: string|null, location: string|null, status: string, sheetRow: number }>, errors: Array<{ sheetRow: number, message: string }>}}
 */
export function parseSupplierImportRows(rowsAoA) {
  const rows = [];
  const errors = [];
  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }

  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);

  for (const req of ["name", "phone"]) {
    if (!col.has(req)) {
      const label = req === "name" ? "Name" : "Phone";
      errors.push({ sheetRow: 1, message: `Missing required column "${label}".` });
      return { rows, errors };
    }
  }

  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) {
      continue;
    }
    const sheetRow = i + 1;
    const name = String(cells[col.get("name")] ?? "").trim();
    const phone = String(cells[col.get("phone")] ?? "").trim();
    const email = col.has("email") ? String(cells[col.get("email")] ?? "").trim() : "";
    const location = col.has("location") ? String(cells[col.get("location")] ?? "").trim() : "";
    const status = col.has("status") ? parseSupplierStatus(cells[col.get("status")]) : "Active";

    if (!name) {
      errors.push({ sheetRow, message: "Name is required." });
      continue;
    }
    if (!phone) {
      errors.push({ sheetRow, message: "Phone is required." });
      continue;
    }
    if (email && !isValidSupplierEmail(email)) {
      errors.push({ sheetRow, message: "Invalid email address." });
      continue;
    }

    rows.push({
      name,
      phone,
      email: email || null,
      location: location || null,
      status,
      sheetRow
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parseSupplierImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  }
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseSupplierImportRows(rowsAoA);
}

const TEMPLATE_HEADERS = ["Code", "Name", "Email", "Phone", "Location", "Status"];
const TEMPLATE_EXAMPLE = ["(auto)", "Acme Supplies", "ops@acme.example", "+15551234567", "Nairobi", "Active"];

export async function downloadSupplierImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `suppliers-import-template-${date}.xlsx`);
}
