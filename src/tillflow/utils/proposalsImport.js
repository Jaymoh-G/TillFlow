import { parseInvoicesImportRows } from "./invoicesImport";

export function parseProposalsImportRows(rowsAoA) {
  const base = parseInvoicesImportRows(rowsAoA);
  const rows = [];
  const errors = [...base.errors];
  for (const r of base.rows) {
    if (!r.customer_id) {
      errors.push({ sheetRow: r.sheetRow, message: "customer_id is required for proposal import." });
      continue;
    }
    rows.push({
      sheetRow: r.sheetRow,
      proposed_at: r.issued_at,
      status: "Draft",
      customer_id: r.customer_id,
      proposal_title: r.invoice_title,
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

export async function parseProposalsImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseProposalsImportRows(rowsAoA);
}

export async function downloadProposalsImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "customer_id", "proposed_at", "proposal_title", "product_id", "quantity", "unit_price", "tax_percent"],
    ["PR001", "10", "2026-04-21", "Imported proposal", "2001", "2", "1500", "16"],
    ["PR001", "10", "2026-04-21", "Imported proposal", "2002", "1", "800", "16"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Proposals");
  XLSX.writeFile(wb, `proposals-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
