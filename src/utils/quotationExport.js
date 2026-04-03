function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
}

/**
 * @param {Array<{ quoteRef?: string, quotedDate?: string, Product_Name?: string, Custmer_Name?: string, Total?: string | number, Status?: string }>} rows
 */
function rowsToExportRecords(rows) {
  return rows.map((r) => ({
    "Quote #": String(r.quoteRef ?? ""),
    Date: String(r.quotedDate ?? ""),
    Product: String(r.productsExportLabel ?? r.Product_Name ?? ""),
    Customer: String(r.Custmer_Name ?? ""),
    Total: typeof r.Total === "number" ? formatMoney(r.Total) : String(r.Total ?? ""),
    Status: String(r.Status ?? "")
  }));
}

export async function downloadQuotationsExcel(rows) {
  const XLSX = await import("xlsx");
  const data = rowsToExportRecords(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quotations");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `quotations-${date}.xlsx`);
}

export async function downloadQuotationsPdf(rows) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Quotations", 14, 16);
  const body = rows.map((r) => [
    String(r.quoteRef ?? ""),
    String(r.quotedDate ?? ""),
    String(r.productsExportLabel ?? r.Product_Name ?? ""),
    String(r.Custmer_Name ?? ""),
    typeof r.Total === "number" ? formatMoney(r.Total) : String(r.Total ?? ""),
    String(r.Status ?? "")
  ]);
  autoTable(doc, {
    startY: 22,
    head: [["Quote #", "Date", "Product", "Customer", "Total", "Status"]],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [65, 158, 221] }
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`quotations-${date}.pdf`);
}
