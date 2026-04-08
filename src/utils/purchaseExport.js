/**
 * @param {Array<{
 *   supplierName?: string,
 *   reference?: string,
 *   date?: string,
 *   purchaseType?: string,
 *   status?: string,
 *   total?: string,
 *   paid?: string,
 *   due?: string,
 *   orderedQty?: number|string,
 *   remainingQty?: number|string,
 *   paymentStatus?: string
 * }>} rows
 */
function rowsToExportRecords(rows) {
  return rows.map((r) => ({
    Supplier: String(r.supplierName ?? ""),
    Reference: String(r.reference ?? ""),
    Date: String(r.date ?? ""),
    Type: String(r.purchaseType ?? ""),
    Status: String(r.status ?? ""),
    Total: String(r.total ?? ""),
    Paid: String(r.paid ?? ""),
    Due: String(r.due ?? ""),
    "Ordered Qty": String(r.orderedQty ?? ""),
    "Remaining Qty": String(r.remainingQty ?? ""),
    Payment: String(r.paymentStatus ?? "")
  }));
}

/**
 * @param {Parameters<typeof rowsToExportRecords>[0]} rows
 */
export async function downloadPurchasesExcel(rows) {
  const XLSX = await import("xlsx");
  const data = rowsToExportRecords(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchases");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `purchases-${date}.xlsx`);
}

/**
 * @param {Parameters<typeof rowsToExportRecords>[0]} rows
 */
export async function downloadPurchasesPdf(rows) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Purchases", 14, 16);
  const body = rows.map((r) => [
    String(r.supplierName ?? ""),
    String(r.reference ?? ""),
    String(r.date ?? ""),
    String(r.purchaseType ?? ""),
    String(r.status ?? ""),
    String(r.total ?? ""),
    String(r.paid ?? ""),
    String(r.due ?? ""),
    String(r.orderedQty ?? ""),
    String(r.remainingQty ?? ""),
    String(r.paymentStatus ?? "")
  ]);
  autoTable(doc, {
    startY: 22,
    head: [[
      "Supplier",
      "Reference",
      "Date",
      "Type",
      "Status",
      "Total",
      "Paid",
      "Due",
      "Ordered Qty",
      "Remaining Qty",
      "Payment"
    ]],
    body,
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [30, 58, 138] }
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`purchases-${date}.pdf`);
}
