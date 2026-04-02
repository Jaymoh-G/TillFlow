import { Link } from "react-router-dom";
import EditQuotation from "../../core/modals/sales/editquotation.jsx";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import DeleteModal from "../../components/delete-modal";
import SearchFromApi from "../../components/data-table/search";
import { useState } from "react";
import PrimeDataTable from "../../components/data-table";
import AddQuotation from "../../core/modals/sales/addquotation.jsx";
import { quotationlistdata } from "../../core/json/quotationlistdata";

const QuotationList = () => {
  const dataSource = quotationlistdata;
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(dataSource.length);
  const [_searchQuery, setSearchQuery] = useState(undefined);
  const [selectedQuotations, setSelectedQuotations] = useState([]);
  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  const columns = [
  {
    header: "Product Name",
    field: "Product_Name",
    body: (rowData) =>
    <>
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={`src/assets/img/products/${rowData.Product_image}`} alt="product" />
            </Link>
            <Link to="#">{rowData.Product_Name}</Link>
          </div>
        </>,

    sortable: true
  },
  {
    header: "Customer",
    field: "Custmer_Name",
    body: (rowData) =>
    <>
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={`src/assets/img/users/${rowData.Custmer_Image}`} alt="product" />
            </Link>
            <Link to="#">{rowData.Custmer_Name}</Link>
          </div>
        </>,

    sortable: true
  },
  {
    header: "Status",
    field: "Status",
    body: (rowData) =>
    <div>
          <span
        className={`badge  ${rowData.Status === "Sent" ? "badge-success" : rowData.Status === "Ordered" ? "badge-warning" : "badge-cyan"}`}>
        
            {rowData.Status}
          </span>
        </div>,

    sortable: true
  },
  {
    header: "Actions",
    field: "actions",
    key: "actions",
    body: () =>
    <div className="action-table-data">
          <div className="edit-delete-action">
            <Link className="me-2 p-2" to="#">
              <i className="feather icon-eye feather-view" />
            </Link>
            <Link
          className="me-2 p-2"
          to="#"
          data-bs-toggle="modal"
          data-bs-target="#edit-units">
          
              <i className="edit feather-edit"></i>
            </Link>
            <Link
          className="confirm-text p-2"
          to="#"
          data-bs-toggle="modal"
          data-bs-target="#delete-modal">
          
              <i className="trash-2 feather icon-trash-2"></i>
            </Link>
          </div>
        </div>,

    sortable: false
  }];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Quotation List</h4>
                <h6>Manage Your Quotation</h6>
              </div>
            </div>
            <TableTopHead />
            <div className="page-btn">
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-units">
                
                <i className="ti ti-circle-plus me-1"></i>
                Add Quotation
              </Link>
            </div>
          </div>
          {/* /product list */}
          <div className="card table-list-card ">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={handleSearch}
                rows={rows}
                setRows={setRows} />
              
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Product
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Lenovo IdeaPad 3
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Beats Pro
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Nike Jordan
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Apple Series 5 Watch
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Customer
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Carl Evans
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Minerva Rameriz
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Robert Lamon
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Patricia Lewis
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Status
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Sent
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Pending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ordered
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Sort By : Last 7 Days
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Desending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last Month
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last 7 Days
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className=" table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={dataSource}
                  totalRecords={totalRecords}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  rows={rows}
                  setRows={setRows}
                  selectionMode="checkbox"
                  selection={selectedQuotations}
                  onSelectionChange={(e) => setSelectedQuotations(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
          {/* /product list */}
        </div>
        <CommonFooter />
      </div>

      <AddQuotation />
      <EditQuotation />
      <DeleteModal />
    </div>);

};

export default QuotationList;