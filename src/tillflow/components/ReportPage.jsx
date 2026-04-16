import { useMemo, useState } from 'react';
import PrimeDataTable from '../../components/data-table';

/**
 * Shared TillFlow report shell: title, optional filter slot, error, table, CSV export.
 */
export default function ReportPage({
  title,
  lead,
  filterSlot,
  extraSlot,
  loading,
  error,
  columns,
  rows,
  onExportCsv,
  exportDisabled,
  children,
  tableDataKey = 'id'
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const withIds = useMemo(
    () =>
      (rows ?? []).map((r, i) => ({
        ...r,
        [tableDataKey]: r[tableDataKey] ?? `__r${i}`
      })),
    [rows, tableDataKey]
  );

  return (
    <div className="tf-report">
      <h2 className="tf-page-title">{title}</h2>
      {lead ? <p className="tf-page-lead">{lead}</p> : null}
      {filterSlot ? <div className="tf-report__filters">{filterSlot}</div> : null}
      {extraSlot ? <div className="tf-report__extra">{extraSlot}</div> : null}
      {error ? <div className="tf-alert tf-alert--error">{error}</div> : null}
      {loading ? (
        <p className="tf-muted">Loading…</p>
      ) : (
        <>
          {children
            ? (
                children
              )
            : (
                <PrimeDataTable
                  column={columns}
                  data={withIds}
                  rows={pageSize}
                  setRows={setPageSize}
                  totalRecords={withIds.length}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  loading={false}
                  dataKey={tableDataKey}
                />
              )}
        </>
      )}
      {onExportCsv ? (
        <div className="tf-report__actions">
          <button
            type="button"
            className="tf-btn tf-btn--secondary"
            disabled={exportDisabled || loading || !(rows && rows.length)}
            onClick={onExportCsv}>
            Export CSV
          </button>
        </div>
      ) : null}
    </div>
  );
}
