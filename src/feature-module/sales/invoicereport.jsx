import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { invoicereportdata } from "../../core/json/invoicereportdata";
import CommonFooter from "../../components/footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import DeleteModal from "../../components/delete-modal";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";

const ALL = { label: "All", value: "" };

function parseRowDate(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const Invoice = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const route = all_routes;
  const [sourceRows] = useState(() => [...invoicereportdata]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortMode, setSortMode] = useState("recent");

  const customerOptions = useMemo(() => {
    const names = [...new Set(sourceRows.map((r) => r.customer))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return [ALL, ...names.map((n) => ({ label: n, value: n }))];
  }, [sourceRows]);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Paid", value: "Paid" },
      { label: "Unpaid", value: "Unpaid" },
      { label: "Overdue", value: "Overdue" }
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: "Recently issued", value: "recent" },
      { label: "Invoice no. A–Z", value: "invAsc" },
      { label: "Invoice no. Z–A", value: "invDesc" },
      { label: "Due — this month", value: "dueThisMonth" },
      { label: "Due — next 60 days", value: "dueSoon" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...sourceRows];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.customer).toLowerCase().includes(q) ||
          String(r.invoiceno).toLowerCase().includes(q)
      );
    }
    if (filterCustomer) {
      list = list.filter((r) => r.customer === filterCustomer);
    }
    if (filterStatus) {
      list = list.filter((r) => r.status === filterStatus);
    }

    const now = new Date();
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);

    if (sortMode === "dueThisMonth") {
      list = list.filter((r) => {
        const d = parseRowDate(r.duedate);
        return (
          d &&
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      });
    } else if (sortMode === "dueSoon") {
      list = list.filter((r) => {
        const d = parseRowDate(r.duedate);
        return d && d >= now && d <= in60;
      });
    }

    if (sortMode === "invAsc") {
      list.sort((a, b) => String(a.invoiceno).localeCompare(String(b.invoiceno)));
    } else if (sortMode === "invDesc") {
      list.sort((a, b) => String(b.invoiceno).localeCompare(String(a.invoiceno)));
    } else if (sortMode === "dueThisMonth" || sortMode === "dueSoon") {
      list.sort((a, b) => {
        const da = parseRowDate(a.duedate);
        const db = parseRowDate(b.duedate);
        if (!da && !db) {
          return 0;
        }
        if (!da) {
          return 1;
        }
        if (!db) {
          return -1;
        }
        return da - db;
      });
    } else {
      list.sort((a, b) => {
        const da = parseRowDate(a.issueDate);
        const db = parseRowDate(b.issueDate);
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
  }, [sourceRows, searchQuery, filterCustomer, filterStatus, sortMode]);

  const totalRecords = displayRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterCustomer, filterStatus, sortMode]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCustomer("");
    setFilterStatus("");
    setSortMode("recent");
    setCurrentPage(1);
  }, []);

  const columns = useMemo(
    () => [
      {
        header: "Invoice No",
        field: "invoiceno",
        body: (rowData) => (
          <Link to="#">{rowData.invoiceno}</Link>
        )
      },
      {
        header: "Issued",
        field: "issueDate"
      },
      {
        header: "Customer",
        field: "customer",
        body: (rowData) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md">
              <img src={rowData.image} alt="" />
            </Link>
            <Link to="#" className="ms-2">
              {rowData.customer}
            </Link>
          </div>
        )
      },
      {
        header: "Due Date",
        field: "duedate"
      },
      {
        header: "Amount",
        field: "amount"
      },
      {
        header: "Paid",
        field: "paid"
      },
      {
        header: "Amount Due",
        field: "amountdue"
      },
      {
        header: "Status",
        field: "status",
        body: (rowData) => (
          <div>
            {rowData.status === "Paid" && (
              <span className="badge badge-soft-success badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
            {rowData.status === "Unpaid" && (
              <span className="badge badge-soft-danger badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
            {rowData.status === "Overdue" && (
              <span className="badge badge-soft-warning badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
          </div>
        )
      },
      {
        header: "",
        field: "action",
        sortable: false,
        body: () => (
          <div className="edit-delete-action d-flex align-items-center justify-content-center">
            <Link
              className="me-2 p-2 d-flex align-items-center justify-content-between border rounded"
              to={route.invoicedetails}>
              <i className="feather icon-eye feather-eye" />
            </Link>
            <Link
              className="p-2 d-flex align-items-center justify-content-between border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-modal">
              <i className="feather icon-trash-2" />
            </Link>
          </div>
        )
      }
    ],
    [route.invoicedetails]
  );

  return (
    <div>
      <div
        className={`page-wrapper invoice-list-page${
          inTillflowShell ? " invoice-list-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Invoices</h4>
                <h6>
                  Track billing and collections — search, filter by customer or status, and open details.
                </h6>
              </div>
            </div>
            <TableTopHead onRefresh={resetFilters} />
            <div className="page-btn d-flex flex-wrap gap-2">
              {inTillflowShell ? (
                <Link to="/tillflow/admin/quotations" className="btn btn-outline-primary">
                  <i className="ti ti-file-description me-1" />
                  Quotations
                </Link>
              ) : (
                <Link to={route.quotationlist} className="btn btn-outline-primary">
                  <i className="ti ti-file-description me-1" />
                  Quotations
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
                <div style={{ minWidth: "12rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={sortOptions}
                    value={sortMode}
                    onChange={(e) =>
                      setSortMode(e.value != null ? String(e.value) : "recent")
                    }
                    placeholder="Sort / scope"
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
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  selectionMode="checkbox"
                  selection={selectedInvoices}
                  onSelectionChange={(e) => setSelectedInvoices(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <DeleteModal />
    </div>
  );
};

export default Invoice;
