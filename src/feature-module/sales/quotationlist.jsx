import { Link, useLocation } from "react-router-dom";
import EditQuotation from "../../core/modals/sales/editquotation.jsx";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import DeleteModal from "../../components/delete-modal";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimeDataTable from "../../components/data-table";
import AddQuotation from "../../core/modals/sales/addquotation.jsx";
import { quotationlistdata } from "../../core/json/quotationlistdata";
import { all_routes } from "../../routes/all_routes";

const ALL = { label: "All", value: "" };

function parseRowDate(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const QuotationList = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const [sourceRows] = useState(() => [...quotationlistdata]);
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedQuotations, setSelectedQuotations] = useState([]);

  const productOptions = useMemo(() => {
    const names = [...new Set(sourceRows.map((r) => r.Product_Name))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return [ALL, ...names.map((n) => ({ label: n, value: n }))];
  }, [sourceRows]);

  const customerOptions = useMemo(() => {
    const names = [...new Set(sourceRows.map((r) => r.Custmer_Name))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return [ALL, ...names.map((n) => ({ label: n, value: n }))];
  }, [sourceRows]);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Sent", value: "Sent" },
      { label: "Pending", value: "Pending" },
      { label: "Ordered", value: "Ordered" }
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: "Recently quoted", value: "recent" },
      { label: "Quote ref A–Z", value: "refAsc" },
      { label: "Quote ref Z–A", value: "refDesc" },
      { label: "Last month", value: "lastMonth" },
      { label: "Last 7 days", value: "last7" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...sourceRows];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.Product_Name).toLowerCase().includes(q) ||
          String(r.Custmer_Name).toLowerCase().includes(q) ||
          String(r.quoteRef || "").toLowerCase().includes(q) ||
          String(r.Status).toLowerCase().includes(q)
      );
    }
    if (filterProduct) {
      list = list.filter((r) => r.Product_Name === filterProduct);
    }
    if (filterCustomer) {
      list = list.filter((r) => r.Custmer_Name === filterCustomer);
    }
    if (filterStatus) {
      list = list.filter((r) => r.Status === filterStatus);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);

    if (sortMode === "lastMonth") {
      list = list.filter((r) => {
        const d = parseRowDate(r.quotedDate);
        return d && d >= startOfMonth;
      });
    } else if (sortMode === "last7") {
      list = list.filter((r) => {
        const d = parseRowDate(r.quotedDate);
        return d && d >= last7;
      });
    }

    if (sortMode === "refAsc") {
      list.sort((a, b) =>
        String(a.quoteRef || "").localeCompare(String(b.quoteRef || ""))
      );
    } else if (sortMode === "refDesc") {
      list.sort((a, b) =>
        String(b.quoteRef || "").localeCompare(String(a.quoteRef || ""))
      );
    } else {
      list.sort((a, b) => {
        const da = parseRowDate(a.quotedDate);
        const db = parseRowDate(b.quotedDate);
        if (!da && !db) {
          return 0;
        }
        if (!da) {
          return 1;
        }
        if (!db) {
          return -1;
        }
        return db - da;
      });
    }

    return list;
  }, [
    sourceRows,
    searchQuery,
    filterProduct,
    filterCustomer,
    filterStatus,
    sortMode
  ]);

  const totalRecords = displayRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterProduct, filterCustomer, filterStatus, sortMode]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterProduct("");
    setFilterCustomer("");
    setFilterStatus("");
    setSortMode("recent");
    setCurrentPage(1);
  }, []);

  const columns = useMemo(
    () => [
      {
        header: "Quote #",
        field: "quoteRef",
        sortable: true
      },
      {
        header: "Date",
        field: "quotedDate",
        sortable: true
      },
      {
        header: "Product Name",
        field: "Product_Name",
        body: (rowData) => (
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.productImg} alt="" />
            </Link>
            <Link to="#">{rowData.Product_Name}</Link>
          </div>
        ),
        sortable: true
      },
      {
        header: "Customer",
        field: "Custmer_Name",
        body: (rowData) => (
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.customerImg} alt="" />
            </Link>
            <Link to="#">{rowData.Custmer_Name}</Link>
          </div>
        ),
        sortable: true
      },
      {
        header: "Total",
        field: "Total",
        sortable: true
      },
      {
        header: "Status",
        field: "Status",
        body: (rowData) => (
          <span
            className={`badge ${
              rowData.Status === "Sent"
                ? "badge-success"
                : rowData.Status === "Ordered"
                  ? "badge-warning"
                  : "badge-cyan"
            }`}>
            {rowData.Status}
          </span>
        ),
        sortable: true
      },
      {
        header: "Actions",
        field: "actions",
        sortable: false,
        body: () => (
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
                <i className="edit feather-edit" />
              </Link>
              <Link
                className="confirm-text p-2"
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#delete-modal">
                <i className="trash-2 feather icon-trash-2" />
              </Link>
            </div>
          </div>
        )
      }
    ],
    []
  );

  return (
    <div>
      <div
        className={`page-wrapper quotation-list-page${
          inTillflowShell ? " quotation-list-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Quotations</h4>
                <h6>Create, track, and convert quotes — filter by product, customer, or status.</h6>
              </div>
            </div>
            <TableTopHead onRefresh={resetFilters} />
            <div className="page-btn d-flex flex-wrap gap-2">
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-units">
                <i className="ti ti-circle-plus me-1" />
                Add quotation
              </Link>
              {inTillflowShell ? (
                <Link to="/tillflow/admin/invoices" className="btn btn-outline-primary">
                  <i className="ti ti-file-invoice me-1" />
                  Invoices
                </Link>
              ) : (
                <Link to={all_routes.invoice} className="btn btn-outline-primary">
                  <i className="ti ti-file-invoice me-1" />
                  Invoices
                </Link>
              )}
            </div>
          </div>
          <div className="card table-list-card manage-stock">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={(v) => setSearchQuery(v ?? "")}
                rows={rows}
                setRows={setRows}
              />
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3 gap-2">
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={productOptions}
                    value={filterProduct === "" ? "" : filterProduct}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterProduct(v == null || v === "" ? "" : String(v));
                    }}
                    placeholder="Product"
                    filter
                  />
                </div>
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={customerOptions}
                    value={filterCustomer === "" ? "" : filterCustomer}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterCustomer(v == null || v === "" ? "" : String(v));
                    }}
                    placeholder="Customer"
                    filter
                  />
                </div>
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={statusOptions}
                    value={filterStatus === "" ? "" : filterStatus}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterStatus(v == null || v === "" ? "" : String(v));
                    }}
                    placeholder="Status"
                    filter={false}
                  />
                </div>
                <div style={{ minWidth: "11rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={sortOptions}
                    value={sortMode}
                    onChange={(e) =>
                      setSortMode(e.value != null ? String(e.value) : "recent")
                    }
                    placeholder="Sort"
                    filter={false}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="custom-datatable-filter table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={displayRows}
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
        </div>
        <CommonFooter />
      </div>

      <AddQuotation />
      <EditQuotation />
      <DeleteModal />
    </div>
  );
};

export default QuotationList;
