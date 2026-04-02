import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { TillFlowApiError } from '../api/errors';
import {
  createCategoryRequest,
  deleteCategoryRequest,
  listCategoriesRequest,
  listTrashedCategoriesRequest,
  restoreCategoryRequest,
  updateCategoryRequest,
} from '../api/categories';
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

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
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
  const [addSlug, setAddSlug] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash
        ? await listTrashedCategoriesRequest(token)
        : await listCategoriesRequest(token);
      setCategories(data.categories ?? []);
    } catch (e) {
      setCategories([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message);
      } else {
        setListError('Failed to load categories');
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
      return categories;
    }
    return categories.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.slug && String(c.slug).toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

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

  const allPageSelected = pageRows.length > 0 && pageRows.every((c) => selectedIds.has(c.id));

  function toggleSelectAllOnPage() {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((c) => next.delete(c.id));
    } else {
      pageRows.forEach((c) => next.add(c.id));
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

  function startEdit(c) {
    setRowError('');
    setEditError('');
    setEditingId(c.id);
    setEditName(c.name);
    setEditSlug(c.slug ?? '');
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
    setEditError('');
    setEditSubmitting(true);
    try {
      await updateCategoryRequest(token, editingId, {
        name: editName.trim(),
        slug: editSlug.trim() || null,
      });
      setShowEdit(false);
      setEditingId(null);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setEditError(err.message);
      } else {
        setEditError('Update failed');
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  function openDeleteModal(categoryId, label) {
    setDeleteTarget({ id: categoryId, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) {
      return;
    }
    const { id: categoryId } = deleteTarget;
    setDeleteSubmitting(true);
    setRowError('');
    setListError('');
    try {
      await deleteCategoryRequest(token, categoryId);
      if (editingId === categoryId) {
        setShowEdit(false);
        setEditingId(null);
      }
      selectedIds.delete(categoryId);
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

  async function handleRestore(categoryId) {
    if (!token) {
      return;
    }
    setRowError('');
    setListError('');
    setRestoreSubmittingId(categoryId);
    try {
      await restoreCategoryRequest(token, categoryId);
      if (editingId === categoryId) {
        setShowEdit(false);
        setEditingId(null);
      }
      selectedIds.delete(categoryId);
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

  function openAddModal() {
    setAddError('');
    setAddName('');
    setAddSlug('');
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!token) {
      return;
    }
    setAddError('');
    setAddSubmitting(true);
    try {
      await createCategoryRequest(token, {
        name: addName.trim(),
        slug: addSlug.trim() || null,
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setAddError(err.message);
      } else {
        setAddError('Could not create category');
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
            <h4>{viewTrash ? 'Trash' : 'Category List'}</h4>
            <h6>{viewTrash ? 'Restore deleted categories when needed' : 'Manage your categories'}</h6>
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
              <span className="btn btn-primary disabled" title="Switch to Active to add categories">
                <i className="feather icon-plus-circle me-1" />
                Add category
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <i className="feather icon-plus-circle me-1" />
                Add category
              </button>
            )}
          </div>
          <div className="page-btn import">
            <Link to="/tillflow/admin/add-product" className="btn btn-secondary color">
              <i className="feather icon-package me-2" />
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
                      aria-label="Search categories"
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
                Slug
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
                Sort By : Name
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
                  <th>Name</th>
                  <th>Slug</th>
                  <th>{viewTrash ? 'Deleted' : 'Created'}</th>
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
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <label className="checkboxs mb-0">
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleRow(c.id)} />
                          <span className="checkmarks" />
                        </label>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-md me-2">{initials(c.name)}</div>
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="tf-mono">{c.slug ?? '—'}</span>
                      </td>
                      <td>
                        <span className="userimgname text-muted small">
                          {formatListDate(viewTrash ? c.deleted_at : c.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="edit-delete-action d-flex align-items-center">
                          {viewTrash ? (
                            <button
                              type="button"
                              className="p-2 d-flex align-items-center border rounded bg-transparent"
                              disabled={restoreSubmittingId === c.id}
                              onClick={() => void handleRestore(c.id)}
                              title="Restore"
                            >
                              <i className="feather icon-rotate-ccw" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="me-2 p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => startEdit(c)}
                                title="Edit"
                              >
                                <i className="feather icon-edit" />
                              </button>
                              <button
                                type="button"
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => openDeleteModal(c.id, c.name)}
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

      <Modal show={showAdd} onHide={() => !addSubmitting && setShowAdd(false)} centered>
        <Modal.Header closeButton={!addSubmitting}>
          <Modal.Title>Add category</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addError ? <div className="alert alert-danger py-2">{addError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Name<span className="text-danger ms-1">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              maxLength={255}
              autoFocus
            />
          </div>
          <div className="mb-0">
            <label className="form-label">Slug</label>
            <input
              type="text"
              className="form-control"
              value={addSlug}
              onChange={(e) => setAddSlug(e.target.value)}
              maxLength={100}
              placeholder="optional, unique per store"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={addSubmitting}
            onClick={() => setShowAdd(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={addSubmitting || !addName.trim()}
            onClick={() => void submitAdd()}
          >
            {addSubmitting ? 'Saving…' : 'Create'}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEdit} onHide={closeEditModal} centered>
        <Modal.Header closeButton={!editSubmitting}>
          <Modal.Title>Edit category</Modal.Title>
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
            <label className="form-label">Slug</label>
            <input
              type="text"
              className="form-control"
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              maxLength={100}
              placeholder="optional, unique per store"
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
            disabled={editSubmitting || !editName.trim()}
            onClick={() => void submitEdit()}
          >
            {editSubmitting ? 'Saving…' : 'Save'}
          </button>
        </Modal.Footer>
      </Modal>

      <DeleteConfirmModal
        show={deleteTarget != null}
        onHide={() => {
          if (!deleteSubmitting) setDeleteTarget(null);
        }}
        title="Move to trash"
        message={
          deleteTarget
            ? `Move category "${deleteTarget.label}" to trash? Items keep their category_id until you edit them.`
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
