import { Link, NavLink, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BreezeTechLogo from '../components/BreezeTechLogo';
import { PERMISSION } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { REPORT_NAV_GROUPS, filterReportNavGroupsForUser } from '../config/reportsNavigation';
import AdminSidebarReportsPanel from './AdminSidebarReportsPanel';
import AdminSidebarSettingsPanel from './AdminSidebarSettingsPanel';
import {
  pathnameToSidebarPanel,
  REPORTS_SECTION_PATH_RE,
  SETTINGS_APP_PATH_RE,
  SETTINGS_FINANCIAL_PATH_RE,
  SETTINGS_GENERAL_PATH_RE,
  SETTINGS_OTHER_PATH_RE,
  SETTINGS_SYSTEM_PATH_RE,
  SETTINGS_WEBSITE_PATH_RE,
  syncReportSubgroupFromPath
} from './adminSidebarPaths';

export default function AdminSidebarTwoColumn() {
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const isPlatformOwner = Boolean(user?.is_platform_owner);
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
  const canLeads = can('sales.leads.view');
  const canProposals = can('sales.proposals.view');
  const canInvoices = can('sales.invoices.view');
  const canDeliveryNotes = can('sales.delivery_notes.view');
  const canCreditNotes = can('sales.credit_notes.view');
  const canInvoicePayments = can('sales.invoice_payments.view');
  const canSalesReturns = can('sales.returns.view');
  const canCustomers = can('sales.customers.view');
  const canBillers = can('sales.billers.view');
  const canUsers = hasPermission(PERMISSION.USERS_MANAGE);
  const canReports = hasPermission(PERMISSION.REPORTS_VIEW);
  const canActivityLogs = hasPermission(PERMISSION.ACTIVITY_LOGS_VIEW);
  const canTenant = hasPermission(PERMISSION.TENANT_MANAGE);

  const reportNavGroupsVisible = useMemo(
    () => filterReportNavGroupsForUser(REPORT_NAV_GROUPS, hasPermission),
    [hasPermission]
  );

  const showInventory = canMasters || canItems || canReports;
  const showStock = canStores || canStockAdj || canStockXfer;
  const showSalesNav =
    canOrders ||
    canQuotations ||
    canLeads ||
    canProposals ||
    canInvoices ||
    canDeliveryNotes ||
    canCreditNotes ||
    canInvoicePayments ||
    canSalesReturns;
  const showPeople = canCustomers || canBillers || canSuppliers || canUsers;
  const showPurchasesSection = canPurchases || canPurReturns || canExpenses;

  const [activeSidebarPanel, setActiveSidebarPanel] = useState('dashboard');

  const [settingsGeneralOpen, setSettingsGeneralOpen] = useState(false);
  const [settingsWebsiteOpen, setSettingsWebsiteOpen] = useState(false);
  const [settingsAppOpen, setSettingsAppOpen] = useState(false);
  const [settingsSystemOpen, setSettingsSystemOpen] = useState(false);
  const [settingsFinancialOpen, setSettingsFinancialOpen] = useState(false);
  const [settingsOtherOpen, setSettingsOtherOpen] = useState(false);
  const [reportSubgroupOpen, setReportSubgroupOpen] = useState(() =>
    Object.fromEntries(REPORT_NAV_GROUPS.map((g) => [g.id, false]))
  );

  const railItems = useMemo(() => {
    /** @type {{ id: string; icon: string; label: string }[]} */
    const items = [{ id: 'dashboard', icon: 'icon-grid', label: 'Dashboard' }];
    if (isPlatformOwner) {
      items.push({ id: 'platform', icon: 'icon-layers', label: 'Platform' });
    }
    if (showInventory) {
      items.push({ id: 'inventory', icon: 'icon-package', label: 'Inventory' });
    }
    if (showStock) {
      items.push({ id: 'stock', icon: 'icon-layers', label: 'Stock' });
    }
    if (showSalesNav) {
      items.push({ id: 'sales', icon: 'icon-shopping-cart', label: 'Sales' });
    }
    if (showPeople) {
      items.push({ id: 'people', icon: 'icon-users', label: 'People' });
    }
    if (showPurchasesSection) {
      items.push({ id: 'purchases', icon: 'icon-download', label: 'Purchases' });
    }
    if (canReports || canActivityLogs) {
      items.push({ id: 'reports', icon: 'icon-pie-chart', label: 'Reports' });
    }
    items.push({ id: 'settings', icon: 'icon-settings', label: 'Settings' });
    return items;
  }, [
    isPlatformOwner,
    showInventory,
    showStock,
    showSalesNav,
    showPeople,
    showPurchasesSection,
    canReports,
    canActivityLogs
  ]);

  const syncSectionsToPath = useCallback((pathname) => {
    syncReportSubgroupFromPath(pathname, setReportSubgroupOpen);
    if (pathname.startsWith('/tillflow/admin/settings')) {
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
    }
  }, []);

  useEffect(() => {
    syncSectionsToPath(location.pathname);
    const panel = pathnameToSidebarPanel(location.pathname);
    if (panel) {
      setActiveSidebarPanel(panel);
    }
  }, [location.pathname, syncSectionsToPath]);

  useEffect(() => {
    if (!REPORTS_SECTION_PATH_RE.test(location.pathname)) {
      setReportSubgroupOpen(Object.fromEntries(REPORT_NAV_GROUPS.map((g) => [g.id, false])));
    }
  }, [location.pathname]);

  useEffect(() => {
    const allowed = new Set(railItems.map((r) => r.id));
    if (!allowed.has(activeSidebarPanel)) {
      setActiveSidebarPanel('dashboard');
    }
  }, [railItems, activeSidebarPanel]);

  const renderPanel = () => {
    switch (activeSidebarPanel) {
      case 'platform':
        return isPlatformOwner ? (
          <>
            <div className="tf-sidebar-panel__title">Platform</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
              <NavLink
                to="/tillflow/platform-owner/packages"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-package tf-nav__icon" aria-hidden />
                Packages
              </NavLink>
              <NavLink
                to="/tillflow/platform-owner/companies"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-briefcase tf-nav__icon" aria-hidden />
                Companies
              </NavLink>
              <NavLink
                to="/tillflow/platform-owner/subscribers"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-users tf-nav__icon" aria-hidden />
                Subscribers
              </NavLink>
            </div>
          </>
        ) : null;
      case 'dashboard':
        return (
          <>
            <div className="tf-sidebar-panel__title">Main</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
              <NavLink to="/tillflow/admin" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-grid tf-nav__icon" aria-hidden />
                Dashboard
              </NavLink>
              {canOrders ? (
                <NavLink
                  to="/tillflow/pos"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-monitor tf-nav__icon" aria-hidden />
                  Point of sale
                </NavLink>
              ) : null}
              {canReports ? (
                <NavLink
                  to="/tillflow/admin/reports"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/reports/') ? 'active' : undefined
                  }>
                  <i className="feather icon-pie-chart tf-nav__icon" aria-hidden />
                  Reports
                </NavLink>
              ) : null}
              <NavLink
                to="/tillflow/admin/settings/profile"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-user tf-nav__icon" aria-hidden />
                Profile
              </NavLink>
            </div>
          </>
        );
      case 'inventory':
        return showInventory ? (
          <>
            <div className="tf-sidebar-panel__title">Inventory</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
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
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
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
          </>
        ) : null;
      case 'stock':
        return showStock ? (
          <>
            <div className="tf-sidebar-panel__title">Stock</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
              {canStores ? (
                <NavLink
                  to="/tillflow/admin/stores"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-home tf-nav__icon" aria-hidden />
                  Stores
                </NavLink>
              ) : null}
              {canStockAdj ? (
                <NavLink
                  to="/tillflow/admin/stock-adjustment"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-trending-up tf-nav__icon" aria-hidden />
                  Adjust Stock
                </NavLink>
              ) : null}
              {canStockXfer ? (
                <NavLink
                  to="/tillflow/admin/stock-transfer"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-corner-up-right tf-nav__icon" aria-hidden />
                  Transfer Stock
                </NavLink>
              ) : null}
            </div>
          </>
        ) : null;
      case 'sales':
        return showSalesNav ? (
          <>
            <div className="tf-sidebar-panel__title">Sales</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
              {canOrders ? (
                <NavLink to="/tillflow/admin/orders" className={({ isActive }) => (isActive ? 'active' : undefined)}>
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
              {canLeads ? (
                <NavLink
                  to="/tillflow/admin/leads"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/leads') ? 'active' : undefined
                  }>
                  <i className="feather icon-user-plus tf-nav__icon" aria-hidden />
                  Leads
                </NavLink>
              ) : null}
              {canProposals ? (
                <NavLink
                  to="/tillflow/admin/proposals"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/proposals') ? 'active' : undefined
                  }>
                  <i className="feather icon-send tf-nav__icon" aria-hidden />
                  Proposals
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
          </>
        ) : null;
      case 'people':
        return showPeople ? (
          <>
            <div className="tf-sidebar-panel__title">People</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
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
          </>
        ) : null;
      case 'purchases':
        return showPurchasesSection ? (
          <>
            <div className="tf-sidebar-panel__title">Purchases</div>
            <div className="tf-nav-group__body tf-nav-group__body--panel">
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
          </>
        ) : null;
      case 'reports':
        return canReports || canActivityLogs ? (
          <AdminSidebarReportsPanel
            canReports={canReports}
            canActivityLogs={canActivityLogs}
            reportNavGroupsVisible={reportNavGroupsVisible}
            reportSubgroupOpen={reportSubgroupOpen}
            setReportSubgroupOpen={setReportSubgroupOpen}
          />
        ) : null;
      case 'settings':
        return (
          <AdminSidebarSettingsPanel
            canTenant={canTenant}
            settingsGeneralOpen={settingsGeneralOpen}
            setSettingsGeneralOpen={setSettingsGeneralOpen}
            settingsWebsiteOpen={settingsWebsiteOpen}
            setSettingsWebsiteOpen={setSettingsWebsiteOpen}
            settingsAppOpen={settingsAppOpen}
            setSettingsAppOpen={setSettingsAppOpen}
            settingsSystemOpen={settingsSystemOpen}
            setSettingsSystemOpen={setSettingsSystemOpen}
            settingsFinancialOpen={settingsFinancialOpen}
            setSettingsFinancialOpen={setSettingsFinancialOpen}
            settingsOtherOpen={settingsOtherOpen}
            setSettingsOtherOpen={setSettingsOtherOpen}
          />
        );
      default:
        return null;
    }
  };

  return (
    <aside className="tf-admin__sidebar tf-admin__sidebar--twocol" aria-label="Admin navigation">
      <div className="tf-admin__sidebar-rail" role="tablist" aria-label="Main sections">
        {railItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeSidebarPanel === item.id}
            className={`tf-admin__sidebar-rail__btn${activeSidebarPanel === item.id ? ' active' : ''}`}
            title={item.label}
            onClick={() => setActiveSidebarPanel(item.id)}>
            <i className={`feather ${item.icon}`} aria-hidden />
            <span className="visually-hidden">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="tf-admin__sidebar-panel">
        <div className="tf-sidebar-logo">
          <Link to="/tillflow" className="tf-brand tf-brand--link">
            <BreezeTechLogo className="tf-brand__logo" />
            <span className="tf-brand__product">TillFlow</span>
          </Link>
        </div>
        <div className="tf-sidebar-menu">
          <nav className="tf-nav tf-nav--twocol-panel" aria-label={`${activeSidebarPanel} menu`}>
            {renderPanel()}
          </nav>
        </div>
      </div>
    </aside>
  );
}
