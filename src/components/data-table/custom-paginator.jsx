import React from "react";

const CustomPaginator = ({
  currentPage,
  totalPages,
  rows,
  totalRecords,
  onPageChange,
  setRows
}) => {
  const handleSelectChange = (value) => {
    setRows(Number(value));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  if (!totalPages) {
    return null;
  }

  const pageNumbers = getPageNumbers();

  return (
    <>
      <div className="parent-class-datatable">
        <div className="dataTables_length" id="DataTables_Table_0_length">
          <label>
            Row Per Page{" "}
            <select
              name="DataTables_Table_0_length"
              aria-controls="DataTables_Table_0"
              className="form-select form-select-sm"
              value={rows}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>{" "}
            Entries
          </label>
        </div>
        <div
          className="dataTables_paginate paging_simple_numbers"
          id="DataTables_Table_0_paginate"
        >
          <ul className="pagination">
            <li className={`paginate_button page-item previous ${currentPage === 1 ? 'disabled' : ''}`}>
              <a
                href="#"
                className="page-link"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) handlePageChange(currentPage - 1);
                }}
              >
                <i className="fa fa-angle-left"></i>
              </a>
            </li>
            {pageNumbers.map((page) => (
              <li
                key={page}
                className={`paginate_button page-item ${currentPage === page ? 'active' : ''}`}
              >
                <a
                  href="#"
                  className="page-link"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(page);
                  }}
                >
                  {page}
                </a>
              </li>
            ))}
            <li className={`paginate_button page-item next ${currentPage === totalPages ? 'disabled' : ''}`}>
              <a
                href="#"
                className="page-link"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) handlePageChange(currentPage + 1);
                }}
              >
                <i className="fa fa-angle-right"></i>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default CustomPaginator;
