import { Link } from 'react-router-dom';

/**
 * Map API tenant payload to Companies table row shape (aligned with demo template fields).
 *
 * @param {object} t
 */
export function mapPlatformTenantToRow(t) {
  const planLabel = t.current_plan ? `${t.current_plan.name}` : '—';
  const created = t.created_at ? formatShortDate(t.created_at) : '—';
  const statusLabel = t.status === 'suspended' ? 'Inactive' : 'Active';

  return {
    id: t.id,
    CompanyName: t.name,
    Email: t.company_email || '—',
    AccountURL: t.slug || '—',
    Plan: planLabel,
    CreatedDate: created,
    Image: 'company-01.svg',
    Status: statusLabel,
    _raw: t
  };
}

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * @param {{ onView?: (row) => void; onEdit?: (row) => void; onDelete?: (row) => void }} handlers
 */
export function getPlatformCompaniesColumns(handlers = {}) {
  const { onView, onEdit, onDelete } = handlers;

  return [
    {
      header: 'Company Name',
      field: 'CompanyName',
      body: (rowData) => (
        <div className="d-flex align-items-center file-name-icon">
          <span className="avatar avatar-md border rounded-circle d-flex align-items-center justify-content-center bg-light">
            <i className="ti ti-building text-secondary" aria-hidden />
          </span>
          <div className="ms-2">
            <h6 className="fw-medium mb-0">{rowData.CompanyName}</h6>
          </div>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Email',
      field: 'Email',
      sortable: true
    },
    {
      header: 'Slug',
      field: 'AccountURL',
      sortable: true
    },
    {
      header: 'Plan',
      field: 'Plan',
      sortable: true
    },
    {
      header: 'Created Date',
      field: 'CreatedDate',
      sortable: true
    },
    {
      header: 'Status',
      field: 'Status',
      body: (rowData) => (
        <span
          className={`badge ${
            rowData.Status === 'Active' ? 'badge-success' : 'badge-danger'
          } d-inline-flex align-items-center badge-xs`}>
          <i className="ti ti-point-filled me-1" />
          {rowData.Status}
        </span>
      ),
      sortable: true
    },
    {
      header: '',
      field: 'actions',
      body: (rowData) => (
        <div className="action-icon d-inline-flex align-items-center">
          {onView ? (
            <button
              type="button"
              className="p-2 d-flex align-items-center border rounded me-2 btn btn-light"
              onClick={() => onView(rowData)}
              title="View">
              <i className="ti ti-eye" />
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              className="p-2 d-flex align-items-center border rounded me-2 btn btn-light"
              onClick={() => onEdit(rowData)}
              title="Edit">
              <i className="ti ti-edit" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="p-2 d-flex align-items-center border rounded btn btn-light"
              onClick={() => onDelete(rowData)}
              title="Suspend / activate">
              <i className="ti ti-ban" />
            </button>
          ) : null}
        </div>
      ),
      sortable: false
    }
  ];
}

export function getCompaniesDemoColumns() {
  return [
    {
      header: 'Company Name',
      field: 'CompanyName',
      body: (rowData) => (
        <div className="d-flex align-items-center file-name-icon">
          <Link to="#" className="avatar avatar-md border rounded-circle">
            <img src={`src/assets/img/company/${rowData.Image}`} className="img-fluid" alt="" />
          </Link>
          <div className="ms-2">
            <h6 className="fw-medium">
              <Link to="#">{rowData.CompanyName}</Link>
            </h6>
          </div>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Email',
      field: 'Email',
      sortable: true
    },
    {
      header: 'Account URL',
      field: 'AccountURL',
      sortable: true
    },
    {
      header: 'Plan',
      field: 'Plan',
      body: (rowData) => (
        <div className="d-flex align-items-center justify-content-between">
          <p className="mb-0 me-2">{rowData.Plan}</p>
          <Link
            to="#"
            data-bs-toggle="modal"
            className="badge badge-purple badge-xs"
            data-bs-target="#upgrade_info">
            Upgrade
          </Link>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Created Date',
      field: 'CreatedDate',
      sortable: true
    },
    {
      header: 'Status',
      field: 'Status',
      body: (rowData) => (
        <span
          className={`badge ${
            rowData.Status === 'Active' ? 'badge-success' : 'badge-danger'
          } d-inline-flex align-items-center badge-xs`}>
          <i className="ti ti-point-filled me-1" />
          {rowData.Status}
        </span>
      ),
      sortable: true
    },
    {
      header: '',
      field: 'actions',
      body: () => (
        <div className="action-icon d-inline-flex align-items-center">
          <Link
            to="#"
            className="p-2 d-flex align-items-center border rounded me-2"
            data-bs-toggle="modal"
            data-bs-target="#company_detail">
            <i className="ti ti-eye" />
          </Link>
          <Link
            to="#"
            className="p-2 d-flex align-items-center border rounded me-2"
            data-bs-toggle="modal"
            data-bs-target="#edit_company">
            <i className="ti ti-edit" />
          </Link>
          <Link
            to="#"
            className="p-2 d-flex align-items-center border rounded"
            data-bs-toggle="modal"
            data-bs-target="#delete_modal">
            <i className="ti ti-trash" />
          </Link>
        </div>
      ),
      sortable: false
    }
  ];
}
