import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

function formatClock(d) {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function PosLayout() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tf-pos">
      <header className="tf-pos__bar">
        <div className="tf-pos__brand tf-pos__brand-mark">
          <BreezeTechLogo className="tf-brand-logo tf-brand-logo--bar" />
          <span className="tf-pos__wordmark">
            Till<span className="tf-pos__wordmark-accent">Flow</span>
            <span className="tf-pos__pos-badge">
              <i className="feather icon-shopping-cart" aria-hidden />
              POS
            </span>
          </span>
        </div>
        <div className="tf-pos__actions">
          <ThemeToggle />
          <span className="tf-pos__clock tf-mono">{formatClock(now)}</span>
          <div className="tf-pos__links">
            <Link to="/tillflow/admin" className="tf-link-quiet">
              Admin
            </Link>
            <Link to="/tillflow">Hub</Link>
          </div>
        </div>
      </header>
      <div className="tf-pos__stage">
        <Outlet />
      </div>
    </div>
  );
}
