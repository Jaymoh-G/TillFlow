import { parseCreditNotesImportRows } from "./creditNotesImport";

export function parseDeliveryNotesImportRows(rowsAoA) {
  return parseCreditNotesImportRows(rowsAoA);
}

export async function parseDeliveryNotesImportFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ sheetRow: 1, message: "Workbook has no sheets." }] };
  const ws = wb.Sheets[sheetName];
  const rowsAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return parseDeliveryNotesImportRows(rowsAoA);
}

export async function downloadDeliveryNotesImportTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["group", "invoice_id", "invoice_item_id", "qty", "issued_at", "notes"],
    ["DN001", "101", "9001", "1", "2026-04-21", "Dispatch note"],
    ["DN001", "101", "9002", "2", "2026-04-21", "Dispatch note"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "DeliveryNotes");
  XLSX.writeFile(wb, `delivery-notes-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
