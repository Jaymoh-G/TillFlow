import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CommonFooter from '../../components/footer/commonFooter';
import { PERMISSION } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';
import AdminOfflineWait from '../offline/AdminOfflineWait';
import {
  TILLFLOW_ADMIN_SALES_NAV_PATH_RE,
  tillflowAdminPathAllowsOfflineUse
} from '../offline/tillflowOfflinePolicy';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { REPORT_NAV_GROUPS, filterReportNavGroupsForUser } from '../config/reportsNavigation';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const INVENTORY_PATH_RE =
  /\/tillflow\/admin\/(items|add-product|expired-items|low-stock|categories|brands|units|variant-attributes|warranties|print-barcode)(\/|$)/;
const MANAGE_STOCKS_PATH_RE =
  /\/tillflow\/admin\/(stores|stock-adjustment|stock-transfer)(\/|$)/;
const SALES_PATH_RE = TILLFLOW_ADMIN_SALES_NAV_PATH_RE;
const PEOPLE_PATH_RE =
  /\/tillflow\/admin\/(customers|billers|suppliers|settings\/roles-permissions)(\/|$)/;
const PURCHASES_PATH_RE =
  /\/tillflow\/admin\/(purchases|purchase-returns)(\/|$)/;
/** Reports menu + inventory report shortcuts (hub links) */
const REPORTS_SECTION_PATH_RE =
  /\/tillflow\/admin\/(reports|expired-items|low-stock)(\/|$)/;

/** @param {string} pathname normalized (no trailing slash except root) */
function reportPathMatchesItem(pathname, item) {
  const p = pathname.replace(/\/$/, '') || '/';
  const t = item.to.replace(/\/$/, '') || '/';
  if (item.end) {
    return p === t;
  }
  return p === t || p.startsWith(`${t}/`);
}

const SETTINGS_GENERAL_PATH_RE =
  /\/tillflow\/admin\/settings\/(profile|security|notifications|connected-apps)(\/|$)/;
const SETTINGS_WEBSITE_PATH_RE =
  /\/tillflow\/admin\/settings\/(company|preference|appearance|social-authentication)(\/|$)/;
const SETTINGS_APP_PATH_RE =
  /\/tillflow\/admin\/settings\/(invoice|printer|pos|signatures|custom-fields)(\/|$)/;
const SETTINGS_SYSTEM_PATH_RE =
  /\/tillflow\/admin\/settings\/(system|email|email-templates|sms-gateway|sms-templates|otp|gdpr)(\/|$)/;
const SETTINGS_FINANCIAL_PATH_RE =
  /\/tillflow\/admin\/settings\/(payment-gateway|bank-accounts|tax-rates|currencies)(\/|$)/;
const SETTINGS_OTHER_PATH_RE = /\/tillflow\/admin\/settings\/(storage|ban-ip)(\/|$)/;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const can = (slug) => hasPermission(slug);
  const canMasters = can('catalog.masters.view');
  const canItems = can('catalog.items.view');
  const canStockAdj = can('inventory.stock_adjust.view');
  const canStockXfer = can('inventory.stock_transfer.view');
  const canStores = can('stores.view');
  const canPurchases = can('procurement.purchases.view');
  const canPurReturns = can('procurement.purchase_returns.view');
  const canExpenses = can('finance.expenses.view');
  const canSuppliers = can('procurement.suppliers.view');
  const canOrders = can('sales.orders.view');
  const canQuotations = can('sales.quotations.view');
  const canInvoices = can('sales.invoices.view');
  const canDeliveryNotes = can('sales.delivery_notes.view');
  const canCreditNotes = can('sales.credit_notes.view');
  const canInvoicePayments = can('sales.invoice_payments.view');
  const canSalesReturns = can('sales.returns.view');
  const canCustomers = can('sales.customers.view');
  const canBillers = can('sales.billers.view');
  const canUsers = hasPermission(PERMISSION.USERS_MANAGE);
  const canReports = hasPermission(PERMISSION.REPORTS_VIEW);
  const canTenant = hasPermission(PERMISSION.TENANT_MANAGE);

  const reportNavGroupsVisible = useMemo(
    () => filterReportNavGroupsForUser(REPORT_NAV_GROUPS, hasPermission),
    [hasPermission]
  );

  /** Quick-add links (order fixed). Shown on every admin page when permitted. Same layout as main header Add New. */
  const dashboardAddNewItems = useMemo(() => {
    /** @type {{ label: string; to: string; tiClass: string }[]} */
    const all = [];
    if (canQuotations) {
      all.push({ label: 'Quotation', to: '/tillflow/admin/quotations/new', tiClass: 'ti-device-floppy' });
    }
    if (canInvoices) {
      all.push({ label: 'Invoice', to: '/tillflow/admin/invoices/new', tiClass: 'ti-file-invoice' });
    }
    if (canInvoicePayments) {
      all.push({ label: 'Payment', to: '/tillflow/admin/invoice-payments', tiClass: 'ti-currency-dollar' });
    }
    if (canPurchases) {
      all.push({ label: 'Purchase', to: '/tillflow/admin/purchases/new', tiClass: 'ti-shopping-bag' });
    }
    if (canExpenses) {
      all.push({ label: 'Expense', to: '/tillflow/admin/expenses', tiClass: 'ti-file-text' });
    }
    if (canDeliveryNotes) {
      all.push({ label: 'Delivery note', to: '/tillflow/admin/delivery-notes', tiClass: 'ti-truck-delivery' });
    }
    if (canStockAdj) {
      all.push({ label: 'Adjust Stock', to: '/tillflow/admin/stock-adjustment', tiClass: 'ti-adjustments-horizontal' });
    }
    if (canStockXfer) {
      all.push({ label: 'Transfer Stock', to: '/tillflow/admin/stock-transfer', tiClass: 'ti-arrows-right-left' });
    }
    if (canSalesReturns) {
      all.push({ label: 'Sale return', to: '/tillflow/admin/sales-returns', tiClass: 'ti-copy' });
    }
    if (canUsers) {
      all.push({
        label: 'User',
        to: '/tillflow/admin/settings/roles-permissions',
        tiClass: 'ti-user'
      });
    }
    if (canCustomers) {
      all.push({ label: 'Customer', to: '/tillflow/admin/customers', tiClass: 'ti-users' });
    }
    if (canSuppliers) {
      all.push({ label: 'Supplier', to: '/tillflow/admin/suppliers', tiClass: 'ti-user-check' });
    }
    return all;
  }, [
    canQuotations,
    canInvoices,
    canInvoicePayments,
    canPurchases,
    canExpenses,
    canDeliveryNotes,
    canStockAdj,
    canStockXfer,
    canSalesReturns,
    canUsers,
    canCustomers,
    canSuppliers
  ]);
  const showInventory = canMasters || canItems || canReports;
  const showStock = canStores || canStockAdj || canStockXfer;
  const showSalesNav =
    canOrders ||
    canQuotations ||
    canInvoices ||
    canDeliveryNotes ||
    canCreditNotes ||
    canInvoicePayments ||
    canSalesReturns;
  const showPeople = canCustomers || canBillers || canSuppliers || canUsers;
  const showPurchasesSection = canPurchases || canPurReturns || canExpenses;
  const showSettingsTenantBlocks = canTenant;
  const { isOnline } = useOnlineStatus();
  const adminOutletBlockedOffline = !isOnline && !tillflowAdminPathAllowsOfflineUse(location.pathname);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [manageStocksOpen, setManageStocksOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGeneralOpen, setSettingsGeneralOpen] = useState(false);
  const [settingsWebsiteOpen, setSettingsWebsiteOpen] = useState(false);
  const [settingsAppOpen, setSettingsAppOpen] = useState(false);
  const [settingsSystemOpen, setSettingsSystemOpen] = useState(false);
  const [settingsFinancialOpen, setSettingsFinancialOpen] = useState(false);
  const [settingsOtherOpen, setSettingsOtherOpen] = useState(false);
  const [reportSubgroupOpen, setReportSubgroupOpen] = useState(() =>
    Object.fromEntries(REPORT_NAV_GROUPS.map((g) => [g.id, false]))
  );

  const adminTopbarAvatarSrc = resolveMediaUrl(user?.avatar_url);

  const syncSectionsToPath = useCallback((pathname) => {
    if (INVENTORY_PATH_RE.test(pathname)) {
      setInventoryOpen(true);
    }
    if (MANAGE_STOCKS_PATH_RE.test(pathname)) {
      setManageStocksOpen(true);
    }
    if (SALES_PATH_RE.test(pathname)) {
      setSalesOpen(true);
    }
    if (PEOPLE_PATH_RE.test(pathname)) {
      setPeopleOpen(true);
    }
    if (PURCHASES_PATH_RE.test(pathname)) {
      setPurchasesOpen(true);
    }
    if (REPORTS_SECTION_PATH_RE.test(pathname)) {
      setReportsOpen(true);
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
    if (pathname.startsWith('/tillflow/admin/settings')) {
      setSettingsOpen(true);
    }
    if (SETTINGS_GENERAL_PATH_RE.test(pathname)) {
      setSettingsGeneralOpen(true);
    }
    if (SETTINGS_WEBSITE_PATH_RE.test(pathname)) {
      setSettingsWebsiteOpen(true);
    }
    if (SETTINGS_APP_PATH_RE.test(pathname)) {
      setSettingsAppOpen(true);
    }
    if (SETTINGS_SYSTEM_PATH_RE.test(pathname)) {
      setSettingsSystemOpen(true);
    }
    if (SETTINGS_FINANCIAL_PATH_RE.test(pathname)) {
      setSettingsFinancialOpen(true);
    }
    if (SETTINGS_OTHER_PATH_RE.test(pathname)) {
      setSettingsOtherOpen(true);
    }
  }, []);

  useEffect(() => {
    syncSectionsToPath(location.pathname);
  }, [location.pathname, syncSectionsToPath]);

  useEffect(() => {
    if (!REPORTS_SECTION_PATH_RE.test(location.pathname)) {
      setReportSubgroupOpen(Object.fromEntries(REPORT_NAV_GROUPS.map((g) => [g.id, false])));
    }
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/tillflow/login', { replace: true });
  }

  return (
    <div className="tf-admin">
      <aside className="tf-admin__sidebar" aria-label="Admin navigation">
        <Link to="/tillflow" className="tf-brand tf-brand--link">
          <BreezeTechLogo className="tf-brand__logo" />
          <span className="tf-brand__product">TillFlow</span>
        </Link>
        <nav className="tf-nav">
          <NavLink to="/tillflow/admin" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <i className="feather icon-grid tf-nav__icon" aria-hidden />
            Dashboard
          </NavLink>
          {showInventory ? (
            <div className="tf-nav-group">
              <button
                type="button"
                className="tf-nav-group__hdr"
                onClick={() => setInventoryOpen((v) => !v)}
                aria-expanded={inventoryOpen}
              >
                Inventory
                <i className={`feather icon-chevron-${inventoryOpen ? 'up' : 'down'}`} aria-hidden />
              </button>
              {inventoryOpen ? (
                <div className="tf-nav-group__body">
                  {canItems ? (
                    <NavLink
                      to="/tillflow/admin/items"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-package tf-nav__icon" aria-hidden />
                      Items
                    </NavLink>
                  ) : null}
                  {canItems ? (
                    <NavLink
                      to="/tillflow/admin/add-product"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-plus-circle tf-nav__icon" aria-hidden />
                      Add item
                    </NavLink>
                  ) : null}
                  {canReports || canItems ? (
                    <NavLink
                      to="/tillflow/admin/expired-items"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-calendar tf-nav__icon" aria-hidden />
                      Expired items
                    </NavLink>
                  ) : null}
                  {canReports || canItems ? (
                    <NavLink
                      to="/tillflow/admin/low-stock"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-trending-down tf-nav__icon" aria-hidden />
                      Low stock
                    </NavLink>
                  ) : null}
                  {canMasters ? (
                    <NavLink to="/tillflow/admin/categories" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-tag tf-nav__icon" aria-hidden />
                      Categories
                    </NavLink>
                  ) : null}
                  {canMasters ? (
                    <NavLink to="/tillflow/admin/brands" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-award tf-nav__icon" aria-hidden />
                      Brands
                    </NavLink>
                  ) : null}
                  {canMasters ? (
                    <NavLink to="/tillflow/admin/units" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-hash tf-nav__icon" aria-hidden />
                      Units
                    </NavLink>
                  ) : null}
                  {canMasters ? (
                    <NavLink
                      to="/tillflow/admin/variant-attributes"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <i className="feather icon-sliders tf-nav__icon" aria-hidden />
                      Variant attributes
                    </NavLink>
                  ) : null}
                  {canMasters ? (
                    <NavLink
                      to="/tillflow/admin/warranties"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-shield tf-nav__icon" aria-hidden />
                      Warranties
                    </NavLink>
                  ) : null}
                  {canItems ? (
                    <NavLink
                      to="/tillflow/admin/print-barcode"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-printer tf-nav__icon" aria-hidden />
                      Print barcode
                    </NavLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {showStock ? (
            <div className="tf-nav-group">
              <button
                type="button"
                className="tf-nav-group__hdr"
                onClick={() => setManageStocksOpen((v) => !v)}
                aria-expanded={manageStocksOpen}
              >
                Stock
                <i className={`feather icon-chevron-${manageStocksOpen ? 'up' : 'down'}`} aria-hidden />
              </button>
              {manageStocksOpen ? (
                <div className="tf-nav-group__body">
                  {canStores ? (
                    <NavLink
                      to="/tillflow/admin/stores"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <i className="feather icon-home tf-nav__icon" aria-hidden />
                      Stores
                    </NavLink>
                  ) : null}
                  {canStockAdj ? (
                    <NavLink
                      to="/tillflow/admin/stock-adjustment"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <i className="feather icon-trending-up tf-nav__icon" aria-hidden />
                      Adjust Stock
                    </NavLink>
                  ) : null}
                  {canStockXfer ? (
                    <NavLink
                      to="/tillflow/admin/stock-transfer"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <i className="feather icon-corner-up-right tf-nav__icon" aria-hidden />
                      Transfer Stock
                    </NavLink>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {showSalesNav ? (
            <div className="tf-nav-group">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSalesOpen((v) => !v)}
              aria-expanded={salesOpen}
            >
              Sales
              <i className={`feather icon-chevron-${salesOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {salesOpen ? (
              <div className="tf-nav-group__body">
                {canOrders ? (
                <NavLink
                  to="/tillflow/admin/orders"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-file-text tf-nav__icon" aria-hidden />
                  Orders
                </NavLink>
                ) : null}
                {canQuotations ? (
                <NavLink
                  to="/tillflow/admin/quotations"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-clipboard tf-nav__icon" aria-hidden />
                  Quotations
                </NavLink>
                ) : null}
                {canInvoices ? (
                <NavLink
                  to="/tillflow/admin/invoices"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/invoices/') ? 'active' : undefined
                  }>
                  <i className="feather icon-credit-card tf-nav__icon" aria-hidden />
                  Invoices
                </NavLink>
                ) : null}
                {canDeliveryNotes ? (
                <NavLink
                  to="/tillflow/admin/delivery-notes"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/delivery-notes/') ? 'active' : undefined
                  }>
                  <i className="feather icon-truck tf-nav__icon" aria-hidden />
                  Delivery notes
                </NavLink>
                ) : null}
                {canCreditNotes ? (
                <NavLink
                  to="/tillflow/admin/credit-notes"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/credit-notes/') ? 'active' : undefined
                  }>
                  <i className="feather icon-file-minus tf-nav__icon" aria-hidden />
                  Credit notes
                </NavLink>
                ) : null}
                {canInvoicePayments ? (
                <NavLink
                  to="/tillflow/admin/invoice-payments"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Invoice payments
                </NavLink>
                ) : null}
                {canSalesReturns ? (
                <NavLink
                  to="/tillflow/admin/sales-returns"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-repeat tf-nav__icon" aria-hidden />
                  Sales returns
                </NavLink>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {showPeople ? (
          <div className="tf-nav-group">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setPeopleOpen((v) => !v)}
              aria-expanded={peopleOpen}
            >
              People
              <i className={`feather icon-chevron-${peopleOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {peopleOpen ? (
              <div className="tf-nav-group__body">
                {canCustomers ? (
                  <NavLink
                    to="/tillflow/admin/customers"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}>
                    <i className="feather icon-users tf-nav__icon" aria-hidden />
                    Customers
                  </NavLink>
                ) : null}
                {canBillers ? (
                  <NavLink
                    to="/tillflow/admin/billers"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}>
                    <i className="feather icon-user-check tf-nav__icon" aria-hidden />
                    Sellers
                  </NavLink>
                ) : null}
                {canSuppliers ? (
                  <NavLink
                    to="/tillflow/admin/suppliers"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}>
                    <i className="feather icon-truck tf-nav__icon" aria-hidden />
                    Suppliers
                  </NavLink>
                ) : null}
                {canUsers ? (
                  <NavLink
                    to="/tillflow/admin/settings/roles-permissions"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}>
                    <i className="feather icon-users tf-nav__icon" aria-hidden />
                    Roles & permissions
                  </NavLink>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {showPurchasesSection ? (
          <div className="tf-nav-group">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setPurchasesOpen((v) => !v)}
              aria-expanded={purchasesOpen}
            >
              Purchases
              <i className={`feather icon-chevron-${purchasesOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {purchasesOpen ? (
              <div className="tf-nav-group__body">
                {canPurchases ? (
                <NavLink
                  to="/tillflow/admin/purchases"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-download tf-nav__icon" aria-hidden />
                  Purchases
                </NavLink>
                ) : null}
                {canPurReturns ? (
                <NavLink
                  to="/tillflow/admin/purchase-returns"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-refresh-ccw tf-nav__icon" aria-hidden />
                  Purchase returns
                </NavLink>
                ) : null}
                {canExpenses ? (
                <NavLink
                  to="/tillflow/admin/expenses"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Expenses
                </NavLink>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {canReports ? (
            <div className="tf-nav-group">
              <button
                type="button"
                className="tf-nav-group__hdr"
                onClick={() => setReportsOpen((v) => !v)}
                aria-expanded={reportsOpen}
              >
                Reports
                <i className={`feather icon-chevron-${reportsOpen ? 'up' : 'down'}`} aria-hidden />
              </button>
              {reportsOpen ? (
                <div className="tf-nav-settings-nested">
                  <div className="tf-nav-group__body">
                    <NavLink
                      to="/tillflow/admin/reports"
                      end
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className="feather icon-pie-chart tf-nav__icon" aria-hidden />
                      All reports
                    </NavLink>
                  </div>
                  {reportNavGroupsVisible.map((group) => {
                    const subId = `tf-report-sub-${group.id}`;
                    const open = reportSubgroupOpen[group.id] === true;

                    return (
                      <div key={group.id} className="tf-nav-group tf-nav-group--settings">
                        <button
                          type="button"
                          className="tf-nav-group__hdr"
                          id={`${subId}-btn`}
                          onClick={() =>
                            setReportSubgroupOpen((prev) => ({
                              ...prev,
                              [group.id]: !prev[group.id]
                            }))
                          }
                          aria-expanded={open}
                          aria-controls={subId}
                        >
                          {group.label}
                          <i className={`feather icon-chevron-${open ? 'up' : 'down'}`} aria-hidden />
                        </button>
                        {open ? (
                          <div
                            className="tf-nav-group__body"
                            id={subId}
                            role="group"
                            aria-labelledby={`${subId}-btn`}>
                            {group.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end === true}
                                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                                <i className={`feather ${item.icon} tf-nav__icon`} aria-hidden />
                                {item.label}
                              </NavLink>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="tf-nav-group">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
            >
              Settings
              <i className={`feather icon-chevron-${settingsOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsOpen ? (
              <div className="tf-nav-settings-nested">
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsGeneralOpen((v) => !v)}
              aria-expanded={settingsGeneralOpen}
            >
              General settings
              <i className={`feather icon-chevron-${settingsGeneralOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsGeneralOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/profile"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-user tf-nav__icon" aria-hidden />
                  Profile
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/security"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-shield tf-nav__icon" aria-hidden />
                  Security
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/notifications"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-bell tf-nav__icon" aria-hidden />
                  Notifications
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/connected-apps"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-link-2 tf-nav__icon" aria-hidden />
                  Connected apps
                </NavLink>
              </div>
            ) : null}
          </div>
          {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsWebsiteOpen((v) => !v)}
              aria-expanded={settingsWebsiteOpen}
            >
              Website settings
              <i className={`feather icon-chevron-${settingsWebsiteOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsWebsiteOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/company"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-briefcase tf-nav__icon" aria-hidden />
                  Company
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/preference"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-sliders tf-nav__icon" aria-hidden />
                  Preference
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/appearance"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-sidebar tf-nav__icon" aria-hidden />
                  Appearance
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/social-authentication"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-share-2 tf-nav__icon" aria-hidden />
                  Social login
                </NavLink>
              </div>
            ) : null}
          </div>
          ) : null}
          {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsAppOpen((v) => !v)}
              aria-expanded={settingsAppOpen}
            >
              App settings
              <i className={`feather icon-chevron-${settingsAppOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsAppOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/invoice"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-file-text tf-nav__icon" aria-hidden />
                  Invoice
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/printer"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-printer tf-nav__icon" aria-hidden />
                  Printers
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/pos"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-monitor tf-nav__icon" aria-hidden />
                  POS
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/signatures"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-edit-3 tf-nav__icon" aria-hidden />
                  Signatures
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/custom-fields"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-layout tf-nav__icon" aria-hidden />
                  Custom fields
                </NavLink>
              </div>
            ) : null}
          </div>
          ) : null}
          {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsSystemOpen((v) => !v)}
              aria-expanded={settingsSystemOpen}
            >
              System settings
              <i className={`feather icon-chevron-${settingsSystemOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsSystemOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/system"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-settings tf-nav__icon" aria-hidden />
                  System
                </NavLink>
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/email"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-mail tf-nav__icon" aria-hidden />
                    Email
                  </NavLink>
                ) : null}
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/email-templates"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-layers tf-nav__icon" aria-hidden />
                    Email templates
                  </NavLink>
                ) : null}
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/sms-gateway"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-message-square tf-nav__icon" aria-hidden />
                    SMS gateway
                  </NavLink>
                ) : null}
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/sms-templates"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-message-circle tf-nav__icon" aria-hidden />
                    SMS templates
                  </NavLink>
                ) : null}
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/otp"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-key tf-nav__icon" aria-hidden />
                    OTP
                  </NavLink>
                ) : null}
                {canTenant ? (
                  <NavLink
                    to="/tillflow/admin/settings/gdpr"
                    className={({ isActive }) => (isActive ? 'active' : undefined)}
                  >
                    <i className="feather icon-shield tf-nav__icon" aria-hidden />
                    GDPR
                  </NavLink>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsFinancialOpen((v) => !v)}
              aria-expanded={settingsFinancialOpen}
            >
              Financial settings
              <i className={`feather icon-chevron-${settingsFinancialOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsFinancialOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/payment-gateway"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-credit-card tf-nav__icon" aria-hidden />
                  Payment gateway
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/bank-accounts"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-briefcase tf-nav__icon" aria-hidden />
                  Bank accounts
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/tax-rates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-percent tf-nav__icon" aria-hidden />
                  Tax rates
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/currencies"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Currencies
                </NavLink>
              </div>
            ) : null}
          </div>
          ) : null}
          {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsOtherOpen((v) => !v)}
              aria-expanded={settingsOtherOpen}
            >
              Other settings
              <i className={`feather icon-chevron-${settingsOtherOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsOtherOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/settings/storage"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-hard-drive tf-nav__icon" aria-hidden />
                  Storage
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/ban-ip"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-slash tf-nav__icon" aria-hidden />
                  Ban IP address
                </NavLink>
              </div>
            ) : null}
          </div>
          ) : null}
              </div>
            ) : null}
          </div>
        </nav>
      </aside>
      <div className="tf-admin__main">
        <header className="tf-admin__topbar">
          <h1 className="tf-admin__topbar-title">Admin console</h1>
          <div className="tf-admin__topbar-actions">
            {dashboardAddNewItems.length > 0 ? (
              <div className="dropdown link-nav tf-admin__add-new-dd">
                <Link
                  id="tf-admin-add-new-btn"
                  to="#"
                  className="tf-admin__add-new-btn btn btn-primary btn-md d-inline-flex align-items-center"
                  data-bs-toggle="dropdown"
                  onClick={(e) => {
                    e.preventDefault();
                  }}>
                  <i className="ti ti-circle-plus me-1" aria-hidden />
                  Add New
                </Link>
                <div
                  className="dropdown-menu dropdown-xl dropdown-menu-center"
                  aria-labelledby="tf-admin-add-new-btn">
                  <div className="row g-2">
                    {dashboardAddNewItems.map((item) => (
                      <div key={item.to + item.label} className="col-md-2">
                        <Link to={item.to} className="link-item text-decoration-none">
                          <span className="link-icon">
                            <i className={`ti ${item.tiClass}`} aria-hidden />
                          </span>
                          <p className="mb-0">{item.label}</p>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {canOrders ? (
              <Link
                to="/tillflow/pos"
                className="tf-btn tf-btn--sm tf-admin__topbar-pos"
                title="Open point of sale">
                <i className="feather icon-shopping-cart tf-btn__icon" aria-hidden />
                POS
              </Link>
            ) : null}
            <ThemeToggle />
            {user ? (
              <Link
                to="/tillflow/admin/settings/profile"
                className="tf-admin__user tf-admin__user-link tf-admin__user-with-avatar"
                title={user.email}>
                {adminTopbarAvatarSrc ? (
                  <img
                    src={adminTopbarAvatarSrc}
                    alt=""
                    className="tf-admin__user-avatar"
                    width={28}
                    height={28}
                  />
                ) : null}
                <span className="tf-admin__user-name">{user.name || user.email}</span>
              </Link>
            ) : null}
            <button type="button" className="tf-btn tf-btn--ghost tf-btn--sm" onClick={() => void handleLogout()}>
              <i className="feather icon-log-out tf-btn__icon" aria-hidden />
              Log out
            </button>
          </div>
        </header>
        <main className="tf-admin__body">
          {Array.isArray(user?.permissions) && user.permissions.length === 0 ? (
            <div className="alert alert-warning border-0 rounded-0 mb-0 py-3 px-3" role="status">
              <strong>No menu access.</strong> This account has no role permissions (empty sidebar). Use a user with an
              assigned role (e.g. multitenancy demo <strong>mt-a</strong> or <strong>mt-b</strong>, not{' '}
              <strong>mt-none</strong>), or ask an administrator to assign a role under Settings → Roles &amp;
              permissions. Log out and back in after roles change.
            </div>
          ) : null}
          {adminOutletBlockedOffline ? <AdminOfflineWait /> : <Outlet />}
        </main>
        <footer className="tf-admin__site-footer" aria-label="Site footer">
          <CommonFooter />
        </footer>
      </div>
    </div>
  );
}
