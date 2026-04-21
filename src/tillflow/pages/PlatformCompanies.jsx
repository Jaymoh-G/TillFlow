import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import PrimeDataTable from '../../components/data-table';
import CommonFooter from '../../components/footer/commonFooter';
import TooltipIcons from '../../components/tooltip-content/tooltipIcons';
import RefreshIcon from '../../components/tooltip-content/refresh';
import CollapesIcon from '../../components/tooltip-content/collapes';
import CompaniesStatsRow from '../../feature-module/super-admin/companies/CompaniesStatsRow';
import {
  mapPlatformTenantToRow,
  getPlatformCompaniesColumns
} from '../../feature-module/super-admin/companies/mapPlatformTenantToRow';
import {
  createPlatformTenant,
  fetchPlatformTenant,
  fetchPlatformTenants,
  updatePlatformTenant
} from '../../core/api/platformAdminApi';
import { tillflowFetch } from '../api/client';
import { TillFlowApiError } from '../api/errors';

function readToken() {
  return localStorage.getItem('tillflow_sanctum_token');
}

function computeStats(tenants) {
  const list = tenants || [];
  const total = list.length;
  let active = 0;
  let inactive = 0;
  let locations = 0;
  for (const t of list) {
    if (t.status === 'suspended') {
      inactive += 1;
    } else {
      active += 1;
    }
    if (t.company_country || t.company_city || t.company_address_line) {
      locations += 1;
    }
  }
  return { total, active, inactive, locations };
}

const emptyCreate = {
  name: '',
  slug: '',
  company_email: '',
  company_phone: '',
  company_website: '',
  company_address_line: ''
};

export default function PlatformCompanies() {
  const [booting, setBooting] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [apiTenants, setApiTenants] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTenant, setViewTenant] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyCreate);
  const [editId, setEditId] = useState(null);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendRow, setSuspendRow] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const query = {};
      if (q.trim()) {
        query.q = q.trim();
      }
      if (statusFilter) {
        query.status = statusFilter;
      }
      const data = await fetchPlatformTenants(query);
      setApiTenants(data.tenants || []);
    } catch (e) {
      setLoadError(e instanceof TillFlowApiError ? e.message : 'Failed to load companies.');
      setApiTenants([]);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tok = readToken();
      if (!tok) {
        setAllowed(false);
        setBooting(false);
        return;
      }
      try {
        const me = await tillflowFetch('/auth/me', { token: tok });
        if (cancelled) {
          return;
        }
        if (!me.user?.is_platform_owner) {
          setAllowed(false);
        } else {
          setAllowed(true);
          setLoadError('');
          try {
            const data = await fetchPlatformTenants({});
            if (!cancelled) {
              setApiTenants(data.tenants || []);
            }
          } catch (e) {
            if (!cancelled) {
              setLoadError(e instanceof TillFlowApiError ? e.message : 'Failed to load companies.');
            }
          }
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const tableRows = useMemo(() => (apiTenants || []).map(mapPlatformTenantToRow), [apiTenants]);
  const totalRecords = tableRows.length;
  const stats = useMemo(() => computeStats(apiTenants), [apiTenants]);

  const handleViewClick = useCallback(async (row) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewTenant(null);
    try {
      const data = await fetchPlatformTenant(row.id);
      setViewTenant(data.tenant);
    } catch {
      setViewTenant(null);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const handleEditClick = useCallback((row) => {
    const raw = row._raw;
    setEditId(raw.id);
    setEditForm({
      name: raw.name || '',
      slug: raw.slug || '',
      company_email: raw.company_email || '',
      company_phone: raw.company_phone || '',
      company_website: raw.company_website || '',
      company_address_line: raw.company_address_line || ''
    });
    setEditOpen(true);
  }, []);

  const submitCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPlatformTenant({
        name: createForm.name,
        slug: createForm.slug || undefined,
        company_email: createForm.company_email || undefined,
        company_phone: createForm.company_phone || undefined,
        company_website: createForm.company_website || undefined,
        company_address_line: createForm.company_address_line || undefined
      });
      setShowAdd(false);
      setCreateForm(emptyCreate);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not create company.');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editId) {
      return;
    }
    setSaving(true);
    try {
      const patch = {
        name: editForm.name.trim(),
        company_email: editForm.company_email?.trim() || null,
        company_phone: editForm.company_phone?.trim() || null,
        company_website: editForm.company_website?.trim() || null,
        company_address_line: editForm.company_address_line?.trim() || null
      };
      const s = editForm.slug?.trim();
      if (s) {
        patch.slug = s;
      }
      await updatePlatformTenant(editId, patch);
      setEditOpen(false);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not update company.');
    } finally {
      setSaving(false);
    }
  };

  const confirmSuspend = async () => {
    if (!suspendRow) {
      return;
    }
    const raw = suspendRow._raw;
    const next = raw.status === 'suspended' ? 'active' : 'suspended';
    setSaving(true);
    try {
      await updatePlatformTenant(raw.id, {
        status: next,
        ...(next === 'suspended'
          ? { suspended_reason: 'Suspended from platform console' }
          : { suspended_reason: null })
      });
      setSuspendOpen(false);
      setSuspendRow(null);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not update status.');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () =>
      getPlatformCompaniesColumns({
        onView: (row) => void handleViewClick(row),
        onEdit: (row) => handleEditClick(row),
        onDelete: (row) => {
          setSuspendRow(row);
          setSuspendOpen(true);
        }
      }),
    [handleViewClick, handleEditClick]
  );

  if (booting) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/tillflow/admin" replace />;
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Companies</h4>
                <h6>Subscriber organizations (tenants)</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <TooltipIcons />
              <RefreshIcon />
              <CollapesIcon />
            </ul>
            <div className="page-btn">
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <i className="ti ti-circle-plus me-1" />
                Add Company
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          ) : null}

          <CompaniesStatsRow stats={stats} />

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <h5>Companies List</h5>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                <input
                  type="search"
                  className="form-control"
                  style={{ minWidth: 180 }}
                  placeholder="Search name or slug"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void load();
                    }
                  }}
                />
                <select
                  className="form-select"
                  style={{ width: 'auto' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <button type="button" className="btn btn-white border" onClick={() => void load()}>
                  Apply
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={tableRows}
                  totalRecords={totalRecords}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  rows={rows}
                  setRows={setRows}
                  selectionMode="checkbox"
                  selection={selected}
                  onSelectionChange={(e) => setSelected(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered size="lg">
        <Form onSubmit={submitCreate}>
          <Modal.Header closeButton>
            <Modal.Title>Add company (tenant)</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-md-12">
                <Form.Label>Name *</Form.Label>
                <Form.Control
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Slug (optional)</Form.Label>
                <Form.Control
                  placeholder="auto from name if empty"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Company email</Form.Label>
                <Form.Control
                  type="email"
                  value={createForm.company_email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company_email: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  value={createForm.company_phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company_phone: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Website</Form.Label>
                <Form.Control
                  value={createForm.company_website}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company_website: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={createForm.company_address_line}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, company_address_line: e.target.value }))
                  }
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={editOpen} onHide={() => setEditOpen(false)} centered size="lg">
        <Form onSubmit={submitEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit company</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-md-12">
                <Form.Label>Name *</Form.Label>
                <Form.Control
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Slug</Form.Label>
                <Form.Control
                  value={editForm.slug}
                  onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Company email</Form.Label>
                <Form.Control
                  type="email"
                  value={editForm.company_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, company_email: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  value={editForm.company_phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, company_phone: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Website</Form.Label>
                <Form.Control
                  value={editForm.company_website}
                  onChange={(e) => setEditForm((f) => ({ ...f, company_website: e.target.value }))}
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={editForm.company_address_line}
                  onChange={(e) => setEditForm((f) => ({ ...f, company_address_line: e.target.value }))}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={viewOpen} onHide={() => setViewOpen(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Company detail</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : viewTenant ? (
            <pre className="small mb-0" style={{ maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(viewTenant, null, 2)}
            </pre>
          ) : (
            <p className="text-muted mb-0">Could not load detail.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setViewOpen(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={suspendOpen} onHide={() => setSuspendOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {suspendRow?._raw?.status === 'suspended' ? 'Activate' : 'Suspend'} company
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {suspendRow ? (
            <p className="mb-0">
              {suspendRow._raw?.status === 'suspended'
                ? `Activate "${suspendRow.CompanyName}"?`
                : `Suspend "${suspendRow.CompanyName}"? They will be blocked from using the app.`}
            </p>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSuspendOpen(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={() => void confirmSuspend()} disabled={saving}>
            {saving ? '…' : 'Confirm'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
