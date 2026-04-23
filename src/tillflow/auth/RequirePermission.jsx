import { Navigate, Outlet } from 'react-router-dom';
import Forbidden from '../pages/Forbidden';
import { useAuth } from './AuthContext';

/**
 * @param {object} props
 * @param {string[]} [props.anyOf] — user needs at least one of these permission slugs
 * @param {string[]} [props.allOf] — user needs every listed slug
 */
export default function RequirePermission({ anyOf = [], allOf = [], children }) {
  const { user, bootstrapping, hasAnyPermission, hasEveryPermission } = useAuth();

  if (bootstrapping) {
    return (
      <div className="tf-card tf-card--pad" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <p className="tf-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const okAny = anyOf.length === 0 || hasAnyPermission(anyOf);
  const okAll = allOf.length === 0 || hasEveryPermission(allOf);

  if (!okAny || !okAll) {
    return <Forbidden title="No permission" />;
  }

  return children ?? <Outlet />;
}
