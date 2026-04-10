import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Skeleton } from "primereact/skeleton";
import React, { useMemo, useState } from "react";
import CustomPaginator from "./custom-paginator";

function valueByPath(obj, field) {
  if (field == null || obj == null) {
    return undefined;
  }
  const path = String(field);
  if (!path.includes(".")) {
    return obj[path];
  }
  return path.split(".").reduce((o, key) => (o == null ? o : o[key]), obj);
}

function compareByField(a, b, field) {
  const va = valueByPath(a, field);
  const vb = valueByPath(b, field);
  if (va == null && vb == null) {
    return 0;
  }
  if (va == null) {
    return 1;
  }
  if (vb == null) {
    return -1;
  }
  if (typeof va === "number" && typeof vb === "number" && !Number.isNaN(va) && !Number.isNaN(vb)) {
    return va < vb ? -1 : va > vb ? 1 : 0;
  }
  return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
}

const PrimeDataTable = ({
  column,
  data = [],
  totalRecords,
  currentPage = 1,
  setCurrentPage,
  rows = 10,
  setRows,
  sortable = true,
  footer = null,
  loading = false,
  isPaginationEnabled = true,
  selectionMode,
  selection,
  onSelectionChange,
  dataKey = "id"
}) => {
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

  // Unique `id` per placeholder row — PrimeReact uses `dataKey` as the row React key;
  // `Array(n).fill({})` yields the same object and undefined ids, which breaks reconciliation.
  const skeletonRows = Array.from({ length: rows }, (_, i) => ({
    id: `__loading__${i}`
  }));
  const totalPages = Math.ceil(totalRecords / rows);

  const sortedData = useMemo(() => {
    if (sortable === false || loading || !sortField || sortOrder == null || sortOrder === 0) {
      return data;
    }
    const mult = sortOrder === -1 ? -1 : 1;
    const copy = [...data];
    copy.sort((x, y) => compareByField(x, y, sortField) * mult);
    return copy;
  }, [data, sortField, sortOrder, sortable, loading]);

  // Pagination (after full-dataset sort so headers sort all rows, not only the current page)
  const startIndex = (currentPage - 1) * rows;
  const endIndex = startIndex + rows;
  const paginatedData = loading ? skeletonRows : sortedData.slice(startIndex, endIndex);

  const handleSort = (e) => {
    setSortField(e.sortField ?? null);
    setSortOrder(e.sortOrder ?? null);
    setCurrentPage(1);
  };

  const onPageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const customEmptyMessage = () => (
    <div className="no-record-found">
      <h4>No records found.</h4>
      <p>No records to show here...</p>
    </div>
  );

  // Base props
  const getDataTableProps = () => {
    const baseProps = {
      value: paginatedData,
      className: "table custom-table datatable",
      totalRecords: totalRecords,
      paginator: false,
      emptyMessage: customEmptyMessage,
      footer: footer,
      dataKey: dataKey,
      ...(sortable !== false
        ? {
            sortMode: "single",
            removableSort: true,
            onSort: handleSort,
            ...(sortField != null && sortOrder != null && sortOrder !== 0 ? { sortField, sortOrder } : {})
          }
        : {})
    };

    if (selectionMode) {
      return {
        ...baseProps,
        selectionMode,
        selection,
        onSelectionChange
      };
    }

    return baseProps;
  };

  return (
    <>
      <DataTable {...getDataTableProps()}>

        {/* ✅ Auto insert Selection Column */}
        {selectionMode && (
          <Column
            selectionMode={
              selectionMode === "checkbox" || selectionMode === "multiple"
                ? "multiple"
                : "single"
            }
            headerStyle={{ width: "3rem" }}
          />
        )}

        {/* Regular Columns */}
        {column?.map((col, index) => (
          <Column
            header={col.header}
            key={col.field || index}
            field={col.field}
            body={(rowData, options) =>
              loading ? (
                <Skeleton width="100%" height="2rem" className="skeleton-glow" />
              ) : col.body ? (
                col.body(rowData, options)
              ) : (
                rowData[col.field]
              )
            }
            sortable={sortable === false ? false : col.sortable !== false}
            sortField={col.sortField ?? col.field}
            className={col.className ?? ""}
            headerClassName={col.headerClassName ?? ""}
          />
        ))}
      </DataTable>

      {isPaginationEnabled && (
        <CustomPaginator
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          onPageChange={onPageChange}
          rows={rows}
          setRows={setRows}
        />
      )}
    </>
  );
};

export default PrimeDataTable;
