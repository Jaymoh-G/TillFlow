/**
 * Shared html2canvas → multi-page jsPDF pipeline for quotation, invoice, purchase order, etc.
 * Reuse: mount a print root (same CSS as on-screen), then call download / blob helpers.
 */

/** ~A4 width at 96dpi */
const PDF_CAPTURE_TARGET_WIDTH_PX = Math.round((210 / 25.4) * 96);

export const HTML_DOCUMENT_PDF_MARGIN_MM = 7;

const PDF_PAGE_SLICE_BOTTOM_SLACK_MM = 6;
const PDF_MIN_SLICE_PX = 40;
const PDF_CAPTURE_SCALE = 1.5;
const PDF_JPEG_QUALITY = 0.82;

function canvasToCaptureJpegDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY);
}

function rowInkSum(d, w, y) {
  let ink = 0;
  const row = y * w * 4;
  const step = 3;
  for (let x = 0; x < w; x += step) {
    const i = row + x * 4;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    ink += 255 - lum;
  }
  return ink;
}

function choosePageBreakY(data, w, ch, yTop, maxSlicePx, isFinalChunk) {
  if (isFinalChunk || yTop + maxSlicePx >= ch) {
    return ch;
  }
  const yLow = yTop + PDF_MIN_SLICE_PX;
  const yHigh = Math.min(yTop + maxSlicePx, ch);
  if (yLow >= yHigh) {
    return yHigh;
  }
  let bestCut = yHigh;
  let bestScore = Infinity;
  for (let cutY = yLow + 1; cutY <= yHigh; cutY++) {
    const seam = rowInkSum(data, w, cutY - 1) + rowInkSum(data, w, cutY);
    if (seam < bestScore || (seam === bestScore && cutY > bestCut)) {
      bestScore = seam;
      bestCut = cutY;
    }
  }
  return bestCut;
}

/**
 * Wait for images under the print root so html2canvas matches logos.
 * @param {HTMLElement} element
 * @param {number} [timeoutMs]
 */
export async function waitForPrintRootImages(element, timeoutMs = 8000) {
  if (!element || !(element instanceof HTMLElement)) {
    return;
  }
  const imgs = [...element.querySelectorAll("img")];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalHeight > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, timeoutMs);
        })
    )
  );
}

/**
 * @param {HTMLElement} element — print root, e.g. `.quotation-view-print-root`
 * @param {object} [options]
 * @param {(clonedEl: HTMLElement) => void} [options.cloneHook] — run after default clone fixes
 * @returns {Promise<object>} jsPDF
 */
export async function buildJsPdfFromHtmlElement(element, options = {}) {
  const { cloneHook } = options;
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error("Document PDF: missing print root element.");
  }
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: PDF_CAPTURE_SCALE,
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
      clonedEl.style.margin = "0";
      clonedEl.style.boxShadow = "none";
      clonedEl.style.border = "none";
      clonedEl.style.borderRadius = "0";
      clonedEl.style.backgroundColor = "#ffffff";
      clonedEl.querySelectorAll("thead th").forEach((th) => {
        if (th instanceof HTMLElement) {
          th.style.backgroundColor = "#424242";
          th.style.color = "#ffffff";
          th.style.borderColor = "#555555";
        }
      });
      clonedEl
        .querySelectorAll(".quotation-view-quote-title, .invoice-view-doc-title")
        .forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.color = "#000000";
          }
        });
      if (typeof cloneHook === "function") {
        cloneHook(clonedEl);
      }
    }
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = HTML_DOCUMENT_PDF_MARGIN_MM;
  const usableW = pageWidth - 2 * margin;
  const usableH = pageHeight - 2 * margin;

  const cw = canvas.width;
  const ch = canvas.height;
  const kWidth = usableW / cw;
  const heightIfFullWidthMm = ch * kWidth;

  if (heightIfFullWidthMm <= usableH) {
    const hImg = Math.min(heightIfFullWidthMm, usableH - 0.5);
    const imgData = canvasToCaptureJpegDataUrl(canvas);
    pdf.addImage(imgData, "JPEG", margin, margin, usableW, hImg);
  } else {
    const imgWmm = usableW;
    const imgHmm = (ch * imgWmm) / cw;
    const maxSliceMm = Math.max(20, usableH - PDF_PAGE_SLICE_BOTTOM_SLACK_MM);
    const maxSlicePx = Math.max(PDF_MIN_SLICE_PX + 8, Math.floor((maxSliceMm * ch) / imgHmm) - 2);

    const srcCtx = canvas.getContext("2d");
    if (!srcCtx) {
      throw new Error("Document PDF: could not read capture canvas.");
    }
    const fullData = srcCtx.getImageData(0, 0, cw, ch).data;

    let yPx = 0;
    while (yPx < ch) {
      const remaining = ch - yPx;
      const isFinalChunk = remaining <= maxSlicePx;
      const cutY = choosePageBreakY(fullData, cw, ch, yPx, maxSlicePx, isFinalChunk);
      const slicePx = cutY - yPx;
      const sliceMm = (slicePx * imgHmm) / ch;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = cw;
      sliceCanvas.height = slicePx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Document PDF: could not get canvas context.");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, yPx, cw, slicePx, 0, 0, cw, slicePx);

      const sliceData = canvasToCaptureJpegDataUrl(sliceCanvas);
      if (yPx > 0) {
        pdf.addPage();
      }
      pdf.addImage(sliceData, "JPEG", margin, margin, imgWmm, sliceMm);

      yPx = cutY;
    }
  }

  return pdf;
}

/**
 * @param {HTMLElement} element
 * @param {object} [options]
 * @returns {Promise<Blob>}
 */
export async function htmlDocumentPdfBlobFromElement(element, options = {}) {
  const pdf = await buildJsPdfFromHtmlElement(element, options);
  return pdf.output("blob");
}

/**
 * @param {HTMLElement} element
 * @param {{ fileSlug?: string, cloneHook?: (el: HTMLElement) => void }} [options]
 */
export async function downloadHtmlDocumentPdfFromElement(element, options = {}) {
  const pdf = await buildJsPdfFromHtmlElement(element, options);
  const slug = String(options.fileSlug ?? "document").replace(/[^\w.-]+/g, "_");
  pdf.save(`${slug}.pdf`);
}

/**
 * Build a PDF blob URL for embedding (e.g. iframe). Caller must URL.revokeObjectURL when done.
 * @param {HTMLElement} element
 * @param {{ fileSlug?: string, cloneHook?: (el: HTMLElement) => void }} [options]
 * @returns {Promise<string>}
 */
export async function createHtmlDocumentPdfObjectUrl(element, options = {}) {
  const pdf = await buildJsPdfFromHtmlElement(element, options);
  const blob = pdf.output("blob");
  return URL.createObjectURL(blob);
}

/**
 * Open generated PDF in a new browser tab (inline view). Fails if pop-ups are blocked.
 * @param {HTMLElement} element
 * @param {{ fileSlug?: string, cloneHook?: (el: HTMLElement) => void }} [options]
 */
export async function openHtmlDocumentPdfInBrowser(element, options = {}) {
  const pdf = await buildJsPdfFromHtmlElement(element, options);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, "_blank", "noopener,noreferrer");
  if (!newWin) {
    URL.revokeObjectURL(url);
    throw new Error("POPUP_BLOCKED");
  }
  const revokeSoon = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };
  window.setTimeout(revokeSoon, 120_000);
}
