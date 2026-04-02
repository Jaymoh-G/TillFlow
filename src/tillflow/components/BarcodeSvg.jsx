import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Renders a CODE128 barcode as SVG (for list, modal preview, and print sheet).
 */
export default function BarcodeSvg({ value, height = 48, width = 1.4, displayValue = true, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !value || String(value).trim() === '') {
      return;
    }
    const code = String(value).trim();
    try {
      JsBarcode(el, code, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      try {
        JsBarcode(el, code, {
          format: 'CODE39',
          width: width * 1.2,
          height,
          displayValue,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // Leave empty if unmappable
      }
    }
  }, [value, height, width, displayValue]);

  if (!value || String(value).trim() === '') {
    return <span className="text-muted small">—</span>;
  }

  return <svg ref={ref} className={className} role="img" aria-label={`Barcode ${value}`} />;
}
