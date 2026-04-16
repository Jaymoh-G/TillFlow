import ModernDashboard from "../../feature-module/dashboard/ModernDashboard";

/**
 * TillFlow admin home: same retail dashboard as /index and /admin-dashboard.
 * Footer is omitted because AdminLayout already renders CommonFooter.
 */
export default function AdminDashboard() {
  return <ModernDashboard hideFooter />;
}
