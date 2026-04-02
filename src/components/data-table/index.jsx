import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Skeleton } from "primereact/skeleton";
import React from "react";
import CustomPaginator from "./custom-paginator";

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
  // Unique `id` per placeholder row — PrimeReact uses `dataKey` as the row React key;
  // `Array(n).fill({})` yields the same object and undefined ids, which breaks reconciliation.
  const skeletonRows = Array.from({ length: rows }, (_, i) => ({
    id: `__loading__${i}`
  }));
  const totalPages = Math.ceil(totalRecords / rows);

  // Pagination
  const startIndex = (currentPage - 1) * rows;
  const endIndex = startIndex + rows;
  const paginatedData = loading ? skeletonRows : data.slice(startIndex, endIndex);

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
      dataKey: dataKey
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
