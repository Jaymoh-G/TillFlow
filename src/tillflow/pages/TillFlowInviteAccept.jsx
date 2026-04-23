import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordRequest } from '../api/auth';
import { TillFlowApiError } from '../api/errors';
import BreezeTechLogo from '../components/BreezeTechLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function TillFlowInviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return token.length > 0 && email.length > 0 && password.length >= 8 && password === passwordConfirmation;
  }, [token, email, password, passwordConfirmation]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors(null);
    setSubmitting(true);
    try {
      await resetPasswordRequest({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      navigate('/login', {
        replace: true,
        state: { inviteAccepted: true },
      });
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

  const missingLink = !token || !email;

  return (
    <div className="tf-landing">
      <div className="tf-landing__top-actions">
        <ThemeToggle />
      </div>
      <div className="tf-landing__brand">
        <BreezeTechLogo className="tf-brand-logo tf-brand-logo--hero" />
        <p className="tf-landing__badge">TillFlow</p>
      </div>
      <h1 className="tf-landing__title">Set your password</h1>
      <p className="tf-landing__subtitle">Complete your account setup using the link from your email.</p>

      {missingLink ? (
        <div className="tf-alert tf-alert--error" style={{ maxWidth: 420, margin: '0 auto 1rem' }}>
          This page needs a valid <code>token</code> and <code>email</code> in the URL. Open the link from your
          invitation or password reset email.
        </div>
      ) : null}

      <form className="tf-form" onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
        {error ? <div className="tf-alert tf-alert--error">{error}</div> : null}

        <label className="tf-label">
          Email
          <input className="tf-input" type="email" value={email} readOnly autoComplete="email" />
        </label>

        <label className="tf-label">
          New password
          <input
            className="tf-input"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={8}
            disabled={missingLink}
          />
          {fieldErrors?.password ? (
            <span className="tf-field-error">{fieldErrors.password[0]}</span>
          ) : (
            <span className="tf-muted" style={{ fontSize: '0.8rem' }}>
              At least 8 characters.
            </span>
          )}
        </label>

        <label className="tf-label">
          Confirm password
          <input
            className="tf-input"
            type="password"
            name="password_confirmation"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(ev) => setPasswordConfirmation(ev.target.value)}
            required
            minLength={8}
            disabled={missingLink}
          />
        </label>

        <button type="submit" className="tf-btn tf-btn--primary tf-btn--block" disabled={!canSubmit || submitting}>
          {submitting ? 'Saving…' : 'Save password and continue'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.25rem' }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
