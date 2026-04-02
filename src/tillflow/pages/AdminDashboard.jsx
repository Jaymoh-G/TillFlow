import { useEffect, useState } from 'react';
import { fetchHealth, fetchReady } from '../api/client';
import { TillFlowApiError } from '../api/errors';
import { TILLFLOW_API_BASE_URL } from '../config';

export default function AdminDashboard() {
  const [health, setHealth] = useState(null);
  const [ready, setReady] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError('');
      try {
        const h = await fetchHealth();
        if (!cancelled) {
          setHealth(h);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof TillFlowApiError ? e.message : 'Health check failed');
        }
      }

      try {
        const r = await fetchReady();
        if (!cancelled) {
          setReady(r);
        }
      } catch (e) {
        if (!cancelled) {
          setReady(
            e instanceof TillFlowApiError
              ? { status: 'error', detail: e.message, database: e.data?.database }
              : { status: 'error', detail: 'Ready check failed' }
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h2 className="tf-page-title">Dashboard</h2>
      <p className="tf-page-lead">API connectivity and readiness (no auth required for these endpoints).</p>

      {error ? <div className="tf-alert tf-alert--error">{error}</div> : null}

      <div className="tf-panel tf-panel--muted" style={{ marginBottom: '1rem' }}>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          API base (<span className="tf-mono">VITE_TILLFLOW_API_URL</span>):
        </p>
        <p className="tf-mono" style={{ margin: 0, color: 'var(--tf-text)', wordBreak: 'break-all' }}>
          {TILLFLOW_API_BASE_URL}
        </p>
      </div>

      <div className="tf-panel" style={{ marginBottom: '1rem' }}>
        <h3 className="tf-panel-title">GET /health</h3>
        {health ? (
          <pre className="tf-pre">{JSON.stringify(health, null, 2)}</pre>
        ) : (
          <p className="tf-muted">Loading…</p>
        )}
      </div>

      <div className="tf-panel">
        <h3 className="tf-panel-title">GET /ready</h3>
        {ready ? (
          <pre className="tf-pre">{JSON.stringify(ready, null, 2)}</pre>
        ) : (
          <p className="tf-muted">Loading…</p>
        )}
      </div>
    </>
  );
}
