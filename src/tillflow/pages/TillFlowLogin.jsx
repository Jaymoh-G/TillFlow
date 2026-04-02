import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TillFlowApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function TillFlowLogin() {
  const { login, token, bootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/tillflow/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!bootstrapping && token) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setError(err.message);
        if (err.data && typeof err.data === 'object' && err.data.errors) {
          setFieldErrors(err.data.errors);
        }
      } else {
        setError('Network error. Is the API running and CORS configured?');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tf-landing">
      <div className="tf-landing__top-actions">
        <ThemeToggle />
      </div>
      <div className="tf-landing__brand">
        <BreezeTechLogo className="tf-brand-logo tf-brand-logo--hero" />
        <p className="tf-landing__badge">TillFlow</p>
      </div>
      <h1 className="tf-landing__title">Admin sign in</h1>
      <p className="tf-landing__subtitle">Use your TillFlow tenant account (Sanctum token).</p>

      <form className="tf-form" onSubmit={handleSubmit}>
        {error ? <div className="tf-alert tf-alert--error">{error}</div> : null}

        <label className="tf-label">
          Email
          <input
            className="tf-input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
          {fieldErrors?.email ? (
            <span className="tf-field-error">{fieldErrors.email[0]}</span>
          ) : null}
        </label>

        <label className="tf-label">
          Password
          <input
            className="tf-input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
          {fieldErrors?.password ? (
            <span className="tf-field-error">{fieldErrors.password[0]}</span>
          ) : null}
        </label>

        <button className="tf-btn tf-btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--tf-muted)' }}>
        <Link to="/tillflow">← Back to hub</Link>
      </p>
    </div>
  );
}
