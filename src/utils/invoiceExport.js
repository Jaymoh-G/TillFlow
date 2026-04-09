/**
 * @param {Array<{
 *   invoiceno?: string,
 *   customer?: string,
 *   issueDate?: string,
 *   duedate?: string,
 *   status?: string,
 *   amount?: string,
 *   paid?: string,
 *   amountdue?: string
 * }>} rows
 */
function rowsToExportRecords(rows) {
  return (rows || []).map((r) => ({
    "Invoice No": String(r.invoiceno ?? ""),
    Customer: String(r.customer ?? ""),
    Issued: String(r.issueDate ?? ""),
    "Due Date": String(r.duedate ?? ""),
    Status: String(r.status ?? "").replace(/_/g, " "),
    Total: String(r.amount ?? ""),
    Paid: String(r.paid ?? ""),
    "Amount Due": String(r.amountdue ?? "")
  }));
}

/**
 * @param {Parameters<typeof rowsToExportRecords>[0]} rows
 */
export async function downloadInvoicesExcel(rows) {
  const XLSX = await import("xlsx");
  const data = rowsToExportRecords(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `invoices-${date}.xlsx`);
}

/**
 * @param {Parameters<typeof rowsToExportRecords>[0]} rows
 */
export async function downloadInvoicesPdf(rows) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Invoices", 14, 16);
  const body = (rows || []).map((r) => [
    String(r.invoiceno ?? ""),
    String(r.customer ?? ""),
    String(r.issueDate ?? ""),
    String(r.duedate ?? ""),
    String(r.status ?? "").replace(/_/g, " "),
    String(r.amount ?? ""),
    String(r.paid ?? ""),
    String(r.amountdue ?? "")
  ]);
  autoTable(doc, {
    startY: 22,
    head: [[
      "Invoice No",
      "Customer",
      "Issued",
      "Due Date",
      "Status",
      "Total",
      "Paid",
      "Amount Due"
    ]],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] }
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`invoices-${date}.pdf`);
}

