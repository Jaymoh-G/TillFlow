import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExpiredItemsRequest } from '../api/expiredItems';
import { TillFlowApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

function formatDateOnly(value) {
  if (!value) {
    return '—';
  }
  try {
    const d = typeof value === 'string' ? value.slice(0, 10) : value;
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminExpiredItems() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState('expired'); // expired | expiring
  const [expiringDays, setExpiringDays] = useState(30);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = await listExpiredItemsRequest(token, {
        scope: tab === 'expiring' ? 'expiring' : 'expired',
        days: expiringDays,
      });
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs reports.view)` : e.message);
      } else {
        setListError('Failed to load expired items report');
      }
    } finally {
      setLoading(false);
    }
  }, [token, tab, expiringDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((r) => {
      const sku = r.sku ?? '';
      const name = r.name ?? '';
      const cat = r.category?.name ?? '';
      const brand = r.brand?.name ?? '';
      return (
        String(name).toLowerCase().includes(q) ||
        String(sku).toLowerCase().includes(q) ||
        String(cat).toLowerCase().includes(q) ||
        String(brand).toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, tab, expiringDays]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rows) || 1);
  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rows;
  const pageRows = filtered.slice(startIdx, startIdx + rows);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + pageRows.length, filtered.length);

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>Expired items</h4>
            <h6>Track past-due and soon-to-expire stock</h6>
          </div>
        </div>
        <ul className="table-top-head">
          <li>
            <button type="button" title="Refresh" onClick={() => void load()}>
              <i className="feather icon-refresh-cw" />
            </button>
          </li>
        </ul>
        <div className="page-header-actions">
          <div className="page-btn import">
            <Link to="/tillflow/admin/items" className="btn btn-secondary color">
              <i className="feather icon-package me-2" />
              Items
            </Link>
          </div>
        </div>
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}

      <div className="card table-list-card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
          <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1">
            <div className="search-set">
              <div className="search-input">
                <span className="btn-searchset">
                  <i className="feather icon-search" />
                </span>
                <div className="dataTables_filter">
                  <label className="mb-0">
                    <input
                      type="search"
                      className="form-control form-control-sm"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search expired items"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted mb-0">Rows</label>
              <select
                className="form-select form-select-sm"
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Expiry tab">
              <button
                type="button"
                className={`btn ${tab === 'expired' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab('expired')}
              >
                Expired
              </button>
              <button
                type="button"
                className={`btn ${tab === 'expiring' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab('expiring')}
              >
                Expiring soon
              </button>
            </div>
            {tab === 'expiring' ? (
              <div className="d-flex align-items-center gap-2">
                <label htmlFor="tf-expiring-days" className="small text-muted mb-0">
                  Within (days)
                </label>
                <input
                  id="tf-expiring-days"
                  type="number"
                  min={1}
                  max={366}
                  className="form-control form-control-sm"
                  style={{ width: 72 }}
                  value={expiringDays}
                  onChange={(e) => setExpiringDays(Math.min(366, Math.max(1, Number(e.target.value) || 30)))}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table datatable table-nowrap">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Manufactured</th>
                  <th>Expires</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      No results.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-md me-2">{initials(r.name)}</div>
                          <span>{r.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="tf-mono">{r.sku ?? '—'}</span>
                      </td>
                      <td>{r.category?.name ?? '—'}</td>
                      <td>{r.brand?.name ?? '—'}</td>
                      <td>{formatDateOnly(r.manufactured_at)}</td>
                      <td>
                        <span className={tab === 'expired' ? 'text-danger' : 'text-warning'}>
                          {formatDateOnly(r.expires_at)}
                        </span>
                      </td>
                      <td>{Number.isFinite(r.qty) ? r.qty : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 ? (
            <div className="pagination-block px-3 pb-3">
              <div>
                Showing {showingFrom} to {showingTo} of {filtered.length} entries
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((x) => Math.max(1, x - 1))}
                >
                  Previous
                </button>
                <span className="text-muted small">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((x) => Math.min(totalPages, x + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
