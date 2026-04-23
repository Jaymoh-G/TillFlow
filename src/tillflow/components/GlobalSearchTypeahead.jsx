import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearchRequest } from '../api/search';
import { useAuth } from '../auth/AuthContext';

const DEBOUNCE_MS = 350;

/**
 * Header global search: debounced API, grouped dropdown, keyboard navigation.
 *
 * @param {object} [props]
 * @param {string} [props.className]
 */
export default function GlobalSearchTypeahead({ className = '' }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const abortRef = useRef(null);
  const seqRef = useRef(0);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  /** @type {import('react').Dispatch<import('react').SetStateAction<Array<{ type: string, label: string, total: number, items: Array<{ type: string, id: number, title: string, subtitle?: string|null, href: string }> }>>>} */
  const [groups, setGroups] = useState([]);

  const rows = useMemo(() => {
    /** @type {Array<{ type: string, id: number, title: string, subtitle?: string|null, href: string, groupLabel: string, groupType: string, groupTotal: number, isGroupStart: boolean }>} */
    const out = [];
    for (const g of groups) {
      let first = true;
      for (const it of g.items || []) {
        out.push({
          ...it,
          groupLabel: g.label,
          groupType: g.type,
          groupTotal: g.total,
          isGroupStart: first
        });
        first = false;
      }
    }
    return out;
  }, [groups]);

  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    setActiveIdx(rows.length > 0 ? 0 : -1);
  }, [rows]);

  const runSearch = useCallback(
    async (query) => {
      const trimmed = query.trim();
      if (!token || trimmed.length < 2) {
        setGroups([]);
        setLoading(false);
        setError(null);
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const mySeq = ++seqRef.current;

      setLoading(true);
      setError(null);

      try {
        const data = await globalSearchRequest(token, {
          q: trimmed,
          limit: 6,
          signal: ac.signal
        });
        if (mySeq !== seqRef.current) return;
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
      } catch (e) {
        if (e?.name === 'AbortError' || e?.message === 'The user aborted a request.') {
          return;
        }
        if (mySeq !== seqRef.current) return;
        setGroups([]);
        setError(e?.message || 'Search failed.');
      } finally {
        if (mySeq === seqRef.current) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    if (!open || !token) return undefined;
    const t = setTimeout(() => {
      void runSearch(q);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, open, token, runSearch]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIdx(-1);
  }, []);

  const go = useCallback(
    (href) => {
      if (href) navigate(href);
      close();
      setQ('');
      setGroups([]);
    },
    [navigate, close]
  );

  useEffect(() => {
    function onDocMouseDown(ev) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target)) {
        close();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [close]);

  const onKeyDown = (ev) => {
    if (!open && (ev.key === 'ArrowDown' || ev.key === 'Enter') && q.trim().length >= 2) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
      return;
    }
    if (rows.length === 0) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActiveIdx((i) => (i + 1) % rows.length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActiveIdx((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const it = rows[activeIdx >= 0 ? activeIdx : 0];
      if (it?.href) go(it.href);
    }
  };

  return (
    <div ref={rootRef} className={`tf-global-search position-relative ${className}`.trim()}>
      <label className="visually-hidden" htmlFor="tf-global-search-input">
        Search customers, products, invoices, and more
      </label>
      <div className="tf-global-search__shell">
        <span className="tf-global-search__icon" aria-hidden>
          <i className="ti ti-search" />
        </span>
        <input
          id="tf-global-search-input"
          type="search"
          autoComplete="off"
          placeholder="Search…"
          className="tf-global-search__field"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading ? (
          <span className="tf-global-search__suffix" aria-hidden>
            <span className="spinner-border spinner-border-sm tf-global-search__spinner" role="status" />
          </span>
        ) : null}
      </div>

      {open && (q.trim().length >= 2 || error) ? (
        <div
          className="tf-global-search__panel shadow mt-2 py-0 w-100"
          role="listbox"
          style={{ maxHeight: '70vh', overflowY: 'auto', minWidth: 'min(100%, 22rem)' }}>
          {error ? (
            <div className="px-3 py-2 text-danger small">{error}</div>
          ) : null}
          {!loading && !error && rows.length === 0 && q.trim().length >= 2 ? (
            <div className="px-3 py-2 text-muted small">No matches.</div>
          ) : null}
          <ul className="list-unstyled mb-0">
            {rows.map((it, idx) => (
              <li key={`${it.groupType}-${it.type}-${it.id}`}>
                {it.isGroupStart ? (
                  <div className="tf-global-search__group-label px-3 py-2 small text-uppercase text-muted border-bottom bg-body-secondary bg-opacity-50">
                    {it.groupLabel}
                    <span className="ms-1">({it.groupTotal})</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={`tf-global-search__item dropdown-item text-start w-100 border-0 rounded-0 py-2 px-3 ${
                    idx === activeIdx ? 'active' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => go(it.href)}>
                  <div className="fw-medium text-truncate">{it.title}</div>
                  {it.subtitle ? (
                    <div className="small text-muted text-truncate">{it.subtitle}</div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
