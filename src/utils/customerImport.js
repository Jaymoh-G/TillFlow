/**
 * Parse customer spreadsheets for Tillflow import (Name, Phone, Email required).
 */

/** @param {string} s */
export function isValidCustomerEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

/**
 * @param {string} raw
 * @returns {'Active'|'Inactive'}
 */
export function parseCustomerStatus(raw) {
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

function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** @type {Record<string, string[]>} canonical key -> header forms after normHeader */
const HEADER_ALIASES = {
  code: ["code"],
  name: ["name", "customer"],
  phone: ["phone"],
  email: ["email"],
  company: ["company"],
  taxid: ["tax id", "taxid", "tax_id", "tax-id"],
  category: ["category", "customer category"],
  createdat: ["created at", "created_at", "createdat", "created date"],
  location: ["location"],
  status: ["status"]
};

/**
 * @param {string[]} headerCells
 * @returns {Map<string, number>}
 */
function mapHeaders(headerCells) {
  /** @type {Map<string, number>} */
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

/**
 * @typedef {Object} ParsedCustomerRow
 * @property {string} name
 * @property {string} phone
 * @property {string} email
 * @property {string|null} company
 * @property {string|null} taxId
 * @property {string|null} category
 * @property {string|null} createdAt
 * @property {string|null} location
 * @property {'Active'|'Inactive'} status
 * @property {number} sheetRow 1-based sheet row number (for display)
 */

/**
 * @param {unknown[][]} rowsAoA first row = headers
 * @returns {{ rows: ParsedCustomerRow[], errors: { sheetRow: number, message: string }[] }}
 */
export function parseCustomerImportRows(rowsAoA) {
  /** @type {ParsedCustomerRow[]} */
  const rows = [];
  /** @type { { sheetRow: number, message: string }[]} */
  const errors = [];

  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }

  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);

  const req = ["name", "phone", "email"];
  for (const k of req) {
    if (!col.has(k)) {
      errors.push({
        sheetRow: 1,
        message: `Missing required column "${k === "name" ? "Name" : k === "phone" ? "Phone" : "Email"}".`
      });
      return { rows, errors };
    }
  }

  for (let i = 1; i < rowsAoA.length; i++) {
    const line = rowsAoA[i] ?? [];
    const cells = line.map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) {
      continue;
    }

    const sheetRow = i + 1;
    const name = String(cells[col.get("name")] ?? "").trim();
    const phone = String(cells[col.get("phone")] ?? "").trim();
    const email = String(cells[col.get("email")] ?? "").trim();
    const companyCol = col.get("company");
    const taxCol = col.get("taxid");
    const categoryCol = col.get("category");
    const createdAtCol = col.get("createdat");
    const locCol = col.get("location");
    const stCol = col.get("status");

    const company = companyCol != null ? String(cells[companyCol] ?? "").trim() : "";
    const taxId = taxCol != null ? String(cells[taxCol] ?? "").trim() : "";
    const category = categoryCol != null ? String(cells[categoryCol] ?? "").trim() : "";
    const createdAt = createdAtCol != null ? String(cells[createdAtCol] ?? "").trim() : "";
    const location = locCol != null ? String(cells[locCol] ?? "").trim() : "";
    const statusRaw = stCol != null ? cells[stCol] : "";

    if (!name) {
      errors.push({ sheetRow, message: "Name is required." });
      continue;
    }
    if (!phone) {
      errors.push({ sheetRow, message: "Phone is required." });
      continue;
    }
    if (!email) {
      errors.push({ sheetRow, message: "Email is required." });
      continue;
    }
    if (!isValidCustomerEmail(email)) {
      errors.push({ sheetRow, message: "Invalid email address." });
      continue;
    }
    if (createdAt && Number.isNaN(Date.parse(createdAt))) {
      errors.push({ sheetRow, message: "Invalid Created At value. Use a valid date/time." });
      continue;
    }

    const status = parseCustomerStatus(statusRaw);

    rows.push({
      name,
      phone,
      email,
      company: company || null,
      taxId: taxId || null,
      category: category || null,
      createdAt: createdAt || null,
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

/**
 * @param {File} file
 * @returns {Promise<{ rows: ParsedCustomerRow[], errors: { sheetRow: number, message: string }[] }>}
 */
export async function parseCustomerImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  }
  const ws = wb.Sheets[sheetName];
  /** @type {unknown[][]} */
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseCustomerImportRows(rowsAoA);
}

const TEMPLATE_HEADERS = [
  "Code",
  "Name",
  "Email",
  "Phone",
  "Company",
  "Tax ID",
  "Category",
  "Created At",
  "Location",
  "Status"
];

/** Example rows for template (Code is informational). */
const TEMPLATE_EXAMPLES = [
  [
    "(auto)",
    "Jane Doe",
    "jane@example.com",
    "+15551234567",
    "Acme Ltd",
    "VAT123",
    "Wholesale",
    "2026-04-01 10:30:00",
    "London",
    "Active"
  ],
  ["(auto)", "John Smith", "john.smith@example.com", "+15559876543", "", "", "Retail", "", "Manchester", "Inactive"]
];

const TEMPLATE_INSTRUCTIONS = [
  ["Customer Import Template Guide"],
  [""],
  ["How to use"],
  ["1) Keep the first row headers unchanged."],
  ["2) Fill one customer per row in the Customers sheet."],
  ["3) Required fields: Name, Email, Phone."],
  ['4) Status accepts: "Active" or "Inactive" (blank defaults to Active).'],
  ["5) Code is optional and ignored during import (system assigns code automatically)."],
  [""],
  ["Column reference"],
  ["Code", "Optional", "Reference only; ignored on import."],
  ["Name", "Required", "Customer full name."],
  ["Email", "Required", "Valid email format, must be unique."],
  ["Phone", "Required", "Phone number, must be unique."],
  ["Company", "Optional", "Customer company name."],
  ["Tax ID", "Optional", "Tax registration identifier."],
  ["Category", "Optional", "Customer segment/category (for example Retail, Wholesale, VIP)."],
  ["Created At", "Optional", "Creation date/time (for example 2026-04-01 10:30:00)."],
  ["Location", "Optional", "City/area/address."],
  ["Status", "Optional", "Active or Inactive."]
];

/**
 * Download an empty customer import template (.xlsx).
 */
export async function downloadCustomerImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const customersWs = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  const guideWs = XLSX.utils.aoa_to_sheet(TEMPLATE_INSTRUCTIONS);
  XLSX.utils.book_append_sheet(wb, customersWs, "Customers");
  XLSX.utils.book_append_sheet(wb, guideWs, "How To Use");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `customers-import-template-${date}.xlsx`);
}
