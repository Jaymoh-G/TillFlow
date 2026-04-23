import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordRequest } from '../api/auth';
import { TillFlowApiError } from '../api/errors';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function TillFlowForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors(null);
    setDoneMessage('');
    setSubmitting(true);
    try {
      await forgotPasswordRequest({ email });
      setDoneMessage('If that email exists, we sent a link to reset your password.');
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
      <h1 className="tf-landing__title">Reset password</h1>
      <p className="tf-landing__subtitle">
        Enter your account email. If it exists, you will receive a link to set a new password.
      </p>

      <form className="tf-form" onSubmit={handleSubmit}>
        {doneMessage ? (
          <div className="tf-alert tf-alert--success" style={{ marginBottom: '0.75rem' }}>
            {doneMessage}
          </div>
        ) : null}
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
            disabled={Boolean(doneMessage)}
          />
          {fieldErrors?.email ? <span className="tf-field-error">{fieldErrors.email[0]}</span> : null}
        </label>

        <button
          className="tf-btn tf-btn--primary"
          type="submit"
          disabled={submitting || Boolean(doneMessage)}
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--tf-muted)' }}>
        <Link to="/login">← Back to sign in</Link>
      </p>
    </div>
  );
}
