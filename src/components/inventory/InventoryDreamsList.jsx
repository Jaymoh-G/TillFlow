import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TableTopHead from '../table-top-head';
import './inventory-dreams-list.scss';

/**
 * Resolve image src from row data (string URL or legacy `{ iconImport }` object).
 */
export function resolveImageSrc(img) {
  if (img == null) {
    return undefined;
  }
  if (typeof img === 'string') {
    return img;
  }
  if (typeof img === 'object') {
    const vals = Object.values(img);
    const first = vals[0];
    if (typeof first === 'string') {
      return first;
    }
  }
  return undefined;
}

function defaultRowSearch(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return Object.values(row).some((v) => {
    if (v == null || typeof v === 'object') {
      return false;
    }
    return String(v).toLowerCase().includes(q);
  });
}

/**
 * @typedef {{ key: string, header: import('react').ReactNode, render?: (row: object) => import('react').ReactNode, className?: string }} InventoryColumn
 */

/**
 * DreamsPOS / template-aligned list: checkbox column, search, rows-per-page, feather actions, footer pagination.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {{ label: string, modalTarget: string } | null} [props.addButton]
 * @param {object[]} props.data
 * @param {(row: object) => string|number} [props.getRowId]
 * @param {InventoryColumn[]} props.columns
 * @param {(row: object, query: string) => boolean} [props.filterRow]
 * @param {import('react').ReactNode} [props.renderPageHeader] — full page-header row (title + tools). Overrides title/subtitle/addButton/TableTopHead.
 * @param {import('react').ReactNode} [props.beforeCard] — e.g. low-stock tabs
 * @param {import('react').ReactNode} [props.cardHeaderEnd] — extra dropdowns on the right of card header
 * @param {boolean} [props.hideCardHeaderDropdowns]
 * @param {string} [props.tableWrapperClass]
 * @param {string} [props.editModalTarget]
 * @param {boolean} [props.showActionButtons]
 */
export default function InventoryDreamsList({
  title,
  subtitle,
  addButton = null,
  data = [],
  getRowId = (row) => row.id,
  columns,
  filterRow,
  renderPageHeader = null,
  beforeCard = null,
  cardHeaderEnd = null,
  hideCardHeaderDropdowns = false,
  tableWrapperClass = '',
  editModalTarget = '#edit-customer',
  showActionButtons = true,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const filtered = useMemo(() => {
    const pred = filterRow ?? defaultRowSearch;
    return data.filter((row) => pred(row, searchQuery));
  }, [data, searchQuery, filterRow]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage) || 1);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = filtered.slice(startIdx, startIdx + rowsPerPage);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + pageRows.length, filtered.length);

  const allPageSelected = pageRows.length > 0 && pageRows.every((p) => selectedIds.has(getRowId(p)));

  function toggleSelectAllOnPage() {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((p) => next.delete(getRowId(p)));
    } else {
      pageRows.forEach((p) => next.add(getRowId(p)));
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

  const colCount = 1 + columns.length + (showActionButtons ? 1 : 0);

  const defaultCardDropdowns = (
    <>
      <div className="dropdown me-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          Status
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Active</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Inactive</span>
          </li>
        </ul>
      </div>
      <div className="dropdown">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
        >
          Sort By : Last 7 Days
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Recently Added</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Ascending</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Descending</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Last Month</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Last 7 Days</span>
          </li>
        </ul>
      </div>
    </>
  );

  return (
    <div className="inventory-dreams-list">
      {renderPageHeader ? (
        <div className="page-header">{renderPageHeader}</div>
      ) : (
        <div className="page-header">
          <div className="add-item d-flex">
            <div className="page-title">
              <h4 className="fw-bold">{title}</h4>
              {subtitle ? <h6>{subtitle}</h6> : null}
            </div>
          </div>
          <TableTopHead />
          {addButton ? (
            <div className="page-btn">
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target={addButton.modalTarget}
              >
                <i className="feather icon-plus-circle me-1" />
                {addButton.label}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {beforeCard}

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
                      aria-label="Search"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted mb-0">Rows</label>
              <select
                className="form-select form-select-sm"
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
            {!hideCardHeaderDropdowns ? defaultCardDropdowns : null}
            {cardHeaderEnd}
          </div>
        </div>

        <div className="card-body p-0">
          <div className={`table-responsive ${tableWrapperClass}`.trim()}>
            <table className="table datatable table-nowrap">
              <thead>
                <tr>
                  <th className="no-sort">
                    <label className="checkboxs mb-0">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} />
                      <span className="checkmarks" />
                    </label>
                  </th>
                  {columns.map((col) => (
                    <th key={col.key} className={col.headerClassName || ''}>
                      {col.header}
                    </th>
                  ))}
                  {showActionButtons ? <th className="no-sort" /> : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="text-center py-5 text-muted">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const rid = getRowId(row);
                    return (
                      <tr key={rid}>
                        <td>
                          <label className="checkboxs mb-0">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(rid)}
                              onChange={() => toggleRow(rid)}
                            />
                            <span className="checkmarks" />
                          </label>
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className={col.className || ''}>
                            {col.render ? col.render(row) : (row[col.key] ?? '—')}
                          </td>
                        ))}
                        {showActionButtons ? (
                          <td>
                            <div className="edit-delete-action d-flex align-items-center">
                              <Link
                                className="me-2 p-2 d-flex align-items-center border rounded bg-transparent"
                                to="#"
                                data-bs-toggle="modal"
                                data-bs-target={editModalTarget}
                                title="Edit"
                              >
                                <i className="feather icon-edit" />
                              </Link>
                              <Link
                                className="p-2 d-flex align-items-center border rounded bg-transparent"
                                to="#"
                                data-bs-toggle="modal"
                                data-bs-target="#delete-modal"
                                title="Delete"
                              >
                                <i className="feather icon-trash-2" />
                              </Link>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 ? (
            <div className="pagination-block px-3 pb-3">
              <div>
                Showing {showingFrom} to {showingTo} of {filtered.length} entries
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((x) => Math.max(1, x - 1))}
                >
                  Previous
                </button>
                <span className="text-muted small">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((x) => Math.min(totalPages, x + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
