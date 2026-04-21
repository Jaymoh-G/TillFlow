import { parseInvoicesImportRows } from "./invoicesImport";

export function parseQuotationsImportRows(rowsAoA) {
  const base = parseInvoicesImportRows(rowsAoA);
  const rows = [];
  const errors = [...base.errors];
  for (const r of base.rows) {
    if (!r.customer_id) {
      errors.push({ sheetRow: r.sheetRow, message: "customer_id is required for quotation import." });
      continue;
    }
    rows.push({
      sheetRow: r.sheetRow,
      quote_date: r.issued_at,
      expiry_date: r.due_at,
      customer_id: r.customer_id,
      status: "Draft",
      items: r.items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.qty,
        unit_price: it.unit_price,
        tax_percent: it.tax_percent
      }))
    });
  }
  return { rows, errors };
}

export async function parseQuotationsImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseQuotationsImportRows(rowsAoA);
}

export async function downloadQuotationsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "customer_id", "quote_date", "expiry_date", "product_id", "quantity", "unit_price", "tax_percent"],
    ["QT001", "10", "2026-04-21", "2026-05-21", "2001", "2", "1500", "16"],
    ["QT001", "10", "2026-04-21", "2026-05-21", "2002", "1", "800", "16"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Quotations");
  XLSX.writeFile(wb, `quotations-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
