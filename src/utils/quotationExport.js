function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
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
    typeof r.Total === "number" ? formatMoney(r.Total) : String(r.Total ?? ""),
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

/** ~A4 width at 96dpi — widens capture so the bitmap matches paper width (avoids side letterboxing). */
const PDF_CAPTURE_TARGET_WIDTH_PX = Math.round((210 / 25.4) * 96);

/**
 * Crops uniform light borders from html2canvas output (extra scroll/whitespace).
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement}
 */
function trimCanvasLightBorders(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const w = canvas.width;
  const h = canvas.height;
  if (w < 2 || h < 2) {
    return canvas;
  }
  const threshold = 248;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const isLight = (idx) => d[idx] >= threshold && d[idx + 1] >= threshold && d[idx + 2] >= threshold;

  let top = 0;
  outerTop: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isLight((y * w + x) * 4)) {
        top = y;
        break outerTop;
      }
    }
  }

  let bottom = h - 1;
  outerBottom: for (let y = h - 1; y >= top; y--) {
    for (let x = 0; x < w; x++) {
      if (!isLight((y * w + x) * 4)) {
        bottom = y;
        break outerBottom;
      }
    }
  }

  let left = 0;
  outerLeft: for (let x = 0; x < w; x++) {
    for (let y = top; y <= bottom; y++) {
      if (!isLight((y * w + x) * 4)) {
        left = x;
        break outerLeft;
      }
    }
  }

  let right = w - 1;
  outerRight: for (let x = w - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) {
      if (!isLight((y * w + x) * 4)) {
        right = x;
        break outerRight;
      }
    }
  }

  const tw = right - left + 1;
  const th = bottom - top + 1;
  if (tw < 8 || th < 8 || (tw === w && th === h)) {
    return canvas;
  }

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d");
  if (!octx) {
    return canvas;
  }
  octx.drawImage(canvas, left, top, tw, th, 0, 0, tw, th);
  return out;
}

/**
 * Renders the quotation detail card (same markup as the modal) into a multi-page PDF.
 * @param {HTMLElement} element — e.g. `.quotation-view-print-root`
 * @param {{ quoteRef?: string }} [options]
 */
export async function downloadQuotationDetailPdfFromElement(element, options = {}) {
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error("Quotation PDF: missing print root element.");
  }
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  let canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    onclone: (_clonedDoc, clonedEl) => {
      if (!(clonedEl instanceof HTMLElement)) {
        return;
      }
      clonedEl.style.width = `${PDF_CAPTURE_TARGET_WIDTH_PX}px`;
      clonedEl.style.minWidth = `${PDF_CAPTURE_TARGET_WIDTH_PX}px`;
      clonedEl.style.maxWidth = `${PDF_CAPTURE_TARGET_WIDTH_PX}px`;
      clonedEl.style.boxSizing = "border-box";
      clonedEl.style.boxShadow = "none";
      clonedEl.style.margin = "0";
    }
  });

  canvas = trimCanvasLightBorders(canvas);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  /** Edge-to-edge on the PDF page; viewers/printers apply their own minimal margins if needed. */
  const margin = 0;
  const usableW = pageWidth - 2 * margin;
  const usableH = pageHeight - 2 * margin;

  const cw = canvas.width;
  const ch = canvas.height;
  /** Always scale to full page width first (matches on-screen “full width” quote). */
  const kWidth = usableW / cw;
  const heightIfFullWidthMm = ch * kWidth;

  if (heightIfFullWidthMm <= usableH) {
    /** Single page: full width, top-aligned (no centered gutters on sides/top). */
    const imgData = canvas.toDataURL("image/png", 0.92);
    pdf.addImage(imgData, "PNG", margin, margin, usableW, heightIfFullWidthMm);
  } else {
    /** Multi-page: full page width, vertical slices, top-aligned. */
    const imgWmm = usableW;
    const imgHmm = (ch * imgWmm) / cw;
    const pxPerPage = Math.max(1, Math.floor((usableH * ch) / imgHmm));

    let yPx = 0;
    while (yPx < ch) {
      const slicePx = Math.min(pxPerPage, ch - yPx);
      const sliceMm = (slicePx * imgHmm) / ch;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = cw;
      sliceCanvas.height = slicePx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Quotation PDF: could not get canvas context.");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, yPx, cw, slicePx, 0, 0, cw, slicePx);

      const sliceData = sliceCanvas.toDataURL("image/png", 0.92);
      if (yPx > 0) {
        pdf.addPage();
      }
      pdf.addImage(sliceData, "PNG", margin, margin, imgWmm, sliceMm);

      yPx += slicePx;
    }
  }

  const safeRef = String(options.quoteRef ?? "quotation").replace(/[^\w.-]+/g, "_");
  pdf.save(`quotation-${safeRef}.pdf`);
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
  const margin = 14;
  let y = 16;
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
  const quoteTitle = String(row.quoteTitle ?? "").trim();
  if (quoteTitle) {
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(quoteTitle, margin, y);
    y += 6;
  }
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

  const body = vm.rows.map((r) => {
    const desc = r.desc ? `${r.title}\n${r.desc}` : r.title;
    return [
      desc,
      String(r.qty),
      fmt(r.unit),
      r.disc > 0 ? fmt(r.disc) : "—",
      fmt(r.lineTotal)
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Item and Description", "Qty", "Unit price", "Discount", "Line total"]],
    body,
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [65, 158, 221], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 15, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 28, halign: "right" }
    },
    margin: { left: margin, right: margin }
  });

  const tableEnd = doc.lastAutoTable?.finalY ?? y + 40;
  y = tableEnd + 8;

  const rightX = pageW - margin;
  doc.setFontSize(9);
  doc.text(`Sub total: ${fmt(vm.subEx)}`, rightX, y, { align: "right" });
  y += 5;
  if (vm.dtype !== "none") {
    doc.text(`${vm.discountLabel}: −${fmt(vm.discountAmt)}`, rightX, y, { align: "right" });
    y += 5;
  }
  doc.text(`Tax: ${fmt(vm.taxAmt)}`, rightX, y, { align: "right" });
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${fmt(vm.grandTotal)}`, rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 10;

  const terms = String(row.termsAndConditions ?? "").trim();
  if (terms) {
    ensureSpace(40);
    doc.setFontSize(10);
    doc.setTextColor(33, 43, 54);
    doc.text("Terms & conditions", margin, y);
    y += 5;
    doc.setFontSize(8);
    const termLines = doc.splitTextToSize(terms, pageW - 2 * margin);
    doc.text(termLines, margin, y);
    y += termLines.length * 3.6 + 4;
  }

  const note = String(row.clientNote ?? "").trim();
  if (note) {
    ensureSpace(40);
    doc.setFontSize(10);
    doc.setTextColor(33, 43, 54);
    doc.text("Client note", margin, y);
    y += 5;
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(note, pageW - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 3.6 + 4;
  }

  const agent = String(row.Biller_Name ?? "").trim();
  if (agent) {
    ensureSpace(12);
    doc.setFontSize(9);
    doc.setTextColor(33, 43, 54);
    doc.text(`Sales agent: ${agent}`, margin, y);
    y += 6;
  }

  y += 4;
  ensureSpace(20);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Payment Made Via bank transfer / Cheque in the name of Thomas Lawler", margin, y);
  y += 4;
  const bankLine = doc.splitTextToSize(
    "Bank Name: HDFC Bank  |  Account Number: 45366287987  |  IFSC: HDFC0018159",
    pageW - 2 * margin
  );
  doc.text(bankLine, margin, y);

  const safeRef = String(row.quoteRef ?? "quotation").replace(/[^\w.-]+/g, "_");
  doc.save(`quotation-${safeRef}.pdf`);
}
