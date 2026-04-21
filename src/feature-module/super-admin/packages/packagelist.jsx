import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import PrimeDataTable from '../../../components/data-table';
import CommonFooter from '../../../components/footer/commonFooter';
import TooltipIcons from '../../../components/tooltip-content/tooltipIcons';
import RefreshIcon from '../../../components/tooltip-content/refresh';
import CollapesIcon from '../../../components/tooltip-content/collapes';
import {
  createPlatformPlan,
  deletePlatformPlan,
  fetchPlatformMeta,
  fetchPlatformPlans,
  updatePlatformPlan,
} from '../../../core/api/platformAdminApi';
import { tillflowFetch } from '../../../tillflow/api/client';
import { TillFlowApiError } from '../../../tillflow/api/errors';

function readToken() {
  return localStorage.getItem('tillflow_sanctum_token');
}

export default function Packages() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [planRows, setPlanRows] = useState([]);
  const [permSlugs, setPermSlugs] = useState([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [editTarget, setEditTarget] = useState(null);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    price_amount: 0,
    currency: 'KES',
    billing_interval: 'month',
    included_stores: 1,
    max_stores: '',
    extra_store_price_amount: '',
    is_active: true,
    unlimited_permissions: false,
    allowed_permission_slugs: [],
  });

  const loadPlans = useCallback(async () => {
    setLoadError('');
    try {
      const data = await fetchPlatformPlans();
      setPlanRows((data.plans || []).map((p) => ({ ...p, id: String(p.id) })));
    } catch (e) {
      setLoadError(e instanceof TillFlowApiError ? e.message : 'Failed to load plans.');
    }
  }, []);

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
          const meta = await fetchPlatformMeta();
          setPermSlugs(meta.permission_slugs || []);
          await loadPlans();
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
  }, [loadPlans]);

  const permOptions = permSlugs.map((s) => ({ value: s, label: s }));

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      price_amount: 0,
      currency: 'KES',
      billing_interval: 'month',
      included_stores: 1,
      max_stores: '',
      extra_store_price_amount: '',
      is_active: true,
      unlimited_permissions: false,
      allowed_permission_slugs: [],
    });
    setEditTarget(null);
    setError('');
  };

  const openAdd = () => {
    resetForm();
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setForm({
      name: row.name || '',
      slug: row.slug || '',
      price_amount: Number(row.price_amount ?? 0),
      currency: row.currency || 'KES',
      billing_interval: row.billing_interval || 'month',
      included_stores: row.included_stores ?? 1,
      max_stores: row.max_stores == null ? '' : String(row.max_stores),
      extra_store_price_amount:
        row.extra_store_price_amount == null ? '' : String(row.extra_store_price_amount),
      is_active: Boolean(row.is_active),
      unlimited_permissions: !row.allowed_permission_slugs,
      allowed_permission_slugs: Array.isArray(row.allowed_permission_slugs) ? row.allowed_permission_slugs : [],
    });
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError('');
    const body = {
      name: form.name,
      slug: form.slug,
      price_amount: Number(form.price_amount),
      currency: form.currency || 'KES',
      billing_interval: form.billing_interval,
      included_stores: Number(form.included_stores || 1),
      is_active: form.is_active,
      allowed_permission_slugs: form.unlimited_permissions ? null : form.allowed_permission_slugs,
      max_stores: form.max_stores === '' || form.max_stores == null ? null : Number(form.max_stores),
      extra_store_price_amount:
        form.extra_store_price_amount === '' || form.extra_store_price_amount == null
          ? null
          : Number(form.extra_store_price_amount),
    };

    try {
      if (editTarget) {
        await updatePlatformPlan(editTarget.id, body);
      } else {
        await createPlatformPlan(body);
      }
      if (window.bootstrap?.Modal) {
        const el = document.getElementById('add_plans');
        const m = window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el);
        m.hide();
      }
      resetForm();
      await loadPlans();
    } catch (err) {
      setError(err instanceof TillFlowApiError ? err.message : 'Save failed.');
    }
  };

  const onDelete = async (row) => {
    if (!window.confirm(`Delete plan "${row.name}"?`)) {
      return;
    }
    try {
      await deletePlatformPlan(row.id);
      await loadPlans();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Delete failed.');
    }
  };

  const totalRecords = planRows.length;
  const activeCount = planRows.filter((r) => r.is_active).length;

  const columns = [
    {
      header: 'Plan Name',
      field: 'name',
      body: (rowData) => (
        <h6 className="fw-medium">
          <button type="button" className="btn btn-link p-0" onClick={() => openEdit(rowData)}>
            {rowData.name}
          </button>
        </h6>
      ),
      sortable: true,
    },
    { header: 'Slug', field: 'slug', sortable: true },
    {
      header: 'Billing',
      field: 'billing_interval',
      body: (rowData) => <span className="text-capitalize">{rowData.billing_interval}</span>,
      sortable: true,
    },
    {
      header: 'Price',
      field: 'price_amount',
      body: (rowData) => (
        <span>
          {rowData.currency} {Number(rowData.price_amount).toFixed(2)}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Subscribers',
      field: 'active_subscriptions_count',
      sortable: true,
    },
    {
      header: 'Status',
      field: 'is_active',
      body: (rowData) => (
        <span
          className={`badge ${
            rowData.is_active ? 'badge-success' : 'badge-danger'
          } d-inline-flex align-items-center badge-xs`}
        >
          <i className="ti ti-point-filled me-1" />
          {rowData.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
      sortable: true,
    },
    {
      header: '',
      field: 'actions',
      body: (rowData) => (
        <div className="action-icon d-inline-flex align-items-center">
          <button
            type="button"
            className="p-2 d-flex align-items-center border rounded me-2 btn btn-light"
            data-bs-toggle="modal"
            data-bs-target="#add_plans"
            onClick={() => openEdit(rowData)}
          >
            <i className="ti ti-edit" />
          </button>
          <button
            type="button"
            className="p-2 d-flex align-items-center border rounded btn btn-light text-danger"
            onClick={() => onDelete(rowData)}
          >
            <i className="ti ti-trash" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ];

  if (booting) {
    return (
      <div className="page-wrapper">
        <div className="content p-4">Loading…</div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/tillflow/login" replace state={{ from: '/tillflow/platform-owner/packages' }} />;
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Packages</h4>
                <h6>Manage your packages</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <TooltipIcons />
              <RefreshIcon />
              <CollapesIcon />
            </ul>
            <div className="page-btn">
              <Link
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#add_plans"
                className="btn btn-primary"
                onClick={openAdd}
              >
                <i className="ti ti-circle-plus me-1" />
                Add Packages
              </Link>
            </div>
          </div>

          {loadError ? <div className="alert alert-danger">{loadError}</div> : null}

          <div className="row">
            <div className="col-lg-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body d-flex align-items-center justify-content-between">
                  <div>
                    <p className="fs-12 fw-medium mb-1 text-truncate">Total Plans</p>
                    <h4>{totalRecords}</h4>
                  </div>
                  <span className="avatar avatar-lg bg-primary flex-shrink-0">
                    <i className="ti ti-box fs-16" />
                  </span>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body d-flex align-items-center justify-content-between">
                  <div>
                    <p className="fs-12 fw-medium mb-1 text-truncate">Active Plans</p>
                    <h4>{activeCount}</h4>
                  </div>
                  <span className="avatar avatar-lg bg-success flex-shrink-0">
                    <i className="ti ti-activity-heartbeat fs-16" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <h5>Plan List</h5>
              <button type="button" className="btn btn-sm btn-light" onClick={() => navigate('/tillflow/platform-owner/subscribers')}>
                View subscriptions
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={planRows}
                  totalRecords={totalRecords}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  rows={rows}
                  setRows={setRows}
                  selectionMode="checkbox"
                  selection={selectedPackages}
                  onSelectionChange={(e) => setSelectedPackages(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add_plans">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{editTarget ? 'Edit Plan' : 'Add New Plan'}</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <form onSubmit={submitForm}>
              <div className="modal-body pb-0">
                {error ? <div className="alert alert-danger">{error}</div> : null}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      Plan Name<span className="text-danger"> *</span>
                    </label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(ev) => setForm((s) => ({ ...s, name: ev.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      Slug<span className="text-danger"> *</span>
                    </label>
                    <input
                      className="form-control"
                      value={form.slug}
                      onChange={(ev) => setForm((s) => ({ ...s, slug: ev.target.value }))}
                      required
                      disabled={Boolean(editTarget)}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.price_amount}
                      onChange={(ev) => setForm((s) => ({ ...s, price_amount: ev.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Currency</label>
                    <input
                      className="form-control"
                      value={form.currency}
                      onChange={(ev) => setForm((s) => ({ ...s, currency: ev.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Billing</label>
                    <select
                      className="form-select"
                      value={form.billing_interval}
                      onChange={(ev) => setForm((s) => ({ ...s, billing_interval: ev.target.value }))}
                    >
                      <option value="month">month</option>
                      <option value="year">year</option>
                    </select>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Included stores</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={form.included_stores}
                      onChange={(ev) => setForm((s) => ({ ...s, included_stores: ev.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Max stores (empty = unlimited cap)</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={form.max_stores}
                      onChange={(ev) => setForm((s) => ({ ...s, max_stores: ev.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Extra store price</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.extra_store_price_amount}
                      onChange={(ev) => setForm((s) => ({ ...s, extra_store_price_amount: ev.target.value }))}
                    />
                  </div>
                  <div className="col-md-12 mb-2 form-check">
                    <input
                      id="unlim"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.unlimited_permissions}
                      onChange={(ev) => setForm((s) => ({ ...s, unlimited_permissions: ev.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="unlim">
                      Enterprise-style (no permission restriction)
                    </label>
                  </div>
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Allowed permission slugs</label>
                    <Select
                      isMulti
                      classNamePrefix="react-select"
                      options={permOptions}
                      value={permOptions.filter((o) => form.allowed_permission_slugs.includes(o.value))}
                      onChange={(opts) =>
                        setForm((s) => ({
                          ...s,
                          allowed_permission_slugs: (opts || []).map((o) => o.value),
                        }))
                      }
                      isDisabled={form.unlimited_permissions}
                      placeholder="Select permissions…"
                    />
                  </div>
                  <div className="col-md-12 mb-3 form-check">
                    <input
                      id="active"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_active}
                      onChange={(ev) => setForm((s) => ({ ...s, is_active: ev.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="active">
                      Active
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
