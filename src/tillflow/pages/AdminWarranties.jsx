import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { TillFlowApiError } from '../api/errors';
import TableTopHead from '../../components/table-top-head';
import {
  createWarrantyRequest,
  deleteWarrantyRequest,
  listTrashedWarrantiesRequest,
  listWarrantiesRequest,
  restoreWarrantyRequest,
  updateWarrantyRequest,
} from '../api/warranties';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ImportRecordsModal from '../components/ImportRecordsModal';
import { downloadRowsExcel, downloadRowsPdf } from '../utils/listExport';
import { downloadWarrantiesImportTemplate, parseWarrantiesImportFile } from '../utils/warrantiesImport';

function formatListDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDuration(w) {
  const v = w?.duration_value;
  const u = w?.duration_unit;
  if (!v || !u) return '—';
  const unit = v === 1 ? u : `${u}s`;
  return `${v} ${unit}`;
}

export default function AdminWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [rowError, setRowError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addDurationValue, setAddDurationValue] = useState(3);
  const [addDurationUnit, setAddDurationUnit] = useState('month');
  const [addActive, setAddActive] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDurationValue, setEditDurationValue] = useState(3);
  const [editDurationUnit, setEditDurationUnit] = useState('month');
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash ? await listTrashedWarrantiesRequest(token) : await listWarrantiesRequest(token);
      setWarranties(data.warranties ?? []);
    } catch (e) {
      setWarranties([]);
      if (e instanceof TillFlowApiError) setListError(e.status === 403 ? `${e.message} (needs catalog masters permission)` : e.message);
      else setListError('Failed to load warranties');
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
    if (!q) return warranties;
    return warranties.filter((w) => {
      const hay = `${w.name ?? ''} ${w.description ?? ''} ${w.duration_value ?? ''} ${w.duration_unit ?? ''} ${w.is_active ? 'active' : 'inactive'}`.toLowerCase();
      return hay.includes(q);
    });
  }, [warranties, searchQuery]);

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
    if (allPageSelected) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
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
    setAddDescription('');
    setAddDurationValue(3);
    setAddDurationUnit('month');
    setAddActive(true);
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!token) return;
    setAddError('');
    setAddSubmitting(true);
    try {
      await createWarrantyRequest(token, {
        name: addName.trim(),
        description: addDescription.trim() || null,
        duration_value: Number(addDurationValue),
        duration_unit: addDurationUnit,
        is_active: addActive,
      });
      setShowAdd(false);
      await load();
    } catch (e) {
      if (e instanceof TillFlowApiError) setAddError(e.message);
      else setAddError('Could not create warranty');
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEdit(w) {
    setEditError('');
    setEditingId(w.id);
    setEditName(w.name ?? '');
    setEditDescription(w.description ?? '');
    setEditDurationValue(w.duration_value ?? 1);
    setEditDurationUnit(w.duration_unit ?? 'month');
    setEditActive(Boolean(w.is_active));
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
      await updateWarrantyRequest(token, editingId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        duration_value: Number(editDurationValue),
        duration_unit: editDurationUnit,
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
      await deleteWarrantyRequest(token, deleteTarget.id);
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
      await restoreWarrantyRequest(token, id);
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
    const records = filtered.map((w) => ({
      Name: String(w.name ?? ''),
      Description: String(w.description ?? ''),
      Duration: formatDuration(w),
      Status: w.is_active ? 'Active' : 'Inactive',
      Created: formatListDate(viewTrash ? w.deleted_at : w.created_at)
    }));
    await downloadRowsExcel(records, 'Warranties', viewTrash ? 'warranties-trash' : 'warranties');
  }, [filtered, viewTrash]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((w) => [
      String(w.name ?? ''),
      String(w.description ?? ''),
      formatDuration(w),
      w.is_active ? 'Active' : 'Inactive',
      formatListDate(viewTrash ? w.deleted_at : w.created_at)
    ]);
    await downloadRowsPdf(
      viewTrash ? 'Warranties (trash)' : 'Warranties',
      ['Name', 'Description', 'Duration', 'Status', viewTrash ? 'Deleted' : 'Created'],
      body,
      viewTrash ? 'warranties-trash' : 'warranties'
    );
  }, [filtered, viewTrash]);

  const runImportWarranties = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createWarrantyRequest(token, row);
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(`Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : 'Could not create warranty.'}`);
      }
    }
    await load();
    setImportSummary({ created, skipped: 0, failed, details });
    setImporting(false);
  }, [token, importRows, load]);

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? 'Trash' : 'Warranties'}</h4>
            <h6>{viewTrash ? 'Restore deleted warranties' : 'Manage your warranties'}</h6>
          </div>
        </div>
        <TableTopHead
          onRefresh={() => void load()}
          onExportPdf={loading || filtered.length === 0 ? undefined : () => void handleExportPdf()}
          onExportExcel={loading || filtered.length === 0 ? undefined : () => void handleExportExcel()}
          onImport={!viewTrash ? () => setShowImport(true) : undefined}
        />
        <div className="page-header-actions">
          <div className="page-btn">
            {viewTrash ? (
              <span className="btn btn-primary disabled" title="Switch to Active to add">
                <i className="feather icon-plus-circle me-1" />
                Add warranty
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <i className="feather icon-plus-circle me-1" />
                Add warranty
              </button>
            )}
          </div>
          <div className="page-btn import">
            <Link to="/admin/add-product" className="btn btn-secondary color">
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
                      aria-label="Search warranties"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted mb-0">Rows</label>
              <select className="form-select form-select-sm" value={rows} onChange={(e) => setRows(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Active or trash">
              <button type="button" className={`btn ${!viewTrash ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewTrash(false)}>
                Active
              </button>
              <button type="button" className={`btn ${viewTrash ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewTrash(true)}>
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
                  <th>Description</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>{viewTrash ? 'Deleted' : 'Created'}</th>
                  <th className="no-sort" />
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
                      No warranties found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <label className="checkboxs mb-0">
                          <input type="checkbox" checked={selectedIds.has(w.id)} onChange={() => toggleRow(w.id)} />
                          <span className="checkmarks" />
                        </label>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-md me-2">{initials(w.name)}</div>
                          <span>{w.name}</span>
                        </div>
                      </td>
                      <td className="text-muted small">{w.description ?? '—'}</td>
                      <td>{formatDuration(w)}</td>
                      <td>
                        <span className={`badge ${w.is_active ? 'bg-success' : 'bg-secondary'} fw-medium fs-10`}>
                          {w.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="userimgname text-muted small">
                          {formatListDate(viewTrash ? w.deleted_at : w.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="edit-delete-action d-flex align-items-center">
                          {viewTrash ? (
                            <button
                              type="button"
                              className="p-2 d-flex align-items-center border rounded bg-transparent"
                              disabled={restoreSubmittingId === w.id}
                              onClick={() => void handleRestore(w.id)}
                              title="Restore"
                            >
                              <i className="feather icon-rotate-ccw" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="me-2 p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => startEdit(w)}
                                title="Edit"
                              >
                                <i className="feather icon-edit" />
                              </button>
                              <button
                                type="button"
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                onClick={() => openDeleteModal(w.id, w.name)}
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
                <button type="button" className="btn btn-sm btn-primary" disabled={safePage <= 1} onClick={() => setCurrentPage((x) => Math.max(1, x - 1))}>
                  Previous
                </button>
                <span className="text-muted small">
                  Page {safePage} of {totalPages}
                </span>
                <button type="button" className="btn btn-sm btn-primary" disabled={safePage >= totalPages} onClick={() => setCurrentPage((x) => Math.min(totalPages, x + 1))}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal show={showAdd} onHide={() => !addSubmitting && setShowAdd(false)} centered>
        <Modal.Header closeButton={!addSubmitting}>
          <Modal.Title>Add warranty</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addError ? <div className="alert alert-danger py-2">{addError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Name<span className="text-danger ms-1">*</span>
            </label>
            <input className="form-control" value={addName} onChange={(e) => setAddName(e.target.value)} maxLength={255} autoFocus />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} />
          </div>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label">
                Duration<span className="text-danger ms-1">*</span>
              </label>
              <input type="number" min={1} className="form-control" value={addDurationValue} onChange={(e) => setAddDurationValue(Number(e.target.value))} />
            </div>
            <div className="col-sm-6">
              <label className="form-label">
                Period<span className="text-danger ms-1">*</span>
              </label>
              <select className="form-select" value={addDurationUnit} onChange={(e) => setAddDurationUnit(e.target.value)}>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>
          <div className="mb-0 mt-3">
            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
              <span className="status-label">Status</span>
              <input type="checkbox" id="add-war-status" className="check" checked={addActive} onChange={(e) => setAddActive(e.target.checked)} />
              <label htmlFor="add-war-status" className="checktoggle" />
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
          <Modal.Title>Edit warranty</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
          <div className="mb-3">
            <label className="form-label">
              Name<span className="text-danger ms-1">*</span>
            </label>
            <input className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={255} autoFocus disabled={editSubmitting} />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={editSubmitting} />
          </div>
          <div className="row g-2">
            <div className="col-sm-6">
              <label className="form-label">
                Duration<span className="text-danger ms-1">*</span>
              </label>
              <input type="number" min={1} className="form-control" value={editDurationValue} onChange={(e) => setEditDurationValue(Number(e.target.value))} disabled={editSubmitting} />
            </div>
            <div className="col-sm-6">
              <label className="form-label">
                Period<span className="text-danger ms-1">*</span>
              </label>
              <select className="form-select" value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value)} disabled={editSubmitting}>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>
          <div className="mb-0 mt-3">
            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
              <span className="status-label">Status</span>
              <input type="checkbox" id="edit-war-status" className="check" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} disabled={editSubmitting} />
              <label htmlFor="edit-war-status" className="checktoggle" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" disabled={editSubmitting} onClick={closeEditModal}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary ms-2" disabled={editSubmitting || !editName.trim()} onClick={() => void submitEdit()}>
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
        message={deleteTarget ? `Move warranty "${deleteTarget.label}" to trash?` : ''}
        confirmLabel="Move to trash"
        submittingLabel="Moving…"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />
      <ImportRecordsModal
        show={showImport}
        title="Import warranties"
        helpText='Required columns: name, duration_value, duration_unit (month/year).'
        previewColumns={[
          { key: 'sheetRow', label: 'Row', render: (r) => r.sheetRow },
          { key: 'name', label: 'Name', render: (r) => r.name },
          { key: 'duration', label: 'Duration', render: (r) => `${r.duration_value} ${r.duration_unit}` },
          { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? 'Active' : 'Inactive') }
        ]}
        previewRows={importRows}
        parseErrors={importErrors}
        summary={importSummary}
        importing={importing}
        onClose={() => {
          if (!importing) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        onDownloadTemplate={() => void downloadWarrantiesImportTemplate()}
        onChooseFile={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          const parsed = await parseWarrantiesImportFile(file);
          setImportRows(parsed.rows);
          setImportErrors(parsed.errors);
          setImportSummary(null);
        }}
        onImport={() => void runImportWarranties()}
      />
    </div>
  );
}

