import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth() {
  const { bootstrapping, token } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <div className="tf-auth-loading">Loading session…</div>;
  }

  if (!token) {
    return <Navigate to="/tillflow/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
