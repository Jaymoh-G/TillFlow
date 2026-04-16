import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import PrimeDataTable from '../../components/data-table';
import TableTopHead from '../../components/table-top-head';
import {
  createBrandWithLogoRequest,
  deleteBrandRequest,
  listBrandsRequest,
  listTrashedBrandsRequest,
  restoreBrandRequest,
  updateBrandWithLogoRequest,
} from '../api/brands';
import { TillFlowApiError } from '../api/errors';
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

function LogoThumb({ url }) {
  if (!url) {
    return <span className="text-muted small">—</span>;
  }
  return (
    <img
      src={url}
      alt=""
      className="rounded border bg-white"
      style={{ width: 40, height: 40, objectFit: 'contain' }}
      loading="lazy"
    />
  );
}

export default function AdminBrands() {
  const { token } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editLogoPreviewUrl, setEditLogoPreviewUrl] = useState(null);
  const editLogoInputRef = useRef(null);
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
  const [addLogoFile, setAddLogoFile] = useState(null);
  const [addLogoPreviewUrl, setAddLogoPreviewUrl] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = viewTrash ? await listTrashedBrandsRequest(token) : await listBrandsRequest(token);
      setBrands(data.brands ?? []);
    } catch (e) {
      setBrands([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog masters permission)` : e.message);
      } else {
        setListError('Failed to load brands');
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
      return brands;
    }
    return brands.filter(
      (b) =>
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.slug && String(b.slug).toLowerCase().includes(q)) ||
        (b.logo_url && String(b.logo_url).toLowerCase().includes(q))
    );
  }, [brands, searchQuery]);

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

  const allPageSelected = pageRows.length > 0 && pageRows.every((b) => selectedIds.has(b.id));

  function toggleSelectAllOnPage() {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((b) => next.delete(b.id));
    } else {
      pageRows.forEach((b) => next.add(b.id));
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

  function startEdit(b) {
    setRowError('');
    setEditError('');
    setEditingId(b.id);
    setEditName(b.name);
    setEditSlug(b.slug ?? '');
    // Logo file is optional; if user doesn't pick one, we keep existing logo_url.
    setEditLogoFile(null);
    setEditLogoPreviewUrl(null);
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
      const selectedFileFromInput = editLogoInputRef.current?.files?.[0] ?? null;
      const logoFileToUpload = editLogoFile ?? selectedFileFromInput;
      await updateBrandWithLogoRequest(token, editingId, {
        name: editName.trim(),
        slug: editSlug.trim() || null,
        logoFile: logoFileToUpload,
      });
      setShowEdit(false);
      setEditingId(null);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        const maybeErrors = err.data?.errors;
        const firstFieldError =
          maybeErrors && typeof maybeErrors === 'object'
            ? maybeErrors[Object.keys(maybeErrors)[0]]?.[0]
            : null;
        setEditError(firstFieldError ? `${err.message}: ${firstFieldError}` : err.message);
      } else {
        setEditError('Update failed');
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  function openDeleteModal(brandId, label) {
    setDeleteTarget({ id: brandId, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) {
      return;
    }
    const { id: brandId } = deleteTarget;
    setDeleteSubmitting(true);
    setRowError('');
    setListError('');
    try {
      await deleteBrandRequest(token, brandId);
      if (editingId === brandId) {
        setShowEdit(false);
        setEditingId(null);
      }
      selectedIds.delete(brandId);
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

  async function handleRestore(brandId) {
    if (!token) {
      return;
    }
    setRowError('');
    setListError('');
    setRestoreSubmittingId(brandId);
    try {
      await restoreBrandRequest(token, brandId);
      if (editingId === brandId) {
        setShowEdit(false);
        setEditingId(null);
      }
      selectedIds.delete(brandId);
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
    setAddLogoFile(null);
    setAddLogoPreviewUrl(null);
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!token) {
      return;
    }
    setAddError('');
    setAddSubmitting(true);
    try {
      await createBrandWithLogoRequest(token, {
        name: addName.trim(),
        slug: addSlug.trim() || null,
        logoFile: addLogoFile,
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        const maybeErrors = err.data?.errors;
        const firstFieldError =
          maybeErrors && typeof maybeErrors === 'object'
            ? maybeErrors[Object.keys(maybeErrors)[0]]?.[0]
            : null;
        setAddError(firstFieldError ? `${err.message}: ${firstFieldError}` : err.message);
      } else {
        setAddError('Could not create brand');
      }
    } finally {
      setAddSubmitting(false);
    }
  }

  const handleExportExcel = useCallback(async () => {
    const records = filtered.map((b) => ({
      Name: String(b.name ?? ''),
      Slug: String(b.slug ?? ''),
      Logo: String(b.logo_url ?? ''),
      [viewTrash ? 'Deleted' : 'Created']: formatListDate(viewTrash ? b.deleted_at : b.created_at)
    }));
    await downloadRowsExcel(records, 'Brands', viewTrash ? 'brands-trash' : 'brands');
  }, [filtered, viewTrash]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((b) => [
      String(b.name ?? ''),
      String(b.slug ?? ''),
      String(b.logo_url ?? ''),
      formatListDate(viewTrash ? b.deleted_at : b.created_at)
    ]);
    await downloadRowsPdf(
      viewTrash ? 'Brands (trash)' : 'Brands',
      ['Name', 'Slug', 'Logo URL', viewTrash ? 'Deleted' : 'Created'],
      body,
      viewTrash ? 'brands-trash' : 'brands'
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
        body: (b) => (
          <label className="checkboxs mb-0">
            <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleRow(b.id)} />
            <span className="checkmarks" />
          </label>
        )
      },
      { header: 'Logo', field: 'logo_url', body: (b) => <LogoThumb url={b.logo_url} /> },
      {
        header: 'Name',
        field: 'name',
        body: (b) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-md me-2">{initials(b.name)}</div>
            <span>{b.name}</span>
          </div>
        )
      },
      { header: 'Slug', field: 'slug', body: (b) => <span className="tf-mono">{b.slug ?? '—'}</span> },
      {
        header: viewTrash ? 'Deleted' : 'Created',
        field: viewTrash ? 'deleted_at' : 'created_at',
        body: (b) => <span className="userimgname text-muted small">{formatListDate(viewTrash ? b.deleted_at : b.created_at)}</span>
      },
      {
        header: 'Actions',
        field: 'actions',
        sortable: false,
        className: 'text-end',
        headerClassName: 'text-end',
        body: (b) => (
          <div className="edit-delete-action d-flex align-items-center justify-content-end">
            {viewTrash ? (
              <button
                type="button"
                className="p-2 d-flex align-items-center border rounded bg-transparent"
                disabled={restoreSubmittingId === b.id}
                onClick={() => void handleRestore(b.id)}
                title="Restore"
              >
                <i className="feather icon-rotate-ccw" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="me-2 p-2 d-flex align-items-center border rounded bg-transparent"
                  onClick={() => startEdit(b)}
                  title="Edit"
                >
                  <i className="feather icon-edit" />
                </button>
                <button
                  type="button"
                  className="p-2 d-flex align-items-center border rounded bg-transparent"
                  onClick={() => openDeleteModal(b.id, b.name)}
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

  // Create/revoke object URLs for local logo previews.
  useEffect(() => {
    if (!editLogoFile) {
      setEditLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(editLogoFile);
    setEditLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editLogoFile]);

  useEffect(() => {
    if (!addLogoFile) {
      setAddLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(addLogoFile);
    setAddLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [addLogoFile]);

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? 'Trash' : 'Brands'}</h4>
            <h6>{viewTrash ? 'Restore deleted brands' : 'Manage product brands'}</h6>
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
                Add brand
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <i className="feather icon-plus-circle me-1" />
                Add brand
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
                      aria-label="Search brands"
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
          <Modal.Title>Add brand</Modal.Title>
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
          <div className="mb-3">
            <label className="form-label">Slug</label>
            <input
              type="text"
              className="form-control"
              value={addSlug}
              onChange={(e) => setAddSlug(e.target.value)}
              maxLength={100}
              placeholder="optional; auto from name if empty"
            />
          </div>
          <div className="mb-0">
            <label className="form-label">Logo</label>
            {addLogoPreviewUrl ? (
              <div className="mb-2">
                <LogoThumb url={addLogoPreviewUrl} />
              </div>
            ) : null}
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => setAddLogoFile(e.target.files?.[0] ?? null)}
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
          <Modal.Title>Edit brand</Modal.Title>
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
          <div className="mb-3">
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
          <div className="mb-0">
            <label className="form-label">Logo</label>
            <div className="d-flex align-items-center gap-3">
              <LogoThumb url={editLogoPreviewUrl ?? brands.find((b) => b.id === editingId)?.logo_url ?? null} />
              <input
                type="file"
                accept="image/*"
                ref={editLogoInputRef}
                className="form-control"
                onChange={(e) => setEditLogoFile(e.target.files?.[0] ?? null)}
                disabled={editSubmitting}
              />
            </div>
            <div className="text-muted small mt-2">Leave empty to keep the current logo.</div>
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
          deleteTarget ? `Move brand "${deleteTarget.label}" to trash? Linked items keep brand_id until edited.` : ''
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
