import { REPORT_NAV_GROUPS } from '../config/reportsNavigation';
import { TILLFLOW_ADMIN_SALES_NAV_PATH_RE } from '../offline/tillflowOfflinePolicy';

export const INVENTORY_PATH_RE =
  /\/tillflow\/admin\/(items|add-product|expired-items|low-stock|categories|brands|units|variant-attributes|warranties|print-barcode)(\/|$)/;
export const MANAGE_STOCKS_PATH_RE =
  /\/tillflow\/admin\/(stores|stock-adjustment|stock-transfer)(\/|$)/;
export const SALES_PATH_RE = TILLFLOW_ADMIN_SALES_NAV_PATH_RE;
export const PEOPLE_PATH_RE =
  /\/tillflow\/admin\/(customers|billers|suppliers|settings\/roles-permissions)(\/|$)/;
export const PURCHASES_PATH_RE = /\/tillflow\/admin\/(purchases|purchase-returns)(\/|$)/;
/** Reports menu + inventory report shortcuts (hub links) */
export const REPORTS_SECTION_PATH_RE =
  /\/tillflow\/admin\/(reports|expired-items|low-stock|activity-logs)(\/|$)/;

export const SETTINGS_GENERAL_PATH_RE =
  /\/tillflow\/admin\/settings\/(profile|security|notifications|connected-apps)(\/|$)/;
export const SETTINGS_WEBSITE_PATH_RE =
  /\/tillflow\/admin\/settings\/(company|preference|appearance|social-authentication)(\/|$)/;
export const SETTINGS_APP_PATH_RE =
  /\/tillflow\/admin\/settings\/(invoice|printer|pos|signatures|custom-fields)(\/|$)/;
export const SETTINGS_SYSTEM_PATH_RE =
  /\/tillflow\/admin\/settings\/(system|automation|email|email-templates|sms-gateway|sms-templates|otp|gdpr)(\/|$)/;
export const SETTINGS_FINANCIAL_PATH_RE =
  /\/tillflow\/admin\/settings\/(payment-gateway|bank-accounts|tax-rates|currencies)(\/|$)/;
export const SETTINGS_OTHER_PATH_RE = /\/tillflow\/admin\/settings\/(storage|ban-ip)(\/|$)/;

/**
 * Which left-rail / tab panel should be active (DreamsPOS two-column sidebar pattern).
 * Inventory paths win over reports for `expired-items` / `low-stock`.
 */
export function pathnameToSidebarPanel(pathname) {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/tillflow/admin') {
    return 'dashboard';
  }
  if (INVENTORY_PATH_RE.test(pathname)) {
    return 'inventory';
  }
  if (MANAGE_STOCKS_PATH_RE.test(pathname)) {
    return 'stock';
  }
  if (SALES_PATH_RE.test(pathname)) {
    return 'sales';
  }
  if (PEOPLE_PATH_RE.test(pathname)) {
    return 'people';
  }
  if (PURCHASES_PATH_RE.test(pathname)) {
    return 'purchases';
  }
  if (REPORTS_SECTION_PATH_RE.test(pathname)) {
    return 'reports';
  }
  if (pathname.startsWith('/tillflow/admin/settings')) {
    return 'settings';
  }
  return null;
}

/** @param {string} pathname */
export function reportPathMatchesItem(pathname, item) {
  const p = pathname.replace(/\/$/, '') || '/';
  const t = item.to.replace(/\/$/, '') || '/';
  if (item.end) {
    return p === t;
  }
  return p === t || p.startsWith(`${t}/`);
}

/** @param {string} pathname */
export function syncReportSubgroupFromPath(pathname, setReportSubgroupOpen) {
  if (!REPORTS_SECTION_PATH_RE.test(pathname)) {
    return;
  }
  const norm = pathname.replace(/\/$/, '') || '/';
  let matchedId = null;
  for (const group of REPORT_NAV_GROUPS) {
    if (group.items.some((item) => reportPathMatchesItem(norm, item))) {
      matchedId = group.id;
      break;
    }
  }
  if (matchedId !== null) {
    setReportSubgroupOpen((prev) => {
      const next = { ...prev };
      for (const g of REPORT_NAV_GROUPS) {
        next[g.id] = g.id === matchedId;
      }
      return next;
    });
  } else if (norm === '/tillflow/admin/reports') {
    setReportSubgroupOpen(Object.fromEntries(REPORT_NAV_GROUPS.map((g) => [g.id, false])));
  }
}
