import { tillflowFetch } from './client';

function qs(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      u.set(k, String(v));
    }
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

/** @param {string} token */
export function fetchStoreOptions(token) {
  return tillflowFetch(`/reports/store-options${qs()}`, { token });
}

export function fetchCustomerOptions(token) {
  return tillflowFetch(`/reports/customer-options${qs()}`, { token });
}

/** @param {string} token @param {Record<string, string|number|undefined>} params */
export function fetchSalesSummary(token, params) {
  return tillflowFetch(`/reports/sales-summary${qs(params)}`, { token });
}

export function fetchPaymentBreakdown(token, params) {
  return tillflowFetch(`/reports/payment-breakdown${qs(params)}`, { token });
}

/**
 * GET `/reports/outstanding-invoices` — optional `summary` (`unpaid_balance`, `partial_balance`,
 * `overdue_balance`, `total_outstanding`, …) and/or `rows` / `invoices` with `status` + `balance_due`.
 */
export function fetchOutstandingInvoices(token) {
  return tillflowFetch(`/reports/outstanding-invoices`, { token });
}

/** @param {string} token @param {{ limit?: number }} [params] */
export function fetchDashboardTopCustomers(token, params) {
  return tillflowFetch(`/reports/dashboard-top-customers${qs(params)}`, { token });
}

/** @param {string} token @param {{ limit?: number }} [params] */
export function fetchTopCustomersArrears(token, params) {
  return tillflowFetch(`/reports/top-customers-arrears${qs(params)}`, { token });
}

/** @param {string} token @param {{ period?: string, limit?: number }} [params] */
export function fetchDashboardTopCategories(token, params) {
  return tillflowFetch(`/reports/dashboard-top-categories${qs(params)}`, { token });
}

/** @param {string} token @param {Record<string, string|number|undefined>} [params] limit, period, from, to */
export function fetchDashboardRecentTransactions(token, params) {
  return tillflowFetch(`/reports/dashboard-recent-transactions${qs(params)}`, { token });
}

/**
 * @param {string} token
 * @param {{ period?: string, from?: string, to?: string }} [params]
 *   `period` (e.g. 1w|1m|6m) or `from`/`to` (YYYY-MM-DD) when the API supports a custom range.
 */
export function fetchDashboardSalesPurchase(token, params) {
  return tillflowFetch(`/reports/dashboard-sales-purchase${qs(params)}`, { token });
}

/** @param {string} token @param {{ period?: string, from?: string, to?: string }} [params] */
export function fetchDashboardOverallInformation(token, params) {
  return tillflowFetch(`/reports/dashboard-overall-information${qs(params)}`, { token });
}

/** Invoice report register: date range, optional customer_id & status; includes KPI summary. */
export function fetchInvoiceRegister(token, params) {
  return tillflowFetch(`/reports/invoice-register${qs(params)}`, { token });
}

export function fetchTaxSummary(token, params) {
  return tillflowFetch(`/reports/tax-summary${qs(params)}`, { token });
}

export function fetchZLight(token, params) {
  return tillflowFetch(`/reports/z-light${qs(params)}`, { token });
}

export function fetchReturnSummary(token, params) {
  return tillflowFetch(`/reports/return-summary${qs(params)}`, { token });
}

export function fetchEmployeeSales(token, params) {
  return tillflowFetch(`/reports/employee-sales${qs(params)}`, { token });
}

export function fetchReturnsByStaff(token, params) {
  return tillflowFetch(`/reports/returns-by-staff${qs(params)}`, { token });
}

export function fetchProfitLoss(token, params) {
  return tillflowFetch(`/reports/profit-loss${qs(params)}`, { token });
}

export function fetchBestSellers(token, params) {
  return tillflowFetch(`/reports/best-sellers${qs(params)}`, { token });
}

export function fetchStockMovements(token, params) {
  return tillflowFetch(`/reports/stock-movements${qs(params)}`, { token });
}

export function fetchSupplierPurchases(token, params) {
  return tillflowFetch(`/reports/supplier-purchases${qs(params)}`, { token });
}

export function fetchCustomerKpis(token, params) {
  return tillflowFetch(`/reports/customer-kpis${qs(params)}`, { token });
}

export function fetchExpensesByCategory(token, params) {
  return tillflowFetch(`/reports/expenses-by-category${qs(params)}`, { token });
}

export function fetchIncomeSummary(token, params) {
  return tillflowFetch(`/reports/income-summary${qs(params)}`, { token });
}

export function fetchAnnualSummary(token, params) {
  return tillflowFetch(`/reports/annual-summary${qs(params)}`, { token });
}

export function fetchCustomerPurchaseLines(token, params) {
  return tillflowFetch(`/reports/customer-purchase-lines${qs(params)}`, { token });
}

export function fetchProposalsReport(token, params) {
  return tillflowFetch(`/reports/proposals${qs(params)}`, { token });
}

/** Dashboard Recent Transactions — proposals tab (requires sales.proposals.view + reports.view). */
export function fetchDashboardRecentProposals(token, params) {
  return tillflowFetch(`/reports/dashboard-recent-proposals${qs(params)}`, { token });
}
