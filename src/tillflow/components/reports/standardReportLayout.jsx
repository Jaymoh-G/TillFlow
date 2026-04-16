import { Tooltip } from 'primereact/tooltip';
import { excel, pdf } from '../../../utils/imagepath';

const VARIANT_CLASS = {
  info: { card: 'border-info', icon: 'bg-info' },
  success: { card: 'border-success', icon: 'bg-success' },
  orange: { card: 'border-orange', icon: 'bg-orange' },
  danger: { card: 'border-danger', icon: 'bg-danger' }
};

const DEFAULT_ICONS = {
  info: 'ti ti-align-box-bottom-left-filled fs-24',
  success: 'ti ti-align-box-bottom-left-filled fs-24',
  orange: 'ti ti-moneybag fs-24',
  danger: 'ti ti-alert-circle-filled fs-24'
};

/**
 * Root wrapper for TillFlow “standard” themed reports (invoice, POS sales, …).
 */
export function StandardReportShell({ children, className = '' }) {
  return <div className={`tf-standard-report ${className}`.trim()}>{children}</div>;
}

export function StandardReportTooltipBridge() {
  return <Tooltip target=".pr-tooltip" />;
}

/**
 * @param {{ title: string, subtitle: string, onRefresh: () => void }} props
 */
export function StandardReportPageHeader({ title, subtitle, onRefresh }) {
  return (
    <div className="page-header">
      <div className="add-item d-flex">
        <div className="page-title">
          <h4>{title}</h4>
          <h6>{subtitle}</h6>
        </div>
      </div>
      <ul className="table-top-head">
        <li>
          <button
            type="button"
            className="btn btn-icon border-0 bg-transparent p-0"
            title="Refresh"
            onClick={() => onRefresh()}>
            <i className="ti ti-refresh" />
          </button>
        </li>
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   items: Array<{
 *     key: string,
 *     label: string,
 *     value: import('react').ReactNode,
 *     variant: 'info' | 'success' | 'orange' | 'danger',
 *     iconClassName?: string,
 *     valueClassName?: string
 *   }>
 * }} props
 */
export function StandardReportKpiRow({ items }) {
  return (
    <div className="row">
      {items.map((item) => {
        const v = VARIANT_CLASS[item.variant] ?? VARIANT_CLASS.info;
        const iconCls = item.iconClassName ?? DEFAULT_ICONS[item.variant] ?? DEFAULT_ICONS.info;

        return (
          <div key={item.key} className="col-xl-3 col-sm-6 col-12 d-flex">
            <div className={`card border ${v.card} sale-widget flex-fill`}>
              <div className="card-body d-flex align-items-center">
                <span className={`sale-icon ${v.icon} text-white`}>
                  <i className={iconCls} />
                </span>
                <div className="ms-2">
                  <p className="fw-medium mb-1">{item.label}</p>
                  <div>
                    <h3 className={item.valueClassName ?? undefined}>{item.value}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StandardReportFilterCard({ children }) {
  return (
    <div className="card border-0">
      <div className="card-body pb-1">{children}</div>
    </div>
  );
}

/**
 * Table card with PDF / Excel icon exports (same as invoice list toolbar).
 *
 * @param {{
 *   tableTitle: string,
 *   exportDisabled: boolean,
 *   onExportPdf: () => void,
 *   onExportCsv: () => void,
 *   error?: string,
 *   loading: boolean,
 *   children: import('react').ReactNode
 * }} props
 */
export function StandardReportDataTableCard({
  tableTitle,
  exportDisabled,
  onExportPdf,
  onExportCsv,
  error,
  loading,
  children
}) {
  return (
    <div className="card table-list-card no-search">
      <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
        <div>
          <h4>{tableTitle}</h4>
        </div>
        <ul className="table-top-head">
          <li>
            <button
              type="button"
              className="pr-tooltip border-0 bg-transparent p-0"
              data-pr-tooltip="Pdf"
              data-pr-position="top"
              aria-label="Export PDF"
              disabled={exportDisabled}
              title={exportDisabled ? 'Export PDF (no data)' : 'Export PDF'}
              onClick={() => onExportPdf()}>
              <img src={pdf} alt="" style={{ opacity: exportDisabled ? 0.45 : 1 }} />
            </button>
          </li>
          <li>
            <button
              type="button"
              className="pr-tooltip border-0 bg-transparent p-0"
              data-pr-tooltip="Excel"
              data-pr-position="top"
              aria-label="Export CSV"
              disabled={exportDisabled}
              title={exportDisabled ? 'Export CSV (no data)' : 'Export CSV'}
              onClick={onExportCsv}>
              <img src={excel} alt="" style={{ opacity: exportDisabled ? 0.45 : 1 }} />
            </button>
          </li>
        </ul>
      </div>
      <div className="card-body p-0">
        {error ? <div className="alert alert-danger m-3 mb-0">{error}</div> : null}
        {loading ? <p className="text-muted px-3 py-2">Loading…</p> : children}
      </div>
    </div>
  );
}
