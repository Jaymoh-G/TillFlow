/**
 * @param {Array<{ code?: string, biller?: string, company?: string, email?: string, phone?: string, location?: string, status?: string }>} rows
 * @returns {Record<string, string>[]}
 */
function rowsToExportRecords(rows) {
  return rows.map((r) => ({
    Code: String(r.code ?? ""),
    Name: String(r.biller ?? ""),
    Company: String(r.company ?? ""),
    Email: String(r.email ?? ""),
    Phone: String(r.phone ?? ""),
    Location: String(r.location ?? ""),
    Status: String(r.status ?? "")
  }));
}

/**
 * @param {Array<{ code?: string, biller?: string, company?: string, email?: string, phone?: string, location?: string, status?: string }>} rows
 */
export async function downloadBillersExcel(rows) {
  const XLSX = await import("xlsx");
  const data = rowsToExportRecords(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Billers");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `billers-${date}.xlsx`);
}

/**
 * @param {Array<{ code?: string, biller?: string, company?: string, email?: string, phone?: string, location?: string, status?: string }>} rows
 */
export async function downloadBillersPdf(rows) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Billers", 14, 16);
  const body = rows.map((r) => [
    String(r.code ?? ""),
    String(r.biller ?? ""),
    String(r.company ?? ""),
    String(r.email ?? ""),
    String(r.phone ?? ""),
    String(r.location ?? ""),
    String(r.status ?? "")
  ]);
  autoTable(doc, {
    startY: 22,
    head: [["Code", "Name", "Company", "Email", "Phone", "Location", "Status"]],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [65, 158, 221] }
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`billers-${date}.pdf`);
}
