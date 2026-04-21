function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = {
  expenseDate: ["date", "expense date", "expense_date"],
  title: ["title", "expense", "name"],
  category: ["category", "category name"],
  customer: ["customer", "customer name"],
  payee: ["payee"],
  amount: ["amount", "total"],
  paymentMode: ["payment mode", "payment_mode", "mode"],
  paymentStatus: ["status", "payment status", "payment_status"],
  notes: ["notes", "description"]
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

function normalizeMode(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "cash";
  const map = {
    cash: "cash",
    bank: "bank_transfer",
    bank_transfer: "bank_transfer",
    transfer: "bank_transfer",
    mpesa: "mpesa",
    m_pesa: "mpesa",
    card: "card",
    cheque: "cheque",
    check: "cheque",
    other: "other"
  };
  return map[v] ?? "other";
}

function normalizeStatus(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "Paid";
  if (["paid", "complete", "completed"].includes(v)) return "Paid";
  if (["unpaid", "pending", "due"].includes(v)) return "Unpaid";
  if (["partial", "partially paid"].includes(v)) return "Partial";
  return "Paid";
}

export function parseExpenseImportRows(rowsAoA) {
  const rows = [];
  const errors = [];

  if (!rowsAoA || rowsAoA.length < 2) {
    errors.push({ sheetRow: 1, message: "The file must include a header row and at least one data row." });
    return { rows, errors };
  }

  const headerRow = rowsAoA[0].map((c) => (c == null ? "" : String(c)));
  const col = mapHeaders(headerRow);
  for (const k of ["expenseDate", "title", "amount"]) {
    if (!col.has(k)) {
      const name = k === "expenseDate" ? "Date" : k === "title" ? "Title" : "Amount";
      errors.push({ sheetRow: 1, message: `Missing required column "${name}".` });
      return { rows, errors };
    }
  }

  for (let i = 1; i < rowsAoA.length; i++) {
    const cells = (rowsAoA[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (rowEmpty(cells)) continue;

    const sheetRow = i + 1;
    const expenseDate = String(cells[col.get("expenseDate")] ?? "").trim();
    const title = String(cells[col.get("title")] ?? "").trim();
    const amountRaw = String(cells[col.get("amount")] ?? "").trim();
    const amount = Number(amountRaw.replace(/,/g, ""));
    const category = col.has("category") ? String(cells[col.get("category")] ?? "").trim() : "";
    const customer = col.has("customer") ? String(cells[col.get("customer")] ?? "").trim() : "";
    const payee = col.has("payee") ? String(cells[col.get("payee")] ?? "").trim() : "";
    const notes = col.has("notes") ? String(cells[col.get("notes")] ?? "").trim() : "";
    const paymentMode = normalizeMode(col.has("paymentMode") ? cells[col.get("paymentMode")] : "");
    const paymentStatus = normalizeStatus(col.has("paymentStatus") ? cells[col.get("paymentStatus")] : "");

    if (!title) {
      errors.push({ sheetRow, message: "Title is required." });
      continue;
    }
    if (!expenseDate || Number.isNaN(Date.parse(expenseDate))) {
      errors.push({ sheetRow, message: "Date is required and must be valid." });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ sheetRow, message: "Amount must be a number greater than 0." });
      continue;
    }

    rows.push({
      sheetRow,
      expenseDate,
      title,
      amount,
      category: category || null,
      customer: customer || null,
      payee: payee || null,
      notes: notes || null,
      paymentMode,
      paymentStatus
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ sheetRow: 2, message: "No data rows found." });
  }
  return { rows, errors };
}

export async function parseExpenseImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseExpenseImportRows(rowsAoA);
}

const TEMPLATE_HEADERS = [
  "Date",
  "Title",
  "Amount",
  "Category",
  "Customer",
  "Payee",
  "Payment Mode",
  "Status",
  "Notes"
];

const TEMPLATE_EXAMPLES = [
  ["2026-04-21", "Office rent", "25000", "Rent", "Acme Ltd", "Landlord", "bank_transfer", "Paid", "April office rent"],
  ["2026-04-22", "Fuel top-up", "4500", "Transport", "", "Fuel Station", "cash", "Paid", ""]
];

export async function downloadExpenseImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, `expenses-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
