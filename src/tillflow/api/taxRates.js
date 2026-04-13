import { tillflowFetch } from "./client";
import { TillFlowApiError } from "./errors";
import { DEFAULT_TAX_RATES } from "../settings/taxRatesCatalog";

export async function listTaxRatesRequest(token) {
  try {
    const data = await tillflowFetch("/tax-rates", { token });
    const rows = Array.isArray(data?.tax_rates) ? data.tax_rates : [];
    return rows;
  } catch (e) {
    if (e instanceof TillFlowApiError && e.status === 404) {
      return DEFAULT_TAX_RATES;
    }
    throw e;
  }
}
