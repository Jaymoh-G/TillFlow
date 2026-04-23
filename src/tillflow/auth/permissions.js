/** Canonical API permission slugs (see backend/config/permissions.php). */

export const PERMISSION = {
  TENANT_MANAGE: 'tenant.manage',
  USERS_MANAGE: 'users.manage',
  ACTIVITY_LOGS_VIEW: 'system.activity_logs.view',
  REPORTS_VIEW: 'reports.view',
  SEARCH_GLOBAL: 'search.global',
};

/**
 * Module base names (pair with {@link vm} for RequirePermission).
 * Manage implies view on the server and in AuthContext.
 */
export const M = {
  CATALOG_MASTERS: 'catalog.masters',
  CATALOG_ITEMS: 'catalog.items',
  STOCK_ADJUST: 'inventory.stock_adjust',
  STOCK_TRANSFER: 'inventory.stock_transfer',
  STORES: 'stores',
  ORDERS: 'sales.orders',
  QUOTATIONS: 'sales.quotations',
  LEADS: 'sales.leads',
  PROPOSALS: 'sales.proposals',
  INVOICES: 'sales.invoices',
  DELIVERY_NOTES: 'sales.delivery_notes',
  CREDIT_NOTES: 'sales.credit_notes',
  INVOICE_PAYMENTS: 'sales.invoice_payments',
  RETURNS: 'sales.returns',
  CUSTOMERS: 'sales.customers',
  BILLERS: 'sales.billers',
  SUPPLIERS: 'procurement.suppliers',
  PURCHASES: 'procurement.purchases',
  PURCHASE_RETURNS: 'procurement.purchase_returns',
  EXPENSES: 'finance.expenses',
};

/**
 * @param {string} base Module base, e.g. `catalog.items`
 * @returns {[string, string]} `[base.view, base.manage]` for RequirePermission anyOf
 */
export function vm(base) {
  return [`${base}.view`, `${base}.manage`];
}
