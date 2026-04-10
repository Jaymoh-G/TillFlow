import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AdminLayout from './layouts/AdminLayout';
import PosLayout from './layouts/PosLayout';
import AdminAddItem from './pages/AdminAddItem';
import AdminBrands from './pages/AdminBrands';
import AdminCategories from './pages/AdminCategories';
import AdminDashboard from './pages/AdminDashboard';
import AdminExpiredItems from './pages/AdminExpiredItems';
import AdminLowStock from './pages/AdminLowStock';
import AdminPrintBarcode from './pages/AdminPrintBarcode';
import AdminProducts from './pages/AdminProducts';
import AdminUnits from './pages/AdminUnits';
import AdminVariantAttributes from './pages/AdminVariantAttributes';
import AdminWarranties from './pages/AdminWarranties';
import ManageStock from '../feature-module/stock/manage-stock';
import StockAdjustment from '../feature-module/stock/stock-adjustment';
import StockTransfer from '../feature-module/stock/stock-transfer';
import ManageStores from '../feature-module/stores/manage-stores';
import OnlineOrder from '../feature-module/sales/online-order/online-orders';
import QuotationList from '../feature-module/sales/quotationlist';
import Invoice from '../feature-module/sales/invoicelist';
import AdminInvoicePayments from './pages/AdminInvoicePayments';
import AdminInvoicePaymentDetail from './pages/AdminInvoicePaymentDetail';
import AdminInvoiceDetail from './pages/AdminInvoiceDetail';
import AdminDeliveryNotes from './pages/AdminDeliveryNotes';
import AdminDeliveryNoteDetail from './pages/AdminDeliveryNoteDetail';
import AdminCreditNotes from './pages/AdminCreditNotes';
import AdminCreditNoteDetail from './pages/AdminCreditNoteDetail';
import AdminPosOrders from './pages/AdminPosOrders';
import AdminPosOrderDetail from './pages/AdminPosOrderDetail';
import SalesReturn from '../feature-module/sales/salesreturn';
import Customers from '../feature-module/people/customers';
import Biller from '../feature-module/people/billers';
import Suppliers from '../feature-module/people/suppliers';
import StoreList from '../feature-module/people/store-list';
import PurchasesList from '../feature-module/purchases/purchase-list';
import PurchaseOrderReport from '../feature-module/purchases/purchase-order-report';
import PurchaseReturns from '../feature-module/purchases/purchase-returns';
import ExpensesModule from '../feature-module/finance-accounts/expenses-module';
import GeneralSettings from '../feature-module/settings/generalsettings/generalsettings';
import SecuritySettings from '../feature-module/settings/generalsettings/securitysettings';
import Notification from '../feature-module/settings/generalsettings/notification';
import ConnectedApps from '../feature-module/settings/generalsettings/connectedapps';
import SystemSettings from '../feature-module/settings/websitesettings/systemsettings';
import CompanySettings from '../feature-module/settings/websitesettings/companysettings';
import Preference from '../feature-module/settings/websitesettings/preference';
import Appearance from '../feature-module/settings/websitesettings/appearance';
import SocialAuthentication from '../feature-module/settings/websitesettings/socialauthentication';
import InvoiceSettings from '../feature-module/settings/appsetting/invoicesettings';
import PrinterSettings from '../feature-module/settings/appsetting/printersettings';
import PosSettings from '../feature-module/settings/websitesettings/possettings';
import Signature from '../feature-module/settings/appsetting/signature';
import CustomFields from '../feature-module/settings/websitesettings/customfields';
import EmailSettings from '../feature-module/settings/systemsettings/emailsettings';
import Emailtemplatesettings from '../feature-module/settings/systemsettings/emailtemplatesettings';
import SmsGateway from '../feature-module/settings/systemsettings/smsgateway';
import Smstemplate from '../feature-module/settings/systemsettings/smstemplate';
import OtpSettings from '../feature-module/settings/systemsettings/otpsettings';
import GdprSettings from '../feature-module/settings/systemsettings/gdprsettings';
import PaymentGateway from '../feature-module/settings/financialsettings/paymentgateway';
import BankSettingGrid from '../feature-module/settings/financialsettings/banksettinggrid';
import TaxRates from '../feature-module/settings/financialsettings/taxrates';
import CurrencySettings from '../feature-module/settings/financialsettings/currencysettings';
import StorageSettings from '../feature-module/settings/othersettings/storagesettings';
import BanIpaddress from '../feature-module/settings/othersettings/ban-ipaddress';
import PosRegister from './pages/PosRegister';
import TillFlowLanding from './pages/TillFlowLanding';
import TillFlowLogin from './pages/TillFlowLogin';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import TenantUiSettingsBridge from './tenantUiSettings/TenantUiSettingsBridge';
import TenantUiSettingsSyncBanner from './tenantUiSettings/TenantUiSettingsSyncBanner';
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
        <TenantUiSettingsSyncBanner />
        <TillFlowRoot>
          <Routes>
            <Route index element={<TillFlowLanding />} />
            <Route path="login" element={<TillFlowLogin />} />
            <Route element={<RequireAuth />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="items/:productId/edit" element={<AdminAddItem />} />
                <Route path="items" element={<AdminProducts />} />
                <Route path="add-product" element={<AdminAddItem />} />
                <Route path="expired-items" element={<AdminExpiredItems />} />
                <Route path="low-stock" element={<AdminLowStock />} />
                <Route path="manage-stocks" element={<ManageStock />} />
                <Route path="stock-adjustment" element={<StockAdjustment />} />
                <Route path="stock-transfer" element={<StockTransfer />} />
                <Route path="stores" element={<ManageStores />} />
                <Route path="print-barcode" element={<AdminPrintBarcode />} />
                <Route path="pos-orders/:posOrderId" element={<AdminPosOrderDetail />} />
                <Route path="pos-orders" element={<AdminPosOrders />} />
                <Route path="online-orders" element={<OnlineOrder />} />
                <Route path="quotations/new" element={<QuotationList />} />
                <Route path="quotations/:quotationId/edit" element={<QuotationList />} />
                <Route path="quotations/:quotationId" element={<QuotationList />} />
                <Route path="quotations" element={<QuotationList />} />
                <Route path="invoices/new" element={<Invoice />} />
                <Route path="invoices/:invoiceId/edit" element={<Invoice />} />
                <Route path="invoices/:invoiceId" element={<AdminInvoiceDetail />} />
                <Route path="invoices" element={<Invoice />} />
                <Route path="delivery-notes/:deliveryNoteId" element={<AdminDeliveryNoteDetail />} />
                <Route path="delivery-notes" element={<AdminDeliveryNotes />} />
                <Route path="credit-notes/:creditNoteId" element={<AdminCreditNoteDetail />} />
                <Route path="credit-notes" element={<AdminCreditNotes />} />
                <Route path="invoice-payments/:paymentId" element={<AdminInvoicePaymentDetail />} />
                <Route path="invoice-payments" element={<AdminInvoicePayments />} />
                <Route path="sales-returns" element={<SalesReturn />} />
                <Route path="customers" element={<Customers />} />
                <Route path="billers" element={<Biller />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="store-managers" element={<StoreList />} />
                <Route path="purchases/new" element={<PurchasesList />} />
                <Route path="purchases/:purchaseId/edit" element={<PurchasesList />} />
                <Route path="purchases" element={<PurchasesList />} />
                <Route path="purchase-orders" element={<PurchaseOrderReport />} />
                <Route path="purchase-returns" element={<PurchaseReturns />} />
                <Route path="expenses" element={<ExpensesModule />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="brands" element={<AdminBrands />} />
                <Route path="units" element={<AdminUnits />} />
                <Route path="variant-attributes" element={<AdminVariantAttributes />} />
                <Route path="warranties" element={<AdminWarranties />} />
                <Route path="settings/profile" element={<GeneralSettings />} />
                <Route path="settings/security" element={<SecuritySettings />} />
                <Route path="settings/notifications" element={<Notification />} />
                <Route path="settings/connected-apps" element={<ConnectedApps />} />
                <Route path="settings/system" element={<SystemSettings />} />
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
            </Route>
            <Route path="pos" element={<PosLayout />}>
              <Route index element={<PosRegister />} />
            </Route>
            <Route path="*" element={<Navigate to="/tillflow" replace />} />
          </Routes>
        </TillFlowRoot>
      </AuthProvider>
    </ThemeProvider>
  );
}
