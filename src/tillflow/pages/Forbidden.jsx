import { Link } from 'react-router-dom';

export default function Forbidden({ title = 'No permission', detail }) {
  return (
    <div className="tf-card tf-card--pad" style={{ maxWidth: 520, margin: '2rem auto' }}>
      <h1 className="tf-admin__topbar-title" style={{ marginBottom: '0.5rem' }}>
        {title}
      </h1>
      <p className="tf-muted" style={{ marginBottom: '1rem' }}>
        {detail ||
          'Your account does not have access to this area. Ask an administrator to update your role.'}
      </p>
      <Link to="/admin" className="tf-btn tf-btn--primary tf-btn--sm">
        Back to dashboard
      </Link>
    </div>
  );
}
