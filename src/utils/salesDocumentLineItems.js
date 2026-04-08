/**
 * Shared line-item math for quotations, invoices, and similar sales documents.
 * Kept free of React so list screens can import without cycles.
 */

export const DEFAULT_SALES_LINE_TAX_PERCENT = "16";

export function newLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyApiSalesLine() {
  return {
    key: newLineKey(),
    productId: "",
    quantity: "1",
    unitPrice: "",
    taxPercent: DEFAULT_SALES_LINE_TAX_PERCENT,
    customLabel: "",
    description: ""
  };
}

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function parseTaxPercentFromLine(line) {
  const t = parseFloat(
    String(line.taxPercent ?? line.tax_percent ?? DEFAULT_SALES_LINE_TAX_PERCENT).replace(/[^0-9.-]/g, "")
  );
  if (Number.isNaN(t) || t < 0) {
    return 0;
  }
  return Math.min(t, 100);
}

/** Subtotal before tax: qty × unit (unit from catalog default when applicable). */
export function lineSubtotalExTax(line, catalogProducts, useCatalogDefaultUnitPrice) {
  const q = parseFloat(String(line.quantity).replace(/[^0-9.-]/g, ""));
  const qty = Number.isNaN(q) || q < 0 ? 0 : q;
  let unit = parseFloat(String(line.unitPrice).replace(/[^0-9.-]/g, ""));
  const hasCatalogProductId = line.productId != null && String(line.productId).trim() !== "";
  if (!hasCatalogProductId) {
    if (Number.isNaN(unit) || unit < 0) {
      unit = 0;
    }
    return roundMoney(qty * unit);
  }
  if (useCatalogDefaultUnitPrice && hasCatalogProductId) {
    if (Number.isNaN(unit) || String(line.unitPrice).trim() === "") {
      const p = catalogProducts.find((x) => String(x.id) === String(line.productId));
      if (p?.selling_price != null) {
        unit = Number(p.selling_price);
      }
    }
  }
  if (Number.isNaN(unit) || unit < 0) {
    unit = 0;
  }
  return roundMoney(qty * unit);
}

/** Amount including line tax (%). */
export function displayLineAmount(line, catalogProducts, useCatalogDefaultUnitPrice) {
  const subtotal = lineSubtotalExTax(line, catalogProducts, useCatalogDefaultUnitPrice);
  const pct = parseTaxPercentFromLine(line);
  return roundMoney(subtotal * (1 + pct / 100));
}

export function apiSalesLineHasCatalogId(line) {
  return line.productId != null && String(line.productId).trim() !== "";
}

export function stagingRowCommitReadyApi(line) {
  return apiSalesLineHasCatalogId(line) || String(line.customLabel ?? "").trim() !== "";
}

export function filterValidApiSalesLines(lines) {
  return lines.filter((l) => {
    const label = String(l.customLabel ?? "").trim();
    return apiSalesLineHasCatalogId(l) || label !== "";
  });
}

/** @param {Array<{ id?: unknown, name?: string, selling_price?: unknown }>} catalogProducts */
export function apiFormSalesLineToPayload(l, catalogProducts) {
  const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
  const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
  let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
  const desc = String(l.description ?? "").trim();
  const tp = parseTaxPercentFromLine(l);
  if (!apiSalesLineHasCatalogId(l)) {
    if (Number.isNaN(unit) || unit < 0) {
      unit = 0;
    }
    return {
      product_id: null,
      product_name: String(l.customLabel ?? "").trim(),
      quantity,
      unit_price: unit,
      tax_percent: tp,
      ...(desc !== "" ? { description: desc } : {})
    };
  }
  if (Number.isNaN(unit) || String(l.unitPrice).trim() === "") {
    const p = catalogProducts.find((x) => String(x.id) === String(l.productId));
    unit = p?.selling_price != null ? Number(p.selling_price) : 0;
  }
  return {
    product_id: Number(l.productId),
    quantity,
    unit_price: unit,
    tax_percent: tp,
    ...(desc !== "" ? { description: desc } : {})
  };
}

export function parseDiscountPercent(raw) {
  const x = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return Math.min(100, x);
}

export function parseDiscountValueFixed(raw) {
  const x = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return x;
}

/**
 * @param {{ subtotalExTax: number, taxTotal: number }} sub
 * @param {number} lineTotal — sum of tax-inclusive line amounts
 * @param {string} discountType — none | before_tax | after_tax
 * @param {string} discountBasis — percent | fixed
 * @param {string} discountValueStr
 */
export function computeDiscountedGrandTotal(sub, lineTotal, discountType, discountBasis, discountValueStr) {
  const subEx = sub.subtotalExTax;
  const tax = sub.taxTotal;
  const dtype = discountType === "before_tax" || discountType === "after_tax" ? discountType : "none";
  const basis = discountBasis === "fixed" ? "fixed" : "percent";
  const valStr = discountValueStr ?? "0";

  if (dtype === "none") {
    return {
      subtotalExTax: subEx,
      taxTotal: tax,
      discountAmt: 0,
      grandTotal: roundMoney(lineTotal)
    };
  }

  if (basis === "fixed") {
    const fix = roundMoney(parseDiscountValueFixed(valStr));
    const discountAmt =
      dtype === "before_tax"
        ? roundMoney(Math.min(fix, subEx))
        : roundMoney(Math.min(fix, lineTotal));
    return {
      subtotalExTax: subEx,
      taxTotal: tax,
      discountAmt,
      grandTotal: roundMoney(Math.max(0, lineTotal - discountAmt))
    };
  }

  const pct = parseDiscountPercent(valStr);
  const discountAmt =
    dtype === "before_tax"
      ? roundMoney(subEx * (pct / 100))
      : roundMoney(lineTotal * (pct / 100));
  return {
    subtotalExTax: subEx,
    taxTotal: tax,
    discountAmt,
    grandTotal: roundMoney(Math.max(0, lineTotal - discountAmt))
  };
}
