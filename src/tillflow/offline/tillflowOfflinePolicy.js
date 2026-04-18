/**
 * TillFlow offline policy: TanStack Query mutations (queued sync) are intended for
 * sales and quoting flows that are ready for offline use. All other /tillflow/admin
 * routes require connectivity.
 *
 * Invoicing (`/invoices`, `/settings/invoice`) is not offline-capable yet — when the
 * module is built, add those paths to `tillflowAdminPathAllowsOfflineUse` below.
 *
 * Purchase listing screens use local/demo table data; they are allowed offline so the
 * UI stays reachable without network.
 *
 * POS register lives under /tillflow/pos (separate layout) and is always reachable offline.
 */

/** Opens the Sales sidebar section (includes Invoices nav target for when that screen exists). */
export const TILLFLOW_ADMIN_SALES_NAV_PATH_RE =
  /\/tillflow\/admin\/(orders|quotations|leads|proposals|invoices|delivery-notes|invoice-payments|sales-returns)(\/|$)/;

/** Admin routes that may be used without network today (excludes invoicing until built). */
const ADMIN_OFFLINE_CAPABLE_RE = /\/tillflow\/admin\/(orders|quotations|sales-returns|purchases|purchase-orders|purchase-returns)(\/|$)/;

/** @param {string} pathname */
export function tillflowAdminPathAllowsOfflineUse(pathname) {
  return ADMIN_OFFLINE_CAPABLE_RE.test(pathname);
}
