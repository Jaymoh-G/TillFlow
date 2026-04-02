import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TillFlowApiError } from '../api/errors';
import { deleteProductRequest, listProductsRequest, listTrashedProductsRequest, restoreProductRequest } from '../api/products';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

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

function formatListDate(iso) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function formatPrice(val) {
  if (val == null || val === '') {
    return '—';
  }
  const n = Number(val);
  if (Number.isNaN(n)) {
    return '—';
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash
        ? await listTrashedProductsRequest(token)
        : await listProductsRequest(token);
      setProducts(data.products ?? []);
    } catch (e) {
      setProducts([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message);
      } else {
        setListError('Failed to load items');
      }
    } finally {
      setLoading(false);
    }
  }, [token, viewTrash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [viewTrash]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return products;
    }
    return products.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) || (p.sku && String(p.sku).toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rows) || 1);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rows;
  const pageRows = filtered.slice(startIdx, startIdx + rows);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + pageRows.length, filtered.length);

  const allPageSelected = pageRows.length > 0 && pageRows.every((p) => selectedIds.has(p.id));

  function toggleSelectAllOnPage() {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((p) => next.delete(p.id));
    } else {
      pageRows.forEach((p) => next.add(p.id));
    }
    setSelectedIds(next);
  }

  function toggleRow(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function openDeleteModal(productId, label) {
    setDeleteTarget({ id: productId, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) {
      return;
    }
    const { id: productId } = deleteTarget;
    setDeleteSubmitting(true);
    setListError('');
    try {
      await deleteProductRequest(token, productId);
      selectedIds.delete(productId);
      setSelectedIds(new Set(selectedIds));
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError('Delete failed');
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleRestore(productId) {
    if (!token) {
      return;
    }
    setListError('');
    setRestoreSubmittingId(productId);
    try {
      await restoreProductRequest(token, productId);
      selectedIds.delete(productId);
      setSelectedIds(new Set(selectedIds));
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError('Restore failed');
      }
    } finally {
      setRestoreSubmittingId(null);
    }
  }

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? 'Trash' : 'Item List'}</h4>
            <h6>{viewTrash ? 'Restore deleted items when needed' : 'Manage your items'}</h6>
          </div>
        </div>
        <ul className="table-top-head">
          <li>
            <button type="button" title="Export PDF (placeholder)" disabled>
              <i className="feather icon-file-text" />
            </button>
          </li>
          <li>
            <button type="button" title="Export Excel (placeholder)" disabled>
              <i className="feather icon-download" />
            </button>
          </li>
          <li>
            <button type="button" title="Refresh" onClick={() => void load()}>
              <i className="feather icon-refresh-cw" />
            </button>
          </li>
        </ul>
        <div className="page-header-actions">
          <div className="page-btn">
            {viewTrash ? (
              <span className="btn btn-primary disabled" title="Switch to Active to add items">
                <i className="feather icon-plus-circle me-1" />
                Add New Item
              </span>
            ) : (
              <Link to="/tillflow/admin/add-product" className="btn btn-primary">
                <i className="feather icon-plus-circle me-1" />
                Add New Item
              </Link>
            )}
          </div>
          <div className="page-btn import">
            <button type="button" className="btn btn-secondary color" disabled title="Coming soon">
              <i className="feather icon-download me-2" />
              Import Item
            </button>
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
                      aria-label="Search items"
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
            <div className="btn-group btn-group-sm" role="group" aria-label="Active or trash">
              <button
                type="button"
                className={`btn ${!viewTrash ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewTrash(false)}
              >
                Active
              </button>
              <button
                type="button"
                className={`btn ${viewTrash ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewTrash(true)}
              >
                Trash
              </button>
            </div>
          </div>
          <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Item
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
              >
                Created By
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
              >
                Category
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
              >
                Brand
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
              >
                Sort By : Last 7 Days
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Recently Added</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Ascending</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Descending</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Last Month</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Last 7 Days</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table datatable table-nowrap">
              <thead>
                <tr>
                  <th className="no-sort">
                    <label className="checkboxs mb-0">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} />
                      <span className="checkmarks" />
                    </label>
                  </th>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Selling</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>{viewTrash ? 'Deleted' : 'Created By'}</th>
                  <th className="no-sort" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <label className="checkboxs mb-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleRow(p.id)}
                          />
                          <span className="checkmarks" />
                        </label>
                      </td>
                      <td>
                        <span className="tf-mono">{p.sku ?? '—'}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-md me-2">{initials(p.name)}</div>
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td>{p.category?.name ?? '—'}</td>
                      <td>{p.brand?.name ?? '—'}</td>
                      <td>{formatPrice(p.selling_price)}</td>
                      <td>{p.unit?.short_name ?? p.unit?.name ?? '—'}</td>
                      <td>{p.qty != null ? p.qty : '—'}</td>
                      <td>
                        <span className="userimgname text-muted small">
                          {formatListDate(viewTrash ? p.deleted_at : p.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="edit-delete-action d-flex align-items-center">
                          {viewTrash ? (
                            <button
                              type="button"
                              className="p-2 d-flex align-items-center border rounded bg-transparent"
                              disabled={restoreSubmittingId === p.id}
                              onClick={() => void handleRestore(p.id)}
                              title="Restore"
                            >
                              <i className="feather icon-rotate-ccw" />
                            </button>
                          ) : (
                            <>
                              <Link
                                to={`/tillflow/admin/items/${p.id}/edit`}
                                className="me-2 p-2 d-flex align-items-center border rounded bg-transparent text-reset"
                                title="Edit"
                              >
                                <i className="feather icon-edit" />
                              </Link>
                              <button
                                type="button"
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => openDeleteModal(p.id, p.name)}
                                title="Move to trash"
                              >
                                <i className="feather icon-trash-2" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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

      <DeleteConfirmModal
        show={deleteTarget != null}
        onHide={() => {
          if (!deleteSubmitting) setDeleteTarget(null);
        }}
        title="Move to trash"
        message={
          deleteTarget
            ? `Move "${deleteTarget.label}" to trash? You can restore it later from the Trash tab.`
            : ''
        }
        confirmLabel="Move to trash"
        submittingLabel="Moving…"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />
    </div>
  );
}
