import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import CommonFooter from '../../components/footer/commonFooter';
import { useAuth } from '../auth/AuthContext';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';
import AdminOfflineWait from '../offline/AdminOfflineWait';
import {
  TILLFLOW_ADMIN_SALES_NAV_PATH_RE,
  tillflowAdminPathAllowsOfflineUse
} from '../offline/tillflowOfflinePolicy';
import { useOnlineStatus } from '../offline/useOnlineStatus';

const INVENTORY_PATH_RE =
  /\/tillflow\/admin\/(items|add-product|expired-items|low-stock|categories|brands|units|variant-attributes|warranties|manage-stocks|stock-adjustment|stock-transfer|stores|print-barcode)(\/|$)/;
const SALES_PATH_RE = TILLFLOW_ADMIN_SALES_NAV_PATH_RE;
const PEOPLE_PATH_RE =
  /\/tillflow\/admin\/(customers|billers|suppliers|store-managers)(\/|$)/;
const PURCHASES_PATH_RE =
  /\/tillflow\/admin\/(purchases|purchase-returns)(\/|$)/;
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
  const { user, logout } = useAuth();
  const { isOnline } = useOnlineStatus();
  const adminOutletBlockedOffline = !isOnline && !tillflowAdminPathAllowsOfflineUse(location.pathname);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGeneralOpen, setSettingsGeneralOpen] = useState(false);
  const [settingsWebsiteOpen, setSettingsWebsiteOpen] = useState(false);
  const [settingsAppOpen, setSettingsAppOpen] = useState(false);
  const [settingsSystemOpen, setSettingsSystemOpen] = useState(false);
  const [settingsFinancialOpen, setSettingsFinancialOpen] = useState(false);
  const [settingsOtherOpen, setSettingsOtherOpen] = useState(false);

  const syncSectionsToPath = useCallback((pathname) => {
    if (INVENTORY_PATH_RE.test(pathname)) {
      setInventoryOpen(true);
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
                <NavLink
                  to="/tillflow/admin/items"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-package tf-nav__icon" aria-hidden />
                  Items
                </NavLink>
                <NavLink
                  to="/tillflow/admin/add-product"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-plus-circle tf-nav__icon" aria-hidden />
                  Add item
                </NavLink>
                <NavLink
                  to="/tillflow/admin/expired-items"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-calendar tf-nav__icon" aria-hidden />
                  Expired items
                </NavLink>
                <NavLink
                  to="/tillflow/admin/low-stock"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-trending-down tf-nav__icon" aria-hidden />
                  Low stock
                </NavLink>
                <NavLink to="/tillflow/admin/categories" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-tag tf-nav__icon" aria-hidden />
                  Categories
                </NavLink>
                <NavLink to="/tillflow/admin/brands" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-award tf-nav__icon" aria-hidden />
                  Brands
                </NavLink>
                <NavLink to="/tillflow/admin/units" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-hash tf-nav__icon" aria-hidden />
                  Units
                </NavLink>
                <NavLink
                  to="/tillflow/admin/variant-attributes"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-sliders tf-nav__icon" aria-hidden />
                  Variant attributes
                </NavLink>
                <NavLink
                  to="/tillflow/admin/warranties"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-shield tf-nav__icon" aria-hidden />
                  Warranties
                </NavLink>
                <NavLink
                  to="/tillflow/admin/manage-stocks"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-layers tf-nav__icon" aria-hidden />
                  Manage stock
                </NavLink>
                <NavLink
                  to="/tillflow/admin/stores"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-home tf-nav__icon" aria-hidden />
                  Stores
                </NavLink>
                <NavLink
                  to="/tillflow/admin/stock-adjustment"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-trending-up tf-nav__icon" aria-hidden />
                  Stock adjustment
                </NavLink>
                <NavLink
                  to="/tillflow/admin/stock-transfer"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-corner-up-right tf-nav__icon" aria-hidden />
                  Stock transfer
                </NavLink>
                <NavLink
                  to="/tillflow/admin/print-barcode"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-printer tf-nav__icon" aria-hidden />
                  Print barcode
                </NavLink>
              </div>
            ) : null}
          </div>
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
                <NavLink
                  to="/tillflow/admin/orders"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-file-text tf-nav__icon" aria-hidden />
                  Orders
                </NavLink>
                <NavLink
                  to="/tillflow/admin/quotations"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-clipboard tf-nav__icon" aria-hidden />
                  Quotations
                </NavLink>
                <NavLink
                  to="/tillflow/admin/invoices"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/invoices/') ? 'active' : undefined
                  }>
                  <i className="feather icon-credit-card tf-nav__icon" aria-hidden />
                  Invoices
                </NavLink>
                <NavLink
                  to="/tillflow/admin/delivery-notes"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/delivery-notes/') ? 'active' : undefined
                  }>
                  <i className="feather icon-truck tf-nav__icon" aria-hidden />
                  Delivery notes
                </NavLink>
                <NavLink
                  to="/tillflow/admin/credit-notes"
                  className={({ isActive }) =>
                    isActive || location.pathname.startsWith('/tillflow/admin/credit-notes/') ? 'active' : undefined
                  }>
                  <i className="feather icon-file-minus tf-nav__icon" aria-hidden />
                  Credit notes
                </NavLink>
                <NavLink
                  to="/tillflow/admin/invoice-payments"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Invoice payments
                </NavLink>
                <NavLink
                  to="/tillflow/admin/sales-returns"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-repeat tf-nav__icon" aria-hidden />
                  Sales returns
                </NavLink>
              </div>
            ) : null}
          </div>
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
                <NavLink
                  to="/tillflow/admin/customers"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-users tf-nav__icon" aria-hidden />
                  Customers
                </NavLink>
                <NavLink
                  to="/tillflow/admin/billers"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-user-check tf-nav__icon" aria-hidden />
                  Sellers
                </NavLink>
                <NavLink
                  to="/tillflow/admin/suppliers"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-truck tf-nav__icon" aria-hidden />
                  Suppliers
                </NavLink>
                <NavLink
                  to="/tillflow/admin/store-managers"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-shopping-bag tf-nav__icon" aria-hidden />
                  Store managers
                </NavLink>
              </div>
            ) : null}
          </div>
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
                <NavLink
                  to="/tillflow/admin/purchases"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-download tf-nav__icon" aria-hidden />
                  Purchases
                </NavLink>
                <NavLink
                  to="/tillflow/admin/purchase-returns"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-refresh-ccw tf-nav__icon" aria-hidden />
                  Purchase returns
                </NavLink>
                <NavLink
                  to="/tillflow/admin/expenses"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Expenses
                </NavLink>
              </div>
            ) : null}
          </div>
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
                <NavLink
                  to="/tillflow/admin/settings/email"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-mail tf-nav__icon" aria-hidden />
                  Email
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/email-templates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-layers tf-nav__icon" aria-hidden />
                  Email templates
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/sms-gateway"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-message-square tf-nav__icon" aria-hidden />
                  SMS gateway
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/sms-templates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-message-circle tf-nav__icon" aria-hidden />
                  SMS templates
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/otp"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-key tf-nav__icon" aria-hidden />
                  OTP
                </NavLink>
                <NavLink
                  to="/tillflow/admin/settings/gdpr"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <i className="feather icon-shield tf-nav__icon" aria-hidden />
                  GDPR
                </NavLink>
              </div>
            ) : null}
          </div>
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
              </div>
            ) : null}
          </div>
          <div className="tf-nav-section">Placeholder</div>
          <span className="tf-nav--placeholder">Reports</span>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <NavLink to="/tillflow" className="tf-link-quiet tf-sidebar-footer-link">
            <i className="feather icon-arrow-left tf-nav__icon" aria-hidden />
            Hub
          </NavLink>
        </div>
      </aside>
      <div className="tf-admin__main">
        <header className="tf-admin__topbar">
          <h1 className="tf-admin__topbar-title">Admin console</h1>
          <div className="tf-admin__topbar-actions">
            <ThemeToggle />
            {user ? (
              <Link
                to="/tillflow/admin/settings/profile"
                className="tf-admin__user tf-admin__user-link tf-admin__user-with-avatar"
                title={user.email}>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
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
          {adminOutletBlockedOffline ? <AdminOfflineWait /> : <Outlet />}
        </main>
        <footer className="tf-admin__site-footer" aria-label="Site footer">
          <CommonFooter />
        </footer>
      </div>
    </div>
  );
}
