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
import { createPlatformTenantContact, fetchPlatformTenantContacts } from '../api/tenantContacts';
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
  company_phone: '',
  company_website: '',
  company_address_line: ''
};

const emptyContactForm = {
  first_name: '',
  last_name: '',
  position: '',
  email: '',
  phone: '',
  password: '',
  send_password_setup_email: false,
  is_primary: true
};

const emptyEdit = {
  name: '',
  company_email: '',
  company_phone: '',
  company_website: '',
  company_address_line: ''
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

/** @param {{ tenant: Record<string, unknown>, contacts?: Array<Record<string, unknown>> }} props */
function PlatformTenantDetailView({ tenant, contacts = [] }) {
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

      {contacts.length > 0 ? (
        <>
          <h6 className="text-uppercase text-muted small mb-2">Contacts</h6>
          <div className="table-responsive border rounded mb-3">
            <table className="table table-sm mb-0 small">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={String(c.id)}>
                    <td>
                      {c.display_name ? String(c.display_name) : '—'}
                      {c.is_primary ? (
                        <span className="badge badge-xs bg-secondary ms-1">Primary</span>
                      ) : null}
                    </td>
                    <td>{c.position ? String(c.position) : '—'}</td>
                    <td>
                      {c.email ? (
                        <a href={`mailto:${String(c.email)}`}>{String(c.email)}</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{c.phone ? String(c.phone) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h6 className="text-uppercase text-muted small mb-2">Billing / company (mirrored from primary contact)</h6>
      <div className="row g-2 mb-3">
        <DetailField label="Billing email">
          {tenant.company_email ? (
            <a href={`mailto:${tenant.company_email}`}>{String(tenant.company_email)}</a>
          ) : (
            '—'
          )}
        </DetailField>
        <DetailField label="Phone">{tenant.company_phone}</DetailField>
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
  const [addWizardStep, setAddWizardStep] = useState(1);
  const [newTenantId, setNewTenantId] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [contactAvatarFile, setContactAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTenant, setViewTenant] = useState(null);
  const [viewContacts, setViewContacts] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
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
    setViewContacts([]);
    try {
      const [tenantData, contactsEnvelope] = await Promise.all([
        fetchPlatformTenant(row.id),
        fetchPlatformTenantContacts(row.id).catch(() => ({ contacts: [] }))
      ]);
      setViewTenant(tenantData.tenant);
      setViewContacts(Array.isArray(contactsEnvelope?.contacts) ? contactsEnvelope.contacts : []);
    } catch {
      setViewTenant(null);
      setViewContacts([]);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const handleEditClick = useCallback((row) => {
    const raw = row._raw;
    setEditId(raw.id);
    setEditForm({
      name: raw.name || '',
      company_email: raw.company_email || '',
      company_phone: raw.company_phone || '',
      company_website: raw.company_website || '',
      company_address_line: raw.company_address_line || ''
    });
    setEditOpen(true);
  }, []);

  const resetAddWizard = () => {
    setAddWizardStep(1);
    setNewTenantId(null);
    setCreateForm(emptyCreate);
    setContactForm(emptyContactForm);
    setContactAvatarFile(null);
  };

  const submitCreateCompany = async (e) => {
    e.preventDefault();
    const phone = normalizePhone(createForm.company_phone);
    const duplicatePhone = phone
      ? (apiTenants || []).some((t) => normalizePhone(t.company_phone) === phone)
      : false;
    if (duplicatePhone) {
      window.alert('Company phone must be unique.');
      return;
    }
    setSaving(true);
    try {
      const data = await createPlatformTenant({
        name: createForm.name,
        company_phone: createForm.company_phone || undefined,
        company_website: createForm.company_website || undefined,
        company_address_line: createForm.company_address_line || undefined
      });
      const tenant = data.tenant;
      setNewTenantId(tenant?.id ?? null);
      setAddWizardStep(2);
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

  const submitContactForCompany = async (e) => {
    e.preventDefault();
    if (!newTenantId) {
      return;
    }
    const email = normalizeEmail(contactForm.email);
    if (contactForm.is_primary && !email) {
      window.alert('Primary contacts need an email (used for billing correspondence).');
      return;
    }
    const wantsLogin =
      contactForm.send_password_setup_email ||
      (String(contactForm.password ?? '').trim().length > 0);
    if (wantsLogin && !email) {
      window.alert('Email is required for an invitation or login.');
      return;
    }
    if (
      wantsLogin &&
      !contactForm.send_password_setup_email &&
      String(contactForm.password ?? '').trim().length < 8
    ) {
      window.alert('Use at least 8 characters for the password, or enable “Send set-password email”.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', contactForm.first_name.trim());
      fd.append('last_name', contactForm.last_name.trim());
      if (contactForm.position?.trim()) {
        fd.append('position', contactForm.position.trim());
      }
      if (email) {
        fd.append('email', email);
      }
      if (contactForm.phone?.trim()) {
        fd.append('phone', contactForm.phone.trim());
      }
      fd.append('is_primary', contactForm.is_primary ? '1' : '0');
      fd.append('send_password_setup_email', contactForm.send_password_setup_email ? '1' : '0');
      if (!contactForm.send_password_setup_email && contactForm.password?.trim()) {
        fd.append('password', contactForm.password.trim());
      }
      if (contactAvatarFile) {
        fd.append('avatar', contactAvatarFile);
      }
      await createPlatformTenantContact(newTenantId, fd);
      setShowAdd(false);
      resetAddWizard();
      await load();
    } catch (err) {
      let msg = 'Could not create contact.';
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
                  Create the organization first, then add contacts (billing email comes from the primary contact).
                  Tenant role invitations are optional when creating a login-capable contact.
                </h6>
              </div>
            </div>
            <ul className="table-top-head">
              <TooltipIcons />
              <RefreshIcon />
              <CollapesIcon />
            </ul>
            <div className="page-btn">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetAddWizard();
                  setShowAdd(true);
                }}>
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

      <Modal
        show={showAdd}
        onHide={() => {
          setShowAdd(false);
          resetAddWizard();
        }}
        centered
        size="lg">
        <Form onSubmit={addWizardStep === 1 ? submitCreateCompany : submitContactForCompany}>
          <Modal.Header closeButton>
            <Modal.Title>
              {addWizardStep === 1 ? 'Add company — step 1 of 2' : 'Add primary contact — step 2 of 2'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {addWizardStep === 1 ? (
              <div className="row g-3">
                <div className="col-md-12">
                  <Form.Label>Company name *</Form.Label>
                  <Form.Control
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={createForm.company_phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, company_phone: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
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
                <div className="col-12">
                  <p className="text-muted small mb-0">
                    Billing correspondence uses the primary contact&apos;s email once you add contacts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-md-12">
                  <Form.Label>Profile image</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setContactAvatarFile(f ?? null);
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label>First name *</Form.Label>
                  <Form.Control
                    required
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label>Last name *</Form.Label>
                  <Form.Control
                    required
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
                <div className="col-md-12">
                  <Form.Label>Position</Form.Label>
                  <Form.Control
                    value={contactForm.position}
                    onChange={(e) => setContactForm((f) => ({ ...f, position: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="col-md-12">
                  <Form.Check
                    type="checkbox"
                    id="tf-contact-primary"
                    checked={contactForm.is_primary}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, is_primary: e.target.checked }))
                    }
                    label="Primary contact (billing ‘To’ uses this email)"
                  />
                </div>
                <div className="col-md-12">
                  <Form.Check
                    type="checkbox"
                    id="tf-contact-invite"
                    checked={contactForm.send_password_setup_email}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setContactForm((f) => ({
                        ...f,
                        send_password_setup_email: v,
                        ...(v ? { password: '' } : {})
                      }));
                    }}
                    label="Email a link to set their password (invitation)"
                  />
                  <div className="form-text">
                    When checked, TillFlow sends a message to the <strong>email above</strong> with a secure link so
                    they can choose their own password and sign in. The password box below is not used for that path.
                  </div>
                </div>
                <div className="col-md-12">
                  <Form.Label>
                    {contactForm.send_password_setup_email
                      ? 'Password (not used — they set it via the email link)'
                      : `Password (min 8 characters if login, optional if contact-only)`}
                  </Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="new-password"
                    disabled={contactForm.send_password_setup_email}
                    value={contactForm.password}
                    onChange={(e) => setContactForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="gap-2 flex-wrap">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowAdd(false);
                resetAddWizard();
              }}>
              Cancel
            </Button>
            {addWizardStep === 2 ? (
              <Button
                variant="outline-secondary"
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowAdd(false);
                  resetAddWizard();
                }}>
                Skip contact
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : addWizardStep === 1 ? 'Next: add contact' : 'Create contact'}
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
              <div className="col-md-6">
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
            <PlatformTenantDetailView tenant={viewTenant} contacts={viewContacts} />
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
