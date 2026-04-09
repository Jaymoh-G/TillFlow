import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    Date: r.expenseDate || "",
    Title: r.title || "",
    Category: r.categoryName || "",
    Customer: r.customerName || "",
    Payee: r.payee || "",
    "Payment Mode": r.paymentMode || "",
    Status: r.paymentStatus || "",
    Amount: typeof r.amount === "number" ? r.amount.toFixed(2) : Number(r.amount || 0).toFixed(2)
  }));
}

export async function downloadExpensesExcel(rows) {
  const normalized = normalizeRows(rows);
  const ws = XLSX.utils.json_to_sheet(normalized);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadExpensesPdf(rows) {
  const normalized = normalizeRows(rows);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(13);
  doc.text("Expenses", 40, 36);
  autoTable(doc, {
    startY: 52,
    head: [["Date", "Title", "Category", "Customer", "Payee", "Payment Mode", "Status", "Amount"]],
    body: normalized.map((r) => [
      r.Date,
      r.Title,
      r.Category,
      r.Customer,
      r.Payee,
      r["Payment Mode"],
      r.Status,
      r.Amount
    ]),
    styles: { fontSize: 8, cellPadding: 4 }
  });
  doc.save(`expenses-${new Date().toISOString().slice(0, 10)}.pdf`);
}

