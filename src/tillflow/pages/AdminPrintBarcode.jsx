import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import BarcodeSvg from '../components/BarcodeSvg';
import { listProductsRequest } from '../api/products';
import { TillFlowApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';

function productBarcodeCode(p) {
  if (p?.sku && String(p.sku).trim() !== '') {
    return String(p.sku).trim();
  }
  return `TF-${p.id}`;
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminPrintBarcode() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [queue, setQueue] = useState(() => []);

  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = await listProductsRequest(token);
      setProducts(data.products ?? []);
    } catch (e) {
      setProducts([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog items permission)` : e.message);
      } else {
        setListError('Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const searchMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q || products.length === 0) return [];
    return products
      .filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) || (p.sku && String(p.sku).toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [products, productSearch]);

  const flatPrintLabels = useMemo(() => {
    const out = [];
    queue.forEach((row) => {
      const n = Math.max(1, Math.min(999, row.qty));
      for (let i = 0; i < n; i += 1) {
        out.push(row);
      }
    });
    return out;
  }, [queue]);

  function addToQueue(p) {
    const code = productBarcodeCode(p);
    setQueue((prev) => {
      const idx = prev.findIndex((r) => r.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          id: p.id,
          name: p.name ?? '—',
          sku: p.sku ?? '—',
          code,
          qty: 1,
        },
      ];
    });
    setProductSearch('');
  }

  function setRowQty(id, qty) {
    const n = Math.max(1, Math.min(999, Number(qty) || 1));
    setQueue((prev) => prev.map((r) => (r.id === id ? { ...r, qty: n } : r)));
  }

  function bumpQty(id, delta) {
    setQueue((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, qty: Math.max(1, Math.min(999, r.qty + delta)) };
      })
    );
  }

  function removeRow(id) {
    setQueue((prev) => prev.filter((r) => r.id !== id));
  }

  function resetQueue() {
    setQueue([]);
  }

  function handleDoPrint() {
    setShowPreview(false);
    window.setTimeout(() => {
      window.print();
    }, 200);
  }

  return (
    <>
      <div className="tf-print-barcode-ui tf-item-list-page">
        <div className="page-header">
          <div className="add-item d-flex">
            <div className="page-title">
              <h4>Print Barcode</h4>
              <h6>Select items and print labels (CODE128)</h6>
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
            <div className="page-btn">
              <Link to="/admin/items" className="btn btn-secondary">
                Items
              </Link>
            </div>
          </div>
        </div>

        {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}

        <div className="card table-list-card table-list-card--overflow-visible mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-lg-6">
                <label className="form-label">Add product</label>
                <div className="position-relative" style={{ zIndex: 10 }}>
                  <input
                    type="search"
                    className="form-control"
                    placeholder="Search by name or SKU…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                  />
                  {productSearch.trim() ? (
                    searchMatches.length > 0 ? (
                      <ul
                        className="list-group position-absolute w-100 shadow mt-1 tf-print-barcode-suggest"
                        style={{ zIndex: 1060, maxHeight: 280, overflowY: 'auto' }}
                        role="listbox"
                      >
                        {searchMatches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="list-group-item list-group-item-action text-start border-0 border-bottom rounded-0"
                            onClick={() => addToQueue(p)}
                            role="option"
                          >
                            <span className="fw-medium">{p.name}</span>
                            <span className="text-muted small ms-2 tf-mono">{p.sku ?? '—'}</span>
                          </button>
                        ))}
                      </ul>
                    ) : !loading && products.length > 0 ? (
                      <div
                        className="position-absolute w-100 mt-1 p-3 rounded border tf-print-barcode-suggest shadow-sm small text-muted"
                        style={{ zIndex: 1060, background: 'var(--tf-surface-2)' }}
                      >
                        No products match &ldquo;{productSearch.trim()}&rdquo;
                      </div>
                    ) : null
                  ) : null}
                </div>
                {loading ? (
                  <div className="text-muted small mt-2">Loading products…</div>
                ) : !listError && products.length > 0 ? (
                  <div className="text-muted small mt-2">{products.length} product(s) — type to filter</div>
                ) : !listError && products.length === 0 ? (
                  <div className="text-muted small mt-2">No products in catalog</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="card table-list-card">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span className="fw-medium">Print queue</span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetQueue} disabled={queue.length === 0}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={queue.length === 0}
                onClick={() => setShowPreview(true)}
              >
                Preview &amp; print
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table datatable table-nowrap mb-0">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Code</th>
                    <th>Qty</th>
                    <th className="no-sort" />
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-muted">
                        Add products from search above.
                      </td>
                    </tr>
                  ) : (
                    queue.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="avatar avatar-md me-2">{initials(row.name)}</div>
                            <span>{row.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tf-mono">{row.sku}</span>
                        </td>
                        <td>
                          <span className="tf-mono">{row.code}</span>
                          <div className="mt-1">
                            <BarcodeSvg value={row.code} height={36} width={1.2} />
                          </div>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <div className="d-flex align-items-center gap-1">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => bumpQty(row.id, -1)}
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              className="form-control form-control-sm text-center"
                              style={{ width: 56 }}
                              value={row.qty}
                              onChange={(e) => setRowQty(row.id, e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => bumpQty(row.id, 1)}
                              aria-label="Increase"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={() => removeRow(row.id)}
                            title="Remove"
                          >
                            <i className="feather icon-trash-2" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen but in-layout: JsBarcode can measure SVG. Shown fully when printing via CSS. */}
      <div className="tf-barcode-print-sheet" aria-hidden="true">
        <div className="tf-barcode-print-sheet__title">TillFlow — barcodes</div>
        <div className="tf-barcode-print-sheet__grid">
          {flatPrintLabels.map((row, idx) => (
            <div key={`${row.id}-${idx}`} className="tf-barcode-print-label">
              <div className="tf-barcode-print-label__name">{row.name}</div>
              <BarcodeSvg value={row.code} height={44} width={1.35} />
              <div className="tf-barcode-print-label__code tf-mono">{row.code}</div>
            </div>
          ))}
        </div>
      </div>

      <Modal show={showPreview} onHide={() => setShowPreview(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Print preview</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {flatPrintLabels.length === 0 ? (
            <p className="text-muted mb-0">Nothing to print.</p>
          ) : (
            <div className="d-flex flex-wrap gap-3">
              {flatPrintLabels.slice(0, 24).map((row, idx) => (
                <div key={`pv-${row.id}-${idx}`} className="border rounded p-2 text-center" style={{ width: 200 }}>
                  <div className="small fw-medium text-truncate" title={row.name}>
                    {row.name}
                  </div>
                  <BarcodeSvg value={row.code} height={40} width={1.2} />
                  <div className="tf-mono small">{row.code}</div>
                </div>
              ))}
              {flatPrintLabels.length > 24 ? (
                <p className="text-muted small w-100 mb-0">
                  … and {flatPrintLabels.length - 24} more label(s) included in print.
                </p>
              ) : null}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary ms-2" onClick={() => void handleDoPrint()} disabled={flatPrintLabels.length === 0}>
            Print
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
