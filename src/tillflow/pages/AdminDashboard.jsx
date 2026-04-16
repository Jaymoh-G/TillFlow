import ModernDashboard from "../../feature-module/dashboard/ModernDashboard";
import { useAuth } from "../auth/AuthContext";

/**
 * TillFlow admin home: same retail dashboard as /index and /admin-dashboard.
 * Footer is omitted because AdminLayout already renders CommonFooter.
 */
export default function AdminDashboard() {
  const { token } = useAuth();
  return (
    <ModernDashboard
      hideFooter
      hideRecentSales
      tillflowToken={token}
      customerListPath="/tillflow/admin/customers"
    />
  );
}
