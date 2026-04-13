import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PrimeDataTable from '../../components/data-table';
import TableTopHead from '../../components/table-top-head';
import { listExpiredItemsRequest } from '../api/expiredItems';
import { TillFlowApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { downloadRowsExcel, downloadRowsPdf } from '../utils/listExport';

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

  const columns = useMemo(
    () => [
      {
        header: 'Item',
        field: 'name',
        body: (r) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-md me-2">{initials(r.name)}</div>
            <span>{r.name}</span>
          </div>
        )
      },
      { header: 'SKU', field: 'sku', body: (r) => <span className="tf-mono">{r.sku ?? '—'}</span> },
      { header: 'Category', field: 'category.name', body: (r) => r.category?.name ?? '—' },
      { header: 'Brand', field: 'brand.name', body: (r) => r.brand?.name ?? '—' },
      { header: 'Manufactured', field: 'manufactured_at', body: (r) => formatDateOnly(r.manufactured_at) },
      {
        header: 'Expires',
        field: 'expires_at',
        body: (r) => <span className={tab === 'expired' ? 'text-danger' : 'text-warning'}>{formatDateOnly(r.expires_at)}</span>
      },
      { header: 'Qty', field: 'qty', className: 'text-end', headerClassName: 'text-end', body: (r) => <span className="text-end d-block">{Number.isFinite(r.qty) ? r.qty : '—'}</span> }
    ],
    [tab]
  );

  const handleExportExcel = useCallback(async () => {
    const records = filtered.map((r) => ({
      Item: String(r.name ?? ''),
      SKU: String(r.sku ?? ''),
      Category: String(r.category?.name ?? ''),
      Brand: String(r.brand?.name ?? ''),
      Manufactured: formatDateOnly(r.manufactured_at),
      Expires: formatDateOnly(r.expires_at),
      Qty: Number.isFinite(r.qty) ? r.qty : ''
    }));
    await downloadRowsExcel(records, 'Expired items', tab === 'expired' ? 'expired-items' : 'expiring-items');
  }, [filtered, tab]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((r) => [
      String(r.name ?? ''),
      String(r.sku ?? ''),
      String(r.category?.name ?? ''),
      String(r.brand?.name ?? ''),
      formatDateOnly(r.manufactured_at),
      formatDateOnly(r.expires_at),
      Number.isFinite(r.qty) ? String(r.qty) : ''
    ]);
    await downloadRowsPdf(
      tab === 'expired' ? 'Expired items' : 'Expiring items',
      ['Item', 'SKU', 'Category', 'Brand', 'Manufactured', 'Expires', 'Qty'],
      body,
      tab === 'expired' ? 'expired-items' : 'expiring-items'
    );
  }, [filtered, tab]);

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>Expired items</h4>
            <h6>Track past-due and soon-to-expire stock</h6>
          </div>
        </div>
        <TableTopHead
          onRefresh={() => void load()}
          onExportPdf={loading || filtered.length === 0 ? undefined : () => void handleExportPdf()}
          onExportExcel={loading || filtered.length === 0 ? undefined : () => void handleExportExcel()}
        />
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
          <div className="custom-datatable-filter table-responsive">
            <PrimeDataTable
              column={columns}
              data={filtered}
              rows={rows}
              setRows={setRows}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={filtered.length}
              loading={loading}
              isPaginationEnabled
            />
          </div>
        </div>
      </div>
    </div>
  );
}
