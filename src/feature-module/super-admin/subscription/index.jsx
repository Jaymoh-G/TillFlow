import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PrimeDataTable from '../../../components/data-table';
import CommonFooter from '../../../components/footer/commonFooter';
import TooltipIcons from '../../../components/tooltip-content/tooltipIcons';
import RefreshIcon from '../../../components/tooltip-content/refresh';
import CollapesIcon from '../../../components/tooltip-content/collapes';
import CommonDateRangePicker from '../../../components/date-range-picker/common-date-range-picker';
import { fetchPlatformDashboard, fetchPlatformSubscriptions } from '../../../core/api/platformAdminApi';
import { tillflowFetch } from '../../../tillflow/api/client';
import { TillFlowApiError } from '../../../tillflow/api/errors';

function readToken() {
  return localStorage.getItem('tillflow_sanctum_token');
}

export default function Subscription() {
  const [booting, setBooting] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState([]);
  const [dash, setDash] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageRows, setPageRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState([]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const q = {};
      if (dateFrom) {
        q.date_from = dateFrom;
      }
      if (dateTo) {
        q.date_to = dateTo;
      }
      const [subData, dashData] = await Promise.all([
        fetchPlatformSubscriptions(q),
        fetchPlatformDashboard(),
      ]);
      setRows((subData.subscriptions || []).map((r) => ({ ...r, id: String(r.id) })));
      setDash(dashData);
    } catch (e) {
      setLoadError(e instanceof TillFlowApiError ? e.message : 'Failed to load subscriptions.');
    }
  }, [dateFrom, dateTo]);

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
          await load();
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
  }, [load]);

  const totalRecords = rows.length;

  const columns = [
    {
      header: 'Tenant',
      field: 'tenant_name',
      body: (rowData) => <h6 className="fw-medium mb-0">{rowData.tenant_name || '—'}</h6>,
      sortable: true,
    },
    {
      header: 'Plan',
      field: 'plan_name',
      sortable: true,
    },
    {
      header: 'Billing',
      field: 'billing_interval',
      body: (rowData) => (
        <span>
          {rowData.billing_interval ? `${rowData.billing_interval}` : '—'}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Amount',
      field: 'amount',
      body: (rowData) => (
        <span>
          {rowData.currency || ''}{' '}
          {rowData.amount != null ? Number(rowData.amount).toFixed(2) : '—'}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Starts',
      field: 'starts_at',
      sortable: true,
    },
    {
      header: 'Ends',
      field: 'ends_at',
      body: (rowData) => <span>{rowData.ends_at || '—'}</span>,
      sortable: true,
    },
    {
      header: 'Status',
      field: 'status',
      body: (rowData) => (
        <span
          className={`badge ${
            rowData.status === 'active' ? 'badge-success' : 'badge-danger'
          } d-inline-flex align-items-center badge-xs`}
        >
          <i className="ti ti-point-filled me-1" />
          {rowData.status}
        </span>
      ),
      sortable: true,
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
    return <Navigate to="/tillflow/login" replace state={{ from: '/platform-owner/subscription' }} />;
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Subscriptions</h4>
                <h6>Manage your subscriptions</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <TooltipIcons />
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>

          {loadError ? <div className="alert alert-danger">{loadError}</div> : null}

          <div className="row align-items-end mb-3">
            <div className="col-md-auto">
              <CommonDateRangePicker />
            </div>
            <div className="col-md-2">
              <label className="form-label fs-12">From</label>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label fs-12">To</label>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-primary mt-4" onClick={() => load()}>
                Apply
              </button>
            </div>
            <div className="col text-end">
              <Link to="/platform-owner/packages" className="btn btn-outline-primary">
                Plans / packages
              </Link>
            </div>
          </div>

          <div className="row">
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <span className="fs-14 fw-normal text-truncate mb-1 d-block">Total tenants</span>
                  <h5>{dash?.tenant_total ?? '—'}</h5>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <span className="fs-14 fw-normal text-truncate mb-1 d-block">Active subscriptions</span>
                  <h5>{dash?.active_subscriptions ?? '—'}</h5>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <span className="fs-14 fw-normal text-truncate mb-1 d-block">Tenants active (7d)</span>
                  <h5>{dash?.tenants_active_last_7_days ?? '—'}</h5>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-body">
                  <span className="fs-14 fw-normal text-truncate mb-1 d-block">Approx. MRR (month plans)</span>
                  <h5>{dash?.mrr_approx_monthly_kes != null ? `KES ${dash.mrr_approx_monthly_kes}` : '—'}</h5>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h5>Subscription List</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={rows}
                  totalRecords={totalRecords}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  rows={pageRows}
                  setRows={setPageRows}
                  selectionMode="checkbox"
                  selection={selectedSubscriptions}
                  onSelectionChange={(e) => setSelectedSubscriptions(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
    </>
  );
}
