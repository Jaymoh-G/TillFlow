export async function downloadRowsExcel(records, sheetName, filePrefix) {
  if (!Array.isArray(records) || records.length === 0) {
    return;
  }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName || "Sheet1").slice(0, 31));
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filePrefix}-${date}.xlsx`);
}

export async function downloadRowsPdf(title, head, body, filePrefix) {
  if (!Array.isArray(body) || body.length === 0) {
    return;
  }
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(String(title || "Export"), 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [33, 37, 41] },
    theme: "striped"
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${filePrefix}-${date}.pdf`);
}
