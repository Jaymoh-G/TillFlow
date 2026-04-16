import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import PrimeDataTable from '../../components/data-table';
import TableTopHead from '../../components/table-top-head';
import { TillFlowApiError } from '../api/errors';
import {
  createVariantAttributeRequest,
  deleteVariantAttributeRequest,
  listTrashedVariantAttributesRequest,
  listVariantAttributesRequest,
  restoreVariantAttributeRequest,
  updateVariantAttributeRequest,
} from '../api/variantAttributes';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { downloadRowsExcel, downloadRowsPdf } from '../utils/listExport';

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

function normalizeValuesInput(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AdminVariantAttributes() {
  const { token } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [rowError, setRowError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addValues, setAddValues] = useState('');
  const [addActive, setAddActive] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editValues, setEditValues] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash
        ? await listTrashedVariantAttributesRequest(token)
        : await listVariantAttributesRequest(token);
      setAttributes(data.attributes ?? []);
    } catch (e) {
      setAttributes([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog masters permission)` : e.message);
      } else {
        setListError('Failed to load variant attributes');
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
    setEditingId(null);
    setShowEdit(false);
  }, [viewTrash]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return attributes;
    return attributes.filter((a) => {
      const valuesJoined = Array.isArray(a.values) ? a.values.join(', ') : String(a.values ?? '');
      return (
        String(a.name ?? '').toLowerCase().includes(q) || String(valuesJoined).toLowerCase().includes(q)
      );
    });
  }, [attributes, searchQuery]);

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

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));

  function toggleSelectAllOnPage() {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((r) => next.delete(r.id));
    } else {
      pageRows.forEach((r) => next.add(r.id));
    }
    setSelectedIds(next);
  }

  function toggleRow(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function openAddModal() {
    setAddError('');
    setAddName('');
    setAddValues('');
    setAddActive(true);
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!token) return;
    setAddError('');
    setAddSubmitting(true);
    try {
      await createVariantAttributeRequest(token, {
        name: addName.trim(),
        values: normalizeValuesInput(addValues),
        is_active: addActive,
      });
      setShowAdd(false);
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) setAddError(e.message);
      else setAddError('Could not create variant attribute');
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEdit(a) {
    setEditError('');
    setEditingId(a.id);
    setEditName(a.name ?? '');
    setEditValues(Array.isArray(a.values) ? a.values.join(', ') : String(a.values ?? ''));
    setEditActive(Boolean(a.is_active));
    setShowEdit(true);
  }

  function closeEditModal() {
    if (editSubmitting) return;
    setShowEdit(false);
    setEditingId(null);
    setEditError('');
  }

  async function submitEdit() {
    if (!token || !editingId) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      await updateVariantAttributeRequest(token, editingId, {
        name: editName.trim(),
        values: normalizeValuesInput(editValues),
        is_active: editActive,
      });
      setShowEdit(false);
      setEditingId(null);
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) setEditError(e.message);
      else setEditError('Update failed');
    } finally {
      setEditSubmitting(false);
    }
  }

  function openDeleteModal(id, label) {
    setDeleteTarget({ id, label });
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setDeleteSubmitting(true);
    setRowError('');
    try {
      await deleteVariantAttributeRequest(token, deleteTarget.id);
      selectedIds.delete(deleteTarget.id);
      setSelectedIds(new Set(selectedIds));
      if (editingId === deleteTarget.id) {
        setShowEdit(false);
        setEditingId(null);
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) setRowError(e.message);
      else setRowError('Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleRestore(id) {
    if (!token) return;
    setRestoreSubmittingId(id);
    setRowError('');
    try {
      await restoreVariantAttributeRequest(token, id);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      if (editingId === id) {
        setShowEdit(false);
        setEditingId(null);
      }
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) setRowError(e.message);
      else setRowError('Restore failed');
    } finally {
      setRestoreSubmittingId(null);
    }
  }

  const handleExportExcel = useCallback(async () => {
    const records = filtered.map((a) => ({
      Variant: String(a.name ?? ''),
      Values: Array.isArray(a.values) ? a.values.join(', ') : String(a.values ?? ''),
      Created: formatListDate(a.created_at),
      Status: a.is_active ? 'Active' : 'Inactive'
    }));
    await downloadRowsExcel(records, 'Variant attributes', viewTrash ? 'variant-attributes-trash' : 'variant-attributes');
  }, [filtered, viewTrash]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((a) => [
      String(a.name ?? ''),
      Array.isArray(a.values) ? a.values.join(', ') : String(a.values ?? ''),
      formatListDate(a.created_at),
      a.is_active ? 'Active' : 'Inactive'
    ]);
    await downloadRowsPdf(
      viewTrash ? 'Variant attributes (trash)' : 'Variant attributes',
      ['Variant', 'Values', 'Created', 'Status'],
      body,
      viewTrash ? 'variant-attributes-trash' : 'variant-attributes'
    );
  }, [filtered, viewTrash]);

  const columns = useMemo(
    () => [
      {
        header: (
          <label className="checkboxs mb-0">
            <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} />
            <span className="checkmarks" />
          </label>
        ),
        field: 'select',
        sortable: false,
        body: (a) => (
          <label className="checkboxs mb-0">
            <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleRow(a.id)} />
            <span className="checkmarks" />
          </label>
        )
      },
      {
        header: 'Variant',
        field: 'name',
        body: (a) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-md me-2">{initials(a.name)}</div>
            <span>{a.name}</span>
          </div>
        )
      },
      { header: 'Values', field: 'values', body: (a) => (Array.isArray(a.values) ? a.values.join(', ') : String(a.values ?? '')) },
      { header: 'Created', field: 'created_at', body: (a) => <span className="userimgname text-muted small">{formatListDate(a.created_at)}</span> },
      {
        header: 'Status',
        field: 'is_active',
        body: (a) => (
          <span className={`badge ${a.is_active ? 'bg-success' : 'bg-secondary'} fw-medium fs-10`}>
            {a.is_active ? 'Active' : 'Inactive'}
          </span>
        )
      },
      {
        header: 'Actions',
        field: 'actions',
        sortable: false,
        className: 'text-end',
        headerClassName: 'text-end',
        body: (a) => (
          <div className="edit-delete-action d-flex align-items-center justify-content-end">
            {viewTrash ? (
              <button
                type="button"
                className="p-2 d-flex align-items-center border rounded bg-transparent"
                disabled={restoreSubmittingId === a.id}
                onClick={() => void handleRestore(a.id)}
                title="Restore"
              >
                <i className="feather icon-rotate-ccw" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="me-2 p-2 d-flex align-items-center border rounded bg-transparent"
                  onClick={() => startEdit(a)}
                  title="Edit"
                >
                  <i className="feather icon-edit" />
                </button>
                <button
                  type="button"
                  className="p-2 d-flex align-items-center border rounded bg-transparent"
                  onClick={() => openDeleteModal(a.id, a.name)}
                  title="Move to trash"
                >
                  <i className="feather icon-trash-2" />
                </button>
              </>
            )}
          </div>
        )
      }
    ],
    [allPageSelected, selectedIds, viewTrash, restoreSubmittingId]
  );

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? 'Trash' : 'Variant Attributes'}</h4>
            <h6>{viewTrash ? 'Restore deleted attributes' : 'Manage your variant attributes'}</h6>
          </div>
        </div>
        <TableTopHead
          onRefresh={() => void load()}
          onExportPdf={loading || filtered.length === 0 ? undefined : () => void handleExportPdf()}
          onExportExcel={loading || filtered.length === 0 ? undefined : () => void handleExportExcel()}
        />
        <div className="page-header-actions">
          <div className="page-btn">
            {viewTrash ? (
              <span className="btn btn-primary disabled" title="Switch to Active to add">
                <i className="feather icon-plus-circle me-1" />
                Add variant
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <i className="feather icon-plus-circle me-1" />
                Add variant
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
                      aria-label="Search variant attributes"
                    />
                  </label>
                </div>
              </div>
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

      <Modal show={showAdd} onHide={() => !addSubmitting && setShowAdd(false)} centered>
        <Modal.Header closeButton={!addSubmitting}>
          <Modal.Title>Add variant</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addError ? <div className="alert alert-danger py-2">{addError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Variant<span className="text-danger ms-1">*</span>
            </label>
            <input type="text" className="form-control" value={addName} onChange={(e) => setAddName(e.target.value)} maxLength={255} autoFocus />
          </div>
          <div className="mb-3">
            <label className="form-label">
              Values<span className="text-danger ms-1">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={addValues}
              onChange={(e) => setAddValues(e.target.value)}
              placeholder="S, M, L, XL"
            />
            <div className="text-muted small mt-2">Enter values separated by commas.</div>
          </div>
          <div className="mb-0 mt-3">
            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
              <span className="status-label">Status</span>
              <input type="checkbox" id="add-var-status" className="check" checked={addActive} onChange={(e) => setAddActive(e.target.checked)} />
              <label htmlFor="add-var-status" className="checktoggle" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" disabled={addSubmitting} onClick={() => setShowAdd(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary ms-2" disabled={addSubmitting || !addName.trim()} onClick={() => void submitAdd()}>
            {addSubmitting ? 'Saving…' : 'Create'}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEdit} onHide={closeEditModal} centered>
        <Modal.Header closeButton={!editSubmitting}>
          <Modal.Title>Edit variant</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Variant<span className="text-danger ms-1">*</span>
            </label>
            <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={255} autoFocus disabled={editSubmitting} />
          </div>
          <div className="mb-3">
            <label className="form-label">
              Values<span className="text-danger ms-1">*</span>
            </label>
            <input type="text" className="form-control" value={editValues} onChange={(e) => setEditValues(e.target.value)} disabled={editSubmitting} />
            <div className="text-muted small mt-2">Enter values separated by commas.</div>
          </div>
          <div className="mb-0 mt-3">
            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
              <span className="status-label">Status</span>
              <input type="checkbox" id="edit-var-status" className="check" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} disabled={editSubmitting} />
              <label htmlFor="edit-var-status" className="checktoggle" />
            </div>
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
        message={deleteTarget ? `Move variant "${deleteTarget.label}" to trash?` : ''}
        confirmLabel="Move to trash"
        submittingLabel="Moving…"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />
    </div>
  );
}

