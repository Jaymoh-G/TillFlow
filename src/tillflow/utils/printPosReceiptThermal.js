/**
 * Thermal-style POS receipt print: hidden iframe with the receipt DOM clone + current
 * app stylesheets, then window.print(). Matches post-sale print on /pos.
 *
 * @param {HTMLElement} element Receipt root (e.g. `.tf-pos-receipt`)
 * @param {string} [title] Print job / document title
 */
export function printPosReceiptThermal(element, title = "Receipt") {
  const styleTags = Array.from(document.querySelectorAll("style"))
    .map((s) => s.outerHTML)
    .join("\n");
  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.outerHTML)
    .join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${String(title)}</title>
    ${cssLinks}
    ${styleTags}
    <style>
      html, body { background: #fff; margin: 0; padding: 0; }
      .tf-pos-receipt { margin: 0 auto; }
      @page { size: auto; margin: 8mm; }
    </style>
  </head>
  <body>${element.outerHTML}</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error("PRINT_FRAME_UNAVAILABLE");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 800);
    }
  };

  iframe.onload = runPrint;
  window.setTimeout(runPrint, 500);
}
