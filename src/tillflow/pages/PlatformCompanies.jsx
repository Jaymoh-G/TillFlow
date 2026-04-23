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
  company_address_line: '',
  primary_contact_name: '',
  invite_primary_contact: true
};

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value ?? '').trim();
}

function websiteHref(raw) {
  const s = String(raw ?? '').trim();
  if (!s) {
    return '';
  }
  if (/^https?:\/\//i.test(s)) {
    return s;
  }
  return `https://${s}`;
}

function formatDetailDate(iso) {
  if (!iso) {
    return '—';
  }
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

function DetailField({ label, children, className = 'col-md-6' }) {
  return (
    <div className={className}>
      <div className="text-muted small mb-1">{label}</div>
      <div>{children ?? '—'}</div>
    </div>
  );
}

/** @param {{ tenant: Record<string, unknown> }} props */
function PlatformTenantDetailView({ tenant }) {
  const status = tenant.status === 'suspended' ? 'Suspended' : 'Active';
  const badgeClass =
    tenant.status === 'suspended' ? 'badge-danger' : 'badge-success';
  const subs = Array.isArray(tenant.subscriptions) ? tenant.subscriptions : [];

  return (
    <div>
      <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h6 className="mb-1">{tenant.name || '—'}</h6>
          <span className="text-muted small">ID {tenant.id}</span>
        </div>
        <span className={`badge ${badgeClass} badge-xs d-inline-flex align-items-center`}>
          <i className="ti ti-point-filled me-1" />
          {status}
        </span>
      </div>

      {tenant.suspended_reason ? (
        <div className="alert alert-warning py-2 px-3 small mb-3" role="status">
          <strong>Suspension reason:</strong> {String(tenant.suspended_reason)}
        </div>
      ) : null}

      <h6 className="text-uppercase text-muted small mb-2">Profile</h6>
      <div className="row g-2 mb-3">
        <DetailField label="Slug">{tenant.slug}</DetailField>
        <DetailField label="Created">{formatDetailDate(tenant.created_at)}</DetailField>
        <DetailField label="Last active">{formatDetailDate(tenant.last_active_at)}</DetailField>
      </div>

      <h6 className="text-uppercase text-muted small mb-2">Contact</h6>
      <div className="row g-2 mb-3">
        <DetailField label="Email">
          {tenant.company_email ? (
            <a href={`mailto:${tenant.company_email}`}>{String(tenant.company_email)}</a>
          ) : (
            '—'
          )}
        </DetailField>
        <DetailField label="Phone">{tenant.company_phone}</DetailField>
        <DetailField label="Fax">{tenant.company_fax}</DetailField>
        <DetailField label="Website">
          {tenant.company_website ? (
            <a href={websiteHref(tenant.company_website)} target="_blank" rel="noopener noreferrer">
              {String(tenant.company_website)}
            </a>
          ) : (
            '—'
          )}
        </DetailField>
      </div>

      <h6 className="text-uppercase text-muted small mb-2">Address</h6>
      <div className="row g-2 mb-3">
        <DetailField className="col-12" label="Street / line">
          {tenant.company_address_line}
        </DetailField>
        <DetailField label="City">{tenant.company_city}</DetailField>
        <DetailField label="State / region">{tenant.company_state}</DetailField>
        <DetailField label="Postal code">{tenant.company_postal_code}</DetailField>
        <DetailField label="Country">{tenant.company_country}</DetailField>
      </div>

      <h6 className="text-uppercase text-muted small mb-2">Subscription</h6>
      <div className="row g-2 mb-3">
        <DetailField label="Current plan">
          {tenant.current_plan && typeof tenant.current_plan === 'object'
            ? tenant.current_plan.name
            : '—'}
        </DetailField>
        <DetailField label="Renews / ends">{formatDetailDate(tenant.subscription_ends_at)}</DetailField>
      </div>

      {subs.length > 0 ? (
        <>
          <h6 className="text-uppercase text-muted small mb-2">History</h6>
          <div className="table-responsive border rounded">
            <table className="table table-sm table-striped mb-0 small">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Extra stores</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{s.plan && typeof s.plan === 'object' ? s.plan.name : '—'}</td>
                    <td>{s.status}</td>
                    <td>{formatDetailDate(s.starts_at)}</td>
                    <td>{formatDetailDate(s.ends_at)}</td>
                    <td>{s.purchased_extra_stores ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subs.some((s) => Array.isArray(s.payments) && s.payments.length > 0) ? (
            <div className="mt-3">
              <h6 className="text-uppercase text-muted small mb-2">Payments</h6>
              {subs.map((s) => {
                const payments = Array.isArray(s.payments) ? s.payments : [];
                if (!payments.length) {
                  return null;
                }
                const planName = s.plan && typeof s.plan === 'object' ? s.plan.name : 'Subscription';
                return (
                  <div key={`pay-${String(s.id)}`} className="mb-3">
                    <div className="small text-muted mb-1">{planName}</div>
                    <div className="table-responsive border rounded">
                      <table className="table table-sm mb-0 small">
                        <thead>
                          <tr>
                            <th>Amount</th>
                            <th>Paid</th>
                            <th>Method</th>
                            <th>Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={String(p.id)}>
                              <td>
                                {p.amount != null && p.currency
                                  ? `${p.currency} ${Number(p.amount).toFixed(2)}`
                                  : p.amount != null
                                    ? String(p.amount)
                                    : '—'}
                              </td>
                              <td>{formatDetailDate(p.paid_at)}</td>
                              <td>{p.method ?? '—'}</td>
                              <td>{p.reference ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

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
    if (createForm.invite_primary_contact && !normalizeEmail(createForm.company_email)) {
      window.alert('Company email is required when sending an invitation to the primary contact.');
      return;
    }
    const email = normalizeEmail(createForm.company_email);
    const phone = normalizePhone(createForm.company_phone);
    const duplicateEmail = email
      ? (apiTenants || []).some((t) => normalizeEmail(t.company_email) === email)
      : false;
    const duplicatePhone = phone
      ? (apiTenants || []).some((t) => normalizePhone(t.company_phone) === phone)
      : false;
    if (duplicateEmail || duplicatePhone) {
      const msg = [
        duplicateEmail ? 'Company email must be unique.' : null,
        duplicatePhone ? 'Company phone must be unique.' : null
      ]
        .filter(Boolean)
        .join(' ');
      window.alert(msg);
      return;
    }
    setSaving(true);
    try {
      await createPlatformTenant({
        name: createForm.name,
        slug: createForm.slug || undefined,
        company_email: createForm.company_email || undefined,
        company_phone: createForm.company_phone || undefined,
        company_website: createForm.company_website || undefined,
        company_address_line: createForm.company_address_line || undefined,
        invite_primary_contact: createForm.invite_primary_contact,
        primary_contact_name: createForm.primary_contact_name?.trim() || undefined
      });
      setShowAdd(false);
      setCreateForm(emptyCreate);
      await load();
    } catch (err) {
      let msg = 'Could not create company.';
      if (err instanceof TillFlowApiError) {
        msg = err.message;
        const errs = err.data?.errors;
        if (errs && typeof errs === 'object') {
          const flat = Object.values(errs)
            .flat()
            .filter((x) => typeof x === 'string' && x.length);
          if (flat.length) {
            msg = String(flat[0]);
          }
        }
      }
      window.alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editId) {
      return;
    }
    const email = normalizeEmail(editForm.company_email);
    const phone = normalizePhone(editForm.company_phone);
    const duplicateEmail = email
      ? (apiTenants || []).some((t) => Number(t.id) !== Number(editId) && normalizeEmail(t.company_email) === email)
      : false;
    const duplicatePhone = phone
      ? (apiTenants || []).some((t) => Number(t.id) !== Number(editId) && normalizePhone(t.company_phone) === phone)
      : false;
    if (duplicateEmail || duplicatePhone) {
      const msg = [
        duplicateEmail ? 'Company email must be unique.' : null,
        duplicatePhone ? 'Company phone must be unique.' : null
      ]
        .filter(Boolean)
        .join(' ');
      window.alert(msg);
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
    return <Navigate to="/admin" replace />;
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Companies</h4>
                <h6>
                  Subscriber organizations — primary contact is invited with the Tenant role; they can add users
                  after sign-in.
                </h6>
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
              <div className="col-md-12">
                <Form.Check
                  type="checkbox"
                  id="tf-invite-primary"
                  checked={createForm.invite_primary_contact}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, invite_primary_contact: e.target.checked }))
                  }
                  label="Send invitation to company email (Tenant role — can manage company profile and invite users)"
                />
              </div>
              <div className="col-md-12">
                <Form.Label>Primary contact name (optional)</Form.Label>
                <Form.Control
                  placeholder="Defaults to company name if empty"
                  value={createForm.primary_contact_name}
                  disabled={!createForm.invite_primary_contact}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, primary_contact_name: e.target.value }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Company email{createForm.invite_primary_contact ? ' *' : ''}</Form.Label>
                <Form.Control
                  type="email"
                  required={createForm.invite_primary_contact}
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
            <PlatformTenantDetailView tenant={viewTenant} />
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
