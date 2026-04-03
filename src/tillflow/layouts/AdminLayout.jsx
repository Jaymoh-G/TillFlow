import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

const INVENTORY_PATH_RE =
  /\/tillflow\/admin\/(items|add-product|expired-items|low-stock|categories|brands|units|variant-attributes|warranties)(\/|$)/;
const STOCK_PATH_RE =
  /\/tillflow\/admin\/(manage-stocks|stock-adjustment|stock-transfer|stores|print-barcode)(\/|$)/;
const SALES_PATH_RE =
  /\/tillflow\/admin\/(pos-orders|online-orders|quotations|invoices|sales-returns)(\/|$)/;
const PEOPLE_PATH_RE =
  /\/tillflow\/admin\/(customers|billers|suppliers|store-managers)(\/|$)/;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(true);

  const syncSectionsToPath = useCallback((pathname) => {
    if (INVENTORY_PATH_RE.test(pathname)) {
      setInventoryOpen(true);
    }
    if (STOCK_PATH_RE.test(pathname)) {
      setStockOpen(true);
    }
    if (SALES_PATH_RE.test(pathname)) {
      setSalesOpen(true);
    }
    if (PEOPLE_PATH_RE.test(pathname)) {
      setPeopleOpen(true);
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
              </div>
            ) : null}
          </div>
          <div className="tf-nav-group">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setStockOpen((v) => !v)}
              aria-expanded={stockOpen}
            >
              Stock
              <i className={`feather icon-chevron-${stockOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {stockOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/tillflow/admin/manage-stocks"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-layers tf-nav__icon" aria-hidden />
                  Manage stock
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
                  to="/tillflow/admin/stores"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-home tf-nav__icon" aria-hidden />
                  Stores
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
                  to="/tillflow/admin/online-orders"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-shopping-cart tf-nav__icon" aria-hidden />
                  Online orders
                </NavLink>
                <NavLink
                  to="/tillflow/admin/pos-orders"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-file-text tf-nav__icon" aria-hidden />
                  POS orders
                </NavLink>
                <NavLink
                  to="/tillflow/admin/quotations"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-clipboard tf-nav__icon" aria-hidden />
                  Quotations
                </NavLink>
                <NavLink
                  to="/tillflow/admin/invoices"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-credit-card tf-nav__icon" aria-hidden />
                  Invoices
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
                  Billers
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
          <div className="tf-nav-section">Placeholder</div>
          <span className="tf-nav--placeholder">Purchases</span>
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
              <span className="tf-admin__user" title={user.email}>
                {user.name || user.email}
              </span>
            ) : null}
            <button type="button" className="tf-btn tf-btn--ghost tf-btn--sm" onClick={() => void handleLogout()}>
              <i className="feather icon-log-out tf-btn__icon" aria-hidden />
              Log out
            </button>
          </div>
        </header>
        <main className="tf-admin__body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
