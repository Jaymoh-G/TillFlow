/**
 * Shared reports navigation: admin sidebar + /tillflow/admin/reports hub widgets.
 * Keep paths and labels aligned when adding reports.
 *
 * `navAnyOf`: show the link only if the user has at least one of these permission slugs
 * (manage implies view). Omitted → treat as `reports.view` only.
 */

/** @type {Record<string, string[]>} */
const NAV = {
  POS: ['sales.orders.view'],
  RETURNS: ['sales.returns.view'],
  INVOICES: ['sales.invoices.view'],
  PROPOSALS: ['sales.proposals.view'],
  CUSTOMERS: ['sales.customers.view'],
  PURCHASES: ['procurement.purchases.view'],
  EXPENSES: ['finance.expenses.view'],
  FINANCIAL: ['reports.view'],
  STOCK_HISTORY: ['inventory.stock_adjust.view', 'inventory.stock_transfer.view'],
  /** Matches TillFlow routes for expired / low-stock (catalog or reports). */
  ITEMS_OR_REPORTS: ['catalog.items.view', 'reports.view'],
};

export const REPORT_NAV_GROUPS = [
  {
    id: 'sales-pos',
    label: 'Sales & POS',
    items: [
      {
        to: '/tillflow/admin/reports/pos-sales',
        label: 'POS sales',
        icon: 'icon-shopping-bag',
        note: 'POS orders in the selected period',
        navAnyOf: NAV.POS,
      },
      {
        to: '/tillflow/admin/reports/best-sellers',
        label: 'Best sellers',
        icon: 'icon-award',
        note: 'Top products by revenue in the selected period',
        navAnyOf: NAV.POS,
      },
      {
        to: '/tillflow/admin/reports/payment-breakdown',
        label: 'Payment breakdown',
        icon: 'icon-credit-card',
        note: 'Payments by tender type',
        navAnyOf: NAV.POS,
      },
      {
        to: '/tillflow/admin/reports/tax-report',
        label: 'Tax report',
        icon: 'icon-percent',
        note: 'Tax by rate from POS line items',
        navAnyOf: NAV.POS,
      },
      {
        to: '/tillflow/admin/reports/z-light',
        label: 'End of day (Z)',
        icon: 'icon-clock',
        note: 'Light Z from transactional data (no cash drawer)',
        navAnyOf: NAV.POS,
      },
      {
        to: '/tillflow/admin/reports/employee-sales',
        label: 'Employee sales',
        icon: 'icon-user',
        note: 'Sales by cashier / employee',
        navAnyOf: NAV.POS,
      },
    ],
  },
  {
    id: 'returns',
    label: 'Returns',
    items: [
      {
        to: '/tillflow/admin/reports/return-summary',
        label: 'Return summary',
        icon: 'icon-repeat',
        note: 'Sales returns in the selected period',
        navAnyOf: NAV.RETURNS,
      },
      {
        to: '/tillflow/admin/reports/returns-by-staff',
        label: 'Returns by staff',
        icon: 'icon-user-check',
        note: 'Returns processed by staff',
        navAnyOf: NAV.RETURNS,
      },
    ],
  },
  {
    id: 'invoices-customers',
    label: 'Invoices & customers',
    items: [
      {
        to: '/tillflow/admin/reports/invoice-report',
        label: 'Invoice report',
        icon: 'icon-file-text',
        note: 'Outstanding balances and invoice activity',
        navAnyOf: NAV.INVOICES,
      },
      {
        to: '/tillflow/admin/reports/customer-report',
        label: 'Customer report',
        icon: 'icon-users',
        note: 'Customer spend and transaction counts',
        navAnyOf: NAV.CUSTOMERS,
      },
      {
        to: '/tillflow/admin/reports/customer-purchase-lines',
        label: 'Customer purchase lines',
        icon: 'icon-align-left',
        note: 'Line-level history for one customer',
        navAnyOf: NAV.CUSTOMERS,
      },
      {
        to: '/tillflow/admin/reports/proposal-report',
        label: 'Proposal report',
        icon: 'icon-file-plus',
        note: 'Proposals in the selected period (by proposed date)',
        navAnyOf: NAV.PROPOSALS,
      },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing & expenses',
    items: [
      {
        to: '/tillflow/admin/reports/supplier-purchases',
        label: 'Supplier purchases',
        icon: 'icon-truck',
        note: 'Purchase documents in the selected period',
        navAnyOf: NAV.PURCHASES,
      },
      {
        to: '/tillflow/admin/reports/expense-report',
        label: 'Expense report',
        icon: 'icon-dollar-sign',
        note: 'Expenses in the selected period',
        navAnyOf: NAV.EXPENSES,
      },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    items: [
      {
        to: '/tillflow/admin/reports/income-report',
        label: 'Income summary',
        icon: 'icon-trending-up',
        note: 'Income summary (POS and invoices)',
        navAnyOf: NAV.FINANCIAL,
      },
      {
        to: '/tillflow/admin/reports/profit-loss',
        label: 'Profit & loss',
        icon: 'icon-bar-chart-2',
        note: 'Profit & loss (estimated)',
        navAnyOf: NAV.FINANCIAL,
      },
      {
        to: '/tillflow/admin/reports/annual-report',
        label: 'Annual report',
        icon: 'icon-calendar',
        note: 'Revenue and estimated profit / loss for the selected year',
        navAnyOf: NAV.FINANCIAL,
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      {
        to: '/tillflow/admin/reports/stock-history',
        label: 'Stock history',
        icon: 'icon-layers',
        note: 'Stock adjustments and transfer lines',
        navAnyOf: NAV.STOCK_HISTORY,
      },
      {
        to: '/tillflow/admin/expired-items',
        label: 'Expired items',
        icon: 'icon-alert-circle',
        note: 'Products past expiry date',
        navAnyOf: NAV.ITEMS_OR_REPORTS,
      },
      {
        to: '/tillflow/admin/low-stock',
        label: 'Low stock',
        icon: 'icon-trending-down',
        note: 'Items below reorder threshold',
        navAnyOf: NAV.ITEMS_OR_REPORTS,
      },
    ],
  },
];

/**
 * Drop report links the signed-in user is not allowed to see; drop empty groups.
 * @param {typeof REPORT_NAV_GROUPS} groups
 * @param {(slug: string) => boolean} hasPermission
 */
export function filterReportNavGroupsForUser(groups, hasPermission) {
  if (typeof hasPermission !== 'function') {
    return groups;
  }
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const slugs = item.navAnyOf;
        if (!slugs?.length) {
          return hasPermission('reports.view');
        }
        return slugs.some((s) => hasPermission(s));
      }),
    }))
    .filter((g) => g.items.length > 0);
}
