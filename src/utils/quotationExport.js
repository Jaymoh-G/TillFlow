import {
  QUOTATION_FOOTER_DEFAULTS,
  compactQuotationFooterBankLine
} from "./companySettingsStorage";
import {
  HTML_DOCUMENT_PDF_MARGIN_MM,
  downloadHtmlDocumentPdfFromElement,
  htmlDocumentPdfBlobFromElement,
  waitForPrintRootImages
} from "./htmlDocumentPdfExport";

const QUOTATION_DETAIL_PDF_MARGIN_MM = HTML_DOCUMENT_PDF_MARGIN_MM;

export { waitForPrintRootImages };

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
}

function formatTotalKsh(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh ${num}`;
}

/**
 * @param {Array<{ quoteRef?: string, quotedDate?: string, expiresAtIso?: string | null, Product_Name?: string, Custmer_Name?: string, Total?: string | number, Status?: string }>} rows
 */
function rowsToExportRecords(rows) {
  return rows.map((r) => ({
    "Quote #": String(r.quoteRef ?? ""),
    Title: String(r.quoteTitle ?? "").trim(),
    Date: String(r.quotedDate ?? ""),
    Expiry: r.expiresAtIso ? String(r.expiresAtIso) : "",
    Product: String(r.productsExportLabel ?? r.Product_Name ?? ""),
    Customer: String(r.Custmer_Name ?? ""),
    Total: typeof r.Total === "number" ? formatTotalKsh(r.Total) : String(r.Total ?? ""),
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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Quotations", 14, 16);
  const body = rows.map((r) => [
    String(r.quoteRef ?? ""),
    String(r.quoteTitle ?? "").trim() || "—",
    String(r.quotedDate ?? ""),
    r.expiresAtIso ? String(r.expiresAtIso) : "—",
    String(r.productsExportLabel ?? r.Product_Name ?? ""),
    String(r.Custmer_Name ?? ""),
    typeof r.Total === "number" ? formatTotalKsh(r.Total) : String(r.Total ?? ""),
    String(r.Status ?? "")
  ]);
  autoTable(doc, {
    startY: 22,
    head: [["Quote #", "Title", "Date", "Expiry", "Product", "Customer", "Total", "Status"]],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [65, 158, 221] }
  });
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`quotations-${date}.pdf`);
}

function formatKesPdf(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh ${num}`;
}

function formatUsdPdf(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
}

/**
 * Same raster pipeline as quotation “Download PDF” — returns a Blob (e.g. email attachment).
 * @param {HTMLElement} element
 * @param {{ quoteRef?: string, cloneHook?: (el: HTMLElement) => void }} [options]
 */
export async function quotationDetailPdfBlobFromElement(element, options = {}) {
  return htmlDocumentPdfBlobFromElement(element, options);
}

/**
 * Quotation detail → multi-page PDF download (uses shared htmlDocumentPdfExport).
 * @param {HTMLElement} element — `.quotation-view-print-root`
 * @param {{ quoteRef?: string, cloneHook?: (el: HTMLElement) => void }} [options]
 */
export async function downloadQuotationDetailPdfFromElement(element, options = {}) {
  const safeRef = String(options.quoteRef ?? "quotation").replace(/[^\w.-]+/g, "_");
  return downloadHtmlDocumentPdfFromElement(element, {
    ...options,
    fileSlug: `quotation-${safeRef}`
  });
}

/**
 * Single-quotation PDF (detail view) — programmatic layout fallback when DOM capture is unavailable.
 * @param {object} row — view row (quoteRef, quotedDate, expiresAtIso, Custmer_Name, Status, termsAndConditions, clientNote, Biller_Name, productsExportLabel, Product_Name)
 * @param {object} vm — buildQuotationViewTableModel result: rows, subEx, taxAmt, discountAmt, discountLabel, grandTotal, dtype
 * @param {{ useKes?: boolean }} [options]
 */
export async function downloadQuotationDetailPdf(row, vm, options = {}) {
  const { useKes = true } = options;
  if (!row || !vm) {
    return;
  }
  const fmt = useKes ? formatKesPdf : formatUsdPdf;
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = QUOTATION_DETAIL_PDF_MARGIN_MM;
  let y = margin + 4;
  const ensureSpace = (needMm) => {
    if (y + needMm > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFontSize(16);
  doc.setTextColor(33, 43, 54);
  doc.text(`Quotation ${String(row.quoteRef ?? "")}`, margin, y);
  y += 6;
  const quoteTitle = String(row.quoteTitle ?? "").trim() || "—";
  doc.setFontSize(11);
  doc.setTextColor(33, 43, 54);
  doc.text(`Quotation for : ${quoteTitle}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(33, 43, 54);
  doc.text(`Quote date: ${String(row.quotedDate ?? "")}`, margin, y);
  y += 5;
  const exp = row.expiresAtIso ? String(row.expiresAtIso).slice(0, 10) : "—";
  doc.text(`Valid until: ${exp}`, margin, y);
  y += 5;
  doc.text(`Customer: ${String(row.Custmer_Name ?? "")}`, margin, y);
  y += 5;
  doc.text(`Status: ${String(row.Status ?? "")}`, margin, y);
  y += 8;

  const body = vm.rows.map((r, ix) => {
    const desc = r.desc ? `${r.title}\n${r.desc}` : r.title;
    return [String(ix + 1), desc, String(r.qty), fmt(r.unit), fmt(r.lineTotal)];
  });

  const boldRight = (text, fontSize = 10) => ({
    content: text,
    styles: { halign: "right", fontStyle: "bold", fontSize }
  });
  const boldAmt = (s, fontSize = 10) => ({
    content: s,
    styles: { halign: "right", fontStyle: "bold", fontSize }
  });
  const rollupFs = 10;
  const totalFs = 9;
  const foot = [["", "", "", boldRight("Sub Total", rollupFs), boldAmt(fmt(vm.subEx), rollupFs)]];
  if (vm.dtype !== "none") {
    const discLabel = String(vm.discountLabel ?? "");
    foot.push([
      "",
      "",
      "",
      boldRight(discLabel, rollupFs),
      boldAmt(`−${fmt(vm.discountAmt)}`, rollupFs)
    ]);
  }
  foot.push(["", "", "", boldRight("Tax", rollupFs), boldAmt(fmt(vm.taxAmt), rollupFs)]);
  foot.push(["", "", "", boldRight("Total", totalFs), boldAmt(fmt(vm.grandTotal), totalFs)]);

  const head = [["#", "Item", "Qty", "Rate", "Amount"]];
  const columnStyles = {
    0: { cellWidth: 12, halign: "center" },
    1: { cellWidth: 80 },
    2: { cellWidth: 18, halign: "right" },
    3: { cellWidth: 33, halign: "right" },
    4: { cellWidth: 33, halign: "right" }
  };

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    styles: { fontSize: 8, cellPadding: { top: 0.75, right: 1, bottom: 0.75, left: 1 }, overflow: "linebreak" },
    headStyles: { fillColor: [66, 66, 66], textColor: 255 },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [33, 43, 54],
      fontSize: 10,
      fontStyle: "bold",
      cellPadding: { top: 0.75, right: 1, bottom: 0.75, left: 1 }
    },
    columnStyles,
    margin: { left: margin, right: margin }
  });

  const tableEnd = doc.lastAutoTable?.finalY ?? y + 40;
  y = tableEnd + 10;

  const terms = String(row.termsAndConditions ?? "").trim();
  if (terms) {
    ensureSpace(40);
    doc.setFontSize(8);
    doc.setTextColor(33, 43, 54);
    doc.text("Terms & conditions", margin, y);
    y += 4;
    doc.setFontSize(7);
    const termLines = doc.splitTextToSize(terms, pageW - 2 * margin);
    doc.text(termLines, margin, y);
    y += termLines.length * 3.2 + 4;
  }

  const note = String(row.clientNote ?? "").trim();
  if (note) {
    ensureSpace(40);
    doc.setFontSize(8);
    doc.setTextColor(33, 43, 54);
    doc.text("Client note", margin, y);
    y += 4;
    doc.setFontSize(7);
    const noteLines = doc.splitTextToSize(note, pageW - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 3.2 + 4;
  }

  y += 4;
  ensureSpace(36);
  doc.setDrawColor(222, 226, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const payWrapped = doc.splitTextToSize(
    QUOTATION_FOOTER_DEFAULTS.paymentLine,
    pageW - 2 * margin
  );
  doc.text(payWrapped, margin, y);
  y += payWrapped.length * 3.2 + 3;
  const bankWrapped = doc.splitTextToSize(
    compactQuotationFooterBankLine(QUOTATION_FOOTER_DEFAULTS.bankLine),
    pageW - 2 * margin
  );
  doc.text(bankWrapped, margin, y);
  y += bankWrapped.length * 3.2 + 3;
  const closeWrapped = doc.splitTextToSize(
    QUOTATION_FOOTER_DEFAULTS.closingLine,
    pageW - 2 * margin
  );
  doc.text(closeWrapped, margin, y);

  const safeRef = String(row.quoteRef ?? "quotation").replace(/[^\w.-]+/g, "_");
  doc.save(`quotation-${safeRef}.pdf`);
}
