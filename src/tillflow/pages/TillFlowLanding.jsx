import { Link } from 'react-router-dom';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function TillFlowLanding() {
  return (
    <div className="tf-landing">
      <div className="tf-landing__top-actions">
        <ThemeToggle />
      </div>
      <div className="tf-landing__brand">
        <BreezeTechLogo className="tf-brand-logo tf-brand-logo--hero" />
        <p className="tf-landing__badge">TillFlow</p>
      </div>
      <h1 className="tf-landing__title">Choose a workspace</h1>
      <p className="tf-landing__subtitle">
        Sign in for the back office (Sanctum). POS stays open for register UI work.
      </p>
      <div className="tf-landing__grid">
        <Link to="/tillflow/admin" className="tf-card">
          <p className="tf-card__label">
            <i className="feather icon-home" aria-hidden />
            Back office
          </p>
          <h2 className="tf-card__title">Admin</h2>
          <p className="tf-card__desc">Dashboard (API health) and products — redirects to sign-in when needed.</p>
        </Link>
        <Link to="/tillflow/pos" className="tf-card">
          <p className="tf-card__label">
            <i className="feather icon-tablet" aria-hidden />
            Front line
          </p>
          <h2 className="tf-card__title">Point of sale</h2>
          <p className="tf-card__desc">Touch-friendly register layout with a clear top bar.</p>
        </Link>
      </div>
      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--tf-muted)' }}>
        <Link to="/tillflow/login">Admin sign in</Link>
        {' · '}
        Legacy template <Link to="/signin">/signin</Link>
      </p>
    </div>
  );
}
