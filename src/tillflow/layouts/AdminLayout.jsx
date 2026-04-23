import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import CommonFooter from '../../components/footer/commonFooter';
import { PERMISSION } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import TillflowThemeQuickPanel from '../components/TillflowThemeQuickPanel';
import TillflowNotificationMenu from '../components/TillflowNotificationMenu';
import AdminOfflineWait from '../offline/AdminOfflineWait';
import { tillflowAdminPathAllowsOfflineUse } from '../offline/tillflowOfflinePolicy';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import GlobalSearchTypeahead from '../components/GlobalSearchTypeahead';
import AdminSidebarTwoColumn from './AdminSidebarTwoColumn';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const can = (slug) => hasPermission(slug);
  const canStockAdj = can('inventory.stock_adjust.view');
  const canStockXfer = can('inventory.stock_transfer.view');
  const canPurchases = can('procurement.purchases.view');
  const canExpenses = can('finance.expenses.view');
  const canSuppliers = can('procurement.suppliers.view');
  const canOrders = can('sales.orders.view');
  const canQuotations = can('sales.quotations.view');
  const canInvoices = can('sales.invoices.view');
  const canDeliveryNotes = can('sales.delivery_notes.view');
  const canInvoicePayments = can('sales.invoice_payments.view');
  const canSalesReturns = can('sales.returns.view');
  const canCustomers = can('sales.customers.view');
  const canUsers = hasPermission(PERMISSION.USERS_MANAGE);
  const canGlobalSearch = hasPermission(PERMISSION.SEARCH_GLOBAL);

  /** Quick-add links (order fixed). Shown on every admin page when permitted. Same layout as main header Add New. */
  const dashboardAddNewItems = useMemo(() => {
    /** @type {{ label: string; to: string; tiClass: string }[]} */
    const all = [];
    if (canQuotations) {
      all.push({ label: 'Quotation', to: '/admin/quotations/new', tiClass: 'ti-device-floppy' });
    }
    if (canInvoices) {
      all.push({ label: 'Invoice', to: '/admin/invoices/new', tiClass: 'ti-file-invoice' });
    }
    if (canInvoicePayments) {
      all.push({ label: 'Payment', to: '/admin/invoice-payments', tiClass: 'ti-currency-dollar' });
    }
    if (canPurchases) {
      all.push({ label: 'Purchase', to: '/admin/purchases/new', tiClass: 'ti-shopping-bag' });
    }
    if (canExpenses) {
      all.push({ label: 'Expense', to: '/admin/expenses', tiClass: 'ti-file-text' });
    }
    if (canDeliveryNotes) {
      all.push({ label: 'Delivery note', to: '/admin/delivery-notes', tiClass: 'ti-truck-delivery' });
    }
    if (canStockAdj) {
      all.push({ label: 'Adjust Stock', to: '/admin/stock-adjustment', tiClass: 'ti-adjustments-horizontal' });
    }
    if (canStockXfer) {
      all.push({ label: 'Transfer Stock', to: '/admin/stock-transfer', tiClass: 'ti-arrows-right-left' });
    }
    if (canSalesReturns) {
      all.push({ label: 'Sale return', to: '/admin/sales-returns', tiClass: 'ti-copy' });
    }
    if (canUsers) {
      all.push({
        label: 'User',
        to: '/admin/settings/roles-permissions',
        tiClass: 'ti-user'
      });
    }
    if (canCustomers) {
      all.push({ label: 'Customer', to: '/admin/customers', tiClass: 'ti-users' });
    }
    if (canSuppliers) {
      all.push({ label: 'Supplier', to: '/admin/suppliers', tiClass: 'ti-user-check' });
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
  const { isOnline } = useOnlineStatus();
  const dataLayout = useSelector((state) => state.themeSetting.dataLayout);
  const effectiveLayoutClass = dataLayout === 'layout-hovered' ? 'mini' : dataLayout || 'default';
  const adminOutletBlockedOffline = !isOnline && !tillflowAdminPathAllowsOfflineUse(location.pathname);

  const adminTopbarAvatarSrc = resolveMediaUrl(user?.avatar_url);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    const shouldUseMiniSidebar = dataLayout === 'mini' || dataLayout === 'layout-hovered';
    document.body.classList.toggle('mini-sidebar', shouldUseMiniSidebar);
    return () => {
      document.body.classList.remove('mini-sidebar');
    };
  }, [dataLayout]);

  return (
    <div className={`tf-admin tf-admin--layout-${effectiveLayoutClass}`}>
      <AdminSidebarTwoColumn />
      <div className="tf-admin__main">
        <header className="tf-admin__topbar">
          <div className="tf-admin__topbar-start">
            {canGlobalSearch ? <GlobalSearchTypeahead className="tf-admin__topbar-search" /> : null}
          </div>
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
                to="/pos"
                className="tf-btn tf-btn--sm tf-admin__topbar-pos"
                title="Open point of sale">
                <i className="feather icon-shopping-cart tf-btn__icon" aria-hidden />
                POS
              </Link>
            ) : null}
            <TillflowNotificationMenu className="tf-admin__notif" />
            <ThemeToggle />
            {user ? (
              <Link
                to="/admin/settings/profile"
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
      <TillflowThemeQuickPanel />
    </div>
  );
}
