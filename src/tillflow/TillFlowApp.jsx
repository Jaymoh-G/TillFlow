import { Navigate, Route, Routes } from 'react-router-dom';
import ExpensesModule from '../feature-module/finance-accounts/expenses-module';
import Biller from '../feature-module/people/billers';
import Customers from '../feature-module/people/customers';
import Suppliers from '../feature-module/people/suppliers';
import PurchasesList from '../feature-module/purchases/purchase-list';
import PurchaseOrderReport from '../feature-module/purchases/purchase-order-report';
import PurchaseReturns from '../feature-module/purchases/purchase-returns';
import Invoice from '../feature-module/sales/invoicelist';
import QuotationList from '../feature-module/sales/quotationlist';
import AdminSalesReturns from './pages/AdminSalesReturns';
import InvoiceSettings from '../feature-module/settings/appsetting/invoicesettings';
import PrinterSettings from '../feature-module/settings/appsetting/printersettings';
import Signature from '../feature-module/settings/appsetting/signature';
import BankSettingGrid from '../feature-module/settings/financialsettings/banksettinggrid';
import CurrencySettings from '../feature-module/settings/financialsettings/currencysettings';
import PaymentGateway from '../feature-module/settings/financialsettings/paymentgateway';
import TaxRates from '../feature-module/settings/financialsettings/taxrates';
import ConnectedApps from '../feature-module/settings/generalsettings/connectedapps';
import GeneralSettings from '../feature-module/settings/generalsettings/generalsettings';
import Notification from '../feature-module/settings/generalsettings/notification';
import SecuritySettings from '../feature-module/settings/generalsettings/securitysettings';
import BanIpaddress from '../feature-module/settings/othersettings/ban-ipaddress';
import StorageSettings from '../feature-module/settings/othersettings/storagesettings';
import EmailSettings from '../feature-module/settings/systemsettings/emailsettings';
import Emailtemplatesettings from '../feature-module/settings/systemsettings/emailtemplatesettings';
import GdprSettings from '../feature-module/settings/systemsettings/gdprsettings';
import OtpSettings from '../feature-module/settings/systemsettings/otpsettings';
import SmsGateway from '../feature-module/settings/systemsettings/smsgateway';
import Smstemplate from '../feature-module/settings/systemsettings/smstemplate';
import Appearance from '../feature-module/settings/websitesettings/appearance';
import CompanySettings from '../feature-module/settings/websitesettings/companysettings';
import CustomFields from '../feature-module/settings/websitesettings/customfields';
import PosSettings from '../feature-module/settings/websitesettings/possettings';
import Preference from '../feature-module/settings/websitesettings/preference';
import SocialAuthentication from '../feature-module/settings/websitesettings/socialauthentication';
import SystemSettings from '../feature-module/settings/websitesettings/systemsettings';
import AutomationSettings from '../feature-module/settings/systemsettings/automationsettings';
import StockAdjustment from '../feature-module/stock/stock-adjustment';
import StockTransfer from '../feature-module/stock/stock-transfer';
import ManageStores from '../feature-module/stores/manage-stores';
import Packages from '../feature-module/super-admin/packages/packagelist';
import Subscription from '../feature-module/super-admin/subscription';
import { AuthProvider } from './auth/AuthContext';
import { M, PERMISSION, vm } from './auth/permissions';
import RequireAuth from './auth/RequireAuth';
import RequirePermission from './auth/RequirePermission';
import AdminLayout from './layouts/AdminLayout';
import PosLayout from './layouts/PosLayout';
import AdminAddItem from './pages/AdminAddItem';
import AdminBrands from './pages/AdminBrands';
import AdminCategories from './pages/AdminCategories';
import AdminCreditNoteDetail from './pages/AdminCreditNoteDetail';
import AdminCreditNotes from './pages/AdminCreditNotes';
import AdminDashboard from './pages/AdminDashboard';
import AdminDeliveryNoteDetail from './pages/AdminDeliveryNoteDetail';
import AdminDeliveryNotes from './pages/AdminDeliveryNotes';
import AdminActivityLogs from './pages/AdminActivityLogs';
import AdminNotifications from './pages/AdminNotifications';
import AdminExpiredItems from './pages/AdminExpiredItems';
import AdminInvoiceDetail from './pages/AdminInvoiceDetail';
import AdminInvoicePaymentDetail from './pages/AdminInvoicePaymentDetail';
import AdminInvoicePayments from './pages/AdminInvoicePayments';
import AdminLeadDetail from './pages/AdminLeadDetail';
import AdminLeads from './pages/AdminLeads';
import AdminLowStock from './pages/AdminLowStock';
import AdminPosOrderDetail from './pages/AdminPosOrderDetail';
import AdminPosOrders from './pages/AdminPosOrders';
import AdminPrintBarcode from './pages/AdminPrintBarcode';
import AdminProducts from './pages/AdminProducts';
import AdminInvoiceReport from './pages/AdminInvoiceReport';
import AdminPosSalesReport from './pages/AdminPosSalesReport';
import AdminReportsHub from './pages/AdminReportsHub';
import AdminReportRunner from './pages/AdminReportRunner';
import AdminRoles from './pages/AdminRoles';
import AdminUnits from './pages/AdminUnits';
import AdminVariantAttributes from './pages/AdminVariantAttributes';
import AdminWarranties from './pages/AdminWarranties';
import PosRegister from './pages/PosRegister';
import TillFlowForgotPassword from './pages/TillFlowForgotPassword';
import TillFlowInviteAccept from './pages/TillFlowInviteAccept';
import TillFlowLanding from './pages/TillFlowLanding';
import TillFlowLogin from './pages/TillFlowLogin';
import TillflowPushBootstrap from './components/TillflowPushBootstrap';
import TenantUiSettingsBridge from './tenantUiSettings/TenantUiSettingsBridge';
import TenantUiSettingsSyncBanner from './tenantUiSettings/TenantUiSettingsSyncBanner';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import './tillflow.scss';

function TillFlowRoot({ children }) {
  const { theme } = useTheme();
  const rootClass = theme === 'light' ? 'tillflow-root tillflow-root--light' : 'tillflow-root';
  return <div className={rootClass}>{children}</div>;
}

export default function TillFlowApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantUiSettingsBridge />
        <TillflowPushBootstrap />
        <TenantUiSettingsSyncBanner />
        <TillFlowRoot>
          <Routes>
            <Route index element={<TillFlowLanding />} />
            <Route path="login" element={<TillFlowLogin />} />
            <Route path="forgot-password" element={<TillFlowForgotPassword />} />
            <Route path="invite/accept" element={<TillFlowInviteAccept />} />
            <Route element={<RequireAuth />}>
              <Route path="platform-owner/packages" element={<Packages />} />
              <Route path="platform-owner/subscription" element={<Subscription />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />

                <Route element={<RequirePermission anyOf={vm(M.CATALOG_MASTERS)} />}>
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="brands" element={<AdminBrands />} />
                  <Route path="units" element={<AdminUnits />} />
                  <Route path="variant-attributes" element={<AdminVariantAttributes />} />
                  <Route path="warranties" element={<AdminWarranties />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.CATALOG_ITEMS)} />}>
                  <Route path="items/:productId/edit" element={<AdminAddItem />} />
                  <Route path="items" element={<AdminProducts />} />
                  <Route path="add-product" element={<AdminAddItem />} />
                  <Route path="print-barcode" element={<AdminPrintBarcode />} />
                </Route>

                <Route
                  element={
                    <RequirePermission anyOf={[...vm(M.STOCK_ADJUST), ...vm(M.STOCK_TRANSFER)]} />
                  }>
                  <Route
                    path="manage-stocks"
                    element={<Navigate to="/tillflow/admin/stock-adjustment" replace />}
                  />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.STOCK_ADJUST)} />}>
                  <Route path="stock-adjustment" element={<StockAdjustment />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.STOCK_TRANSFER)} />}>
                  <Route path="stock-transfer" element={<StockTransfer />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.STORES)} />}>
                  <Route path="stores" element={<ManageStores />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.PURCHASES)} />}>
                  <Route path="purchases/new" element={<PurchasesList />} />
                  <Route path="purchases/:purchaseId/edit" element={<PurchasesList />} />
                  <Route path="purchases" element={<PurchasesList />} />
                  <Route path="purchase-orders" element={<PurchaseOrderReport />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.PURCHASE_RETURNS)} />}>
                  <Route path="purchase-returns" element={<PurchaseReturns />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.EXPENSES)} />}>
                  <Route path="expenses" element={<ExpensesModule />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.SUPPLIERS)} />}>
                  <Route path="suppliers" element={<Suppliers />} />
                </Route>

                <Route
                  element={
                    <RequirePermission anyOf={[...vm(M.CATALOG_ITEMS), PERMISSION.REPORTS_VIEW]} />
                  }>
                  <Route path="expired-items" element={<AdminExpiredItems />} />
                  <Route path="low-stock" element={<AdminLowStock />} />
                </Route>

                <Route element={<RequirePermission anyOf={[PERMISSION.REPORTS_VIEW]} />}>
                  <Route path="reports" element={<AdminReportsHub />} />
                  <Route path="reports/invoice-report" element={<AdminInvoiceReport />} />
                  <Route path="reports/pos-sales" element={<AdminPosSalesReport />} />
                  <Route path="reports/:slug" element={<AdminReportRunner />} />
                </Route>

                <Route element={<RequirePermission anyOf={[PERMISSION.ACTIVITY_LOGS_VIEW]} />}>
                  <Route path="activity-logs" element={<AdminActivityLogs />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.ORDERS)} />}>
                  <Route path="orders/:posOrderId" element={<AdminPosOrderDetail />} />
                  <Route path="orders" element={<AdminPosOrders />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.QUOTATIONS)} />}>
                  <Route path="quotations/new" element={<QuotationList />} />
                  <Route path="quotations/:quotationId/edit" element={<QuotationList />} />
                  <Route path="quotations/:quotationId" element={<QuotationList />} />
                  <Route path="quotations" element={<QuotationList />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.LEADS)} />}>
                  <Route path="leads/:leadId" element={<AdminLeadDetail />} />
                  <Route path="leads" element={<AdminLeads />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.PROPOSALS)} />}>
                  <Route path="proposals/new" element={<QuotationList />} />
                  <Route path="proposals/:proposalId/edit" element={<QuotationList />} />
                  <Route path="proposals/:proposalId" element={<QuotationList />} />
                  <Route path="proposals" element={<QuotationList />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.INVOICES)} />}>
                  <Route path="invoices/new" element={<Invoice />} />
                  <Route path="invoices/:invoiceId/edit" element={<Invoice />} />
                  <Route path="invoices/:invoiceId" element={<AdminInvoiceDetail />} />
                  <Route path="invoices" element={<Invoice />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.DELIVERY_NOTES)} />}>
                  <Route path="delivery-notes/:deliveryNoteId" element={<AdminDeliveryNoteDetail />} />
                  <Route path="delivery-notes" element={<AdminDeliveryNotes />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.CREDIT_NOTES)} />}>
                  <Route path="credit-notes/:creditNoteId" element={<AdminCreditNoteDetail />} />
                  <Route path="credit-notes" element={<AdminCreditNotes />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.INVOICE_PAYMENTS)} />}>
                  <Route path="invoice-payments/:paymentId" element={<AdminInvoicePaymentDetail />} />
                  <Route path="invoice-payments" element={<AdminInvoicePayments />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.RETURNS)} />}>
                  <Route path="sales-returns" element={<AdminSalesReturns />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.CUSTOMERS)} />}>
                  <Route path="customers" element={<Customers />} />
                </Route>

                <Route element={<RequirePermission anyOf={vm(M.BILLERS)} />}>
                  <Route path="billers" element={<Biller />} />
                </Route>

                <Route path="settings/profile" element={<GeneralSettings />} />
                <Route path="settings/security" element={<SecuritySettings />} />
                <Route path="settings/notifications" element={<Notification />} />
                <Route path="settings/connected-apps" element={<ConnectedApps />} />

                <Route element={<RequirePermission anyOf={[PERMISSION.TENANT_MANAGE]} />}>
                  <Route path="settings/system" element={<SystemSettings />} />
                  <Route path="settings/automation" element={<AutomationSettings />} />
                  <Route path="settings/company" element={<CompanySettings />} />
                  <Route path="settings/preference" element={<Preference />} />
                  <Route path="settings/appearance" element={<Appearance />} />
                  <Route path="settings/social-authentication" element={<SocialAuthentication />} />
                  <Route path="settings/invoice" element={<InvoiceSettings />} />
                  <Route path="settings/printer" element={<PrinterSettings />} />
                  <Route path="settings/pos" element={<PosSettings />} />
                  <Route path="settings/signatures" element={<Signature />} />
                  <Route path="settings/custom-fields" element={<CustomFields />} />
                  <Route path="settings/email" element={<EmailSettings />} />
                  <Route path="settings/email-templates" element={<Emailtemplatesettings />} />
                  <Route path="settings/sms-gateway" element={<SmsGateway />} />
                  <Route path="settings/sms-templates" element={<Smstemplate />} />
                  <Route path="settings/otp" element={<OtpSettings />} />
                  <Route path="settings/gdpr" element={<GdprSettings />} />
                  <Route path="settings/payment-gateway" element={<PaymentGateway />} />
                  <Route path="settings/bank-accounts" element={<BankSettingGrid />} />
                  <Route path="settings/tax-rates" element={<TaxRates />} />
                  <Route path="settings/currencies" element={<CurrencySettings />} />
                  <Route path="settings/storage" element={<StorageSettings />} />
                  <Route path="settings/ban-ip" element={<BanIpaddress />} />
                </Route>

                <Route element={<RequirePermission anyOf={[PERMISSION.USERS_MANAGE]} />}>
                  <Route path="settings/roles-permissions" element={<AdminRoles />} />
                </Route>
              </Route>
            </Route>
            <Route
              path="pos"
              element={
                <RequirePermission anyOf={vm(M.ORDERS)}>
                  <PosLayout />
                </RequirePermission>
              }>
              <Route index element={<PosRegister />} />
            </Route>
            <Route path="*" element={<Navigate to="/tillflow" replace />} />
          </Routes>
        </TillFlowRoot>
      </AuthProvider>
    </ThemeProvider>
  );
}
