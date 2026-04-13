export const DEFAULT_TAX_RATES = [
  { key: "vat", name: "VAT", rate: "10" },
  { key: "cgst", name: "CGST", rate: "08" },
  { key: "sgst", name: "SGST", rate: "10" }
];

export function buildTaxRateSelectOptions(rows) {
  const list = Array.isArray(rows) ? rows : DEFAULT_TAX_RATES;
  return list.map((r) => ({
    value: String(r?.key ?? r?.name ?? "").toLowerCase() || "tax",
    label: `${String(r?.name ?? "Tax")} (${String(r?.rate ?? "0")}%)`
  }));
}
