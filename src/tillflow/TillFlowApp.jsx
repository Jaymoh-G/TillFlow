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
import PosRegister from './pages/PosRegister';
import TillFlowLanding from './pages/TillFlowLanding';
import TillFlowLogin from './pages/TillFlowLogin';
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
                <Route path="categories" element={<AdminCategories />} />
                <Route path="brands" element={<AdminBrands />} />
                <Route path="units" element={<AdminUnits />} />
                <Route path="variant-attributes" element={<AdminVariantAttributes />} />
                <Route path="warranties" element={<AdminWarranties />} />
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
