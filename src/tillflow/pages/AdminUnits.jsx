import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { TillFlowApiError } from '../api/errors';
import { createUnitRequest, deleteUnitRequest, listTrashedUnitsRequest, listUnitsRequest, restoreUnitRequest, updateUnitRequest } from '../api/units';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

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

export default function AdminUnits() {
  const { token } = useAuth();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editShortName, setEditShortName] = useState('');
  const [rowError, setRowError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addShortName, setAddShortName] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash ? await listTrashedUnitsRequest(token) : await listUnitsRequest(token);
      setUnits(data.units ?? []);
    } catch (e) {
      setUnits([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message);
      } else {
        setListError('Failed to load units');
      }
    } finally {
      setLoading(false);
    }
  }, [token, viewTrash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditingId(null);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [viewTrash]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return units;
    }
    return units.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.short_name && String(u.short_name).toLowerCase().includes(q))
    );
  }, [units, searchQuery]);

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

  const allPageSelected = useMemo(() => pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id)), [pageRows, selectedIds]);

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRows.forEach((r) => next.delete(r.id));
      } else {
        pageRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function startEdit(u) {
    setRowError('');
    setEditError('');
    setEditingId(u.id);
    setEditName(u.name ?? '');
    setEditShortName(u.short_name ?? '');
    setShowEdit(true);
  }

  function closeEditModal() {
    if (editSubmitting) {
      return;
    }
    setShowEdit(false);
    setEditingId(null);
    setEditError('');
  }

  async function submitEdit() {
    if (!token || !editingId) {
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      await updateUnitRequest(token, editingId, { name: editName.trim(), short_name: editShortName.trim() });
      setShowEdit(false);
      setEditingId(null);
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setEditError(e.message);
      } else {
        setEditError('Failed to save unit');
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) {
      return;
    }
    setDeleteSubmitting(true);
    try {
      await deleteUnitRequest(token, deleteTarget.id);
      if (editingId === deleteTarget.id) {
        setShowEdit(false);
        setEditingId(null);
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      // reuse modal body for any errors
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function restore(id) {
    if (!token) {
      return;
    }
    setRestoreSubmittingId(id);
    try {
      await restoreUnitRequest(token, id);
      if (editingId === id) {
        setShowEdit(false);
        setEditingId(null);
      }
      await load();
    } finally {
      setRestoreSubmittingId(null);
    }
  }

  async function submitAdd(e) {
    e.preventDefault();
    if (!token) {
      return;
    }
    setAddSubmitting(true);
    setAddError('');
    try {
      await createUnitRequest(token, { name: addName.trim(), short_name: addShortName.trim() });
      setShowAdd(false);
      setAddName('');
      setAddShortName('');
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setAddError(err.message);
      } else {
        setAddError('Failed to create unit');
      }
    } finally {
      setAddSubmitting(false);
    }
  }

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? 'Trash' : 'Units'}</h4>
            <h6>{viewTrash ? 'Restore deleted units' : 'Manage product units'}</h6>
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
            {viewTrash ? (
              <span className="btn btn-primary disabled" title="Switch to Active to add">
                <i className="feather icon-plus-circle me-1" />
                Add unit
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <i className="feather icon-plus-circle me-1" />
                Add unit
              </button>
            )}
          </div>
          <div className="page-btn">
            <Link to="/tillflow/admin/add-product" className="btn btn-secondary">
              Add item
            </Link>
          </div>
        </div>
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}
      {rowError ? <div className="tf-alert tf-alert--error mb-3">{rowError}</div> : null}

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
                      aria-label="Search units"
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
                  <th>Name</th>
                  <th>Short</th>
                  <th>{viewTrash ? 'Deleted' : 'Updated'}</th>
                  <th className="no-sort" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">
                      No units found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <label className="checkboxs mb-0">
                          <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleRow(u.id)} />
                          <span className="checkmarks" />
                        </label>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-md me-2">{initials(u.name)}</div>
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark">{u.short_name ?? '—'}</span>
                      </td>
                      <td>
                        <span className="userimgname text-muted small">{formatListDate(viewTrash ? u.deleted_at : u.updated_at)}</span>
                      </td>
                      <td>
                        <div className="edit-delete-action d-flex align-items-center">
                          {viewTrash ? (
                            <button
                              type="button"
                              className="p-2 d-flex align-items-center border rounded bg-transparent"
                              disabled={restoreSubmittingId === u.id}
                              onClick={() => void restore(u.id)}
                              title="Restore"
                            >
                              <i className="feather icon-rotate-ccw" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => startEdit(u)}
                                title="Edit"
                              >
                                <i className="feather icon-edit" />
                              </button>
                              <button
                                type="button"
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => setDeleteTarget(u)}
                                title="Delete"
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
                  className="btn btn-outline-secondary btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="text-muted small">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
        message={deleteTarget ? `Move unit "${deleteTarget.name}" to trash? Linked items keep unit_id until edited.` : ''}
        confirmLabel="Move to trash"
        submittingLabel="Moving…"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />

      <Modal show={showEdit} onHide={closeEditModal} centered>
        <Modal.Header closeButton={!editSubmitting}>
          <Modal.Title>Edit unit</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Name<span className="text-danger ms-1">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={255}
              autoFocus
              disabled={editSubmitting}
            />
          </div>
          <div className="mb-0">
            <label className="form-label">
              Short name<span className="text-danger ms-1">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={editShortName}
              onChange={(e) => setEditShortName(e.target.value)}
              maxLength={20}
              disabled={editSubmitting}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" disabled={editSubmitting} onClick={closeEditModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary ms-2"
            disabled={editSubmitting || !editName.trim() || !editShortName.trim()}
            onClick={() => void submitEdit()}
          >
            {editSubmitting ? 'Saving…' : 'Save'}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Unit</Modal.Title>
        </Modal.Header>
        <form onSubmit={(e) => void submitAdd(e)}>
          <Modal.Body>
            {addError ? <div className="alert alert-danger">{addError}</div> : null}
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input className="form-control" value={addName} onChange={(e) => setAddName(e.target.value)} maxLength={255} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Short name</label>
              <input className="form-control" value={addShortName} onChange={(e) => setAddShortName(e.target.value)} maxLength={20} required />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdd(false)} disabled={addSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting ? 'Saving…' : 'Save'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}

