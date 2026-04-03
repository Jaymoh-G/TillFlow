import { Link, useLocation } from "react-router-dom";
import EditSalesRetuens from "../../core/modals/sales/editsalesretuens";
import AddSalesReturns from "../../core/modals/sales/addsalesreturns";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import DeleteModal from "../../components/delete-modal";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import PrimeDataTable from "../../components/data-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { salesReturnListData } from "../../core/json/salesReturnListData";
import { all_routes } from "../../routes/all_routes";

const ALL = { label: "All", value: "" };

function parseRowDate(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const SalesReturn = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const route = all_routes;

  const [sourceRows] = useState(() => [...salesReturnListData]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
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
      { label: "Received", value: "Received" },
      { label: "Pending", value: "Pending" }
    ],
    []
  );

  const paymentOptions = useMemo(
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
      { label: "Recently added", value: "recent" },
      { label: "Return ref A–Z", value: "refAsc" },
      { label: "Return ref Z–A", value: "refDesc" },
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
          String(r.productName).toLowerCase().includes(q) ||
          String(r.customer).toLowerCase().includes(q) ||
          String(r.returnRef || "").toLowerCase().includes(q)
      );
    }
    if (filterCustomer) {
      list = list.filter((r) => r.customer === filterCustomer);
    }
    if (filterStatus) {
      list = list.filter((r) => r.status === filterStatus);
    }
    if (filterPayment) {
      list = list.filter((r) => r.paymentstatus === filterPayment);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);

    if (sortMode === "lastMonth") {
      list = list.filter((r) => {
        const d = parseRowDate(r.date);
        return d && d >= startOfMonth;
      });
    } else if (sortMode === "last7") {
      list = list.filter((r) => {
        const d = parseRowDate(r.date);
        return d && d >= last7;
      });
    }

    if (sortMode === "refAsc") {
      list.sort((a, b) => String(a.returnRef).localeCompare(String(b.returnRef)));
    } else if (sortMode === "refDesc") {
      list.sort((a, b) => String(b.returnRef).localeCompare(String(a.returnRef)));
    } else {
      list.sort((a, b) => {
        const da = parseRowDate(a.date);
        const db = parseRowDate(b.date);
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
    filterCustomer,
    filterStatus,
    filterPayment,
    sortMode
  ]);

  const totalRecords = displayRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterCustomer, filterStatus, filterPayment, sortMode]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCustomer("");
    setFilterStatus("");
    setFilterPayment("");
    setSortMode("recent");
    setCurrentPage(1);
  }, []);

  const columns = useMemo(
    () => [
      {
        header: "Return #",
        field: "returnRef",
        sortable: true
      },
      {
        header: "Product",
        field: "productName",
        body: (rowData) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.productImg} alt="" />
            </Link>
            <Link to="#">{rowData.productName}</Link>
          </div>
        ),
        sortable: true
      },
      {
        header: "Date",
        field: "date",
        sortable: true
      },
      {
        header: "Customer",
        field: "customer",
        body: (rowData) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.customerImg} alt="" />
            </Link>
            <Link to="#">{rowData.customer}</Link>
          </div>
        ),
        sortable: true
      },
      {
        header: "Status",
        field: "status",
        body: (rowData) => (
          <span
            className={`badge shadow-none ${
              rowData.status === "Pending" ? "badge-cyan" : "badge-success"
            }`}>
            {rowData.status}
          </span>
        ),
        sortable: true
      },
      {
        header: "Total",
        field: "total",
        sortable: true
      },
      {
        header: "Paid",
        field: "paid",
        sortable: true
      },
      {
        header: "Due",
        field: "due",
        sortable: true
      },
      {
        header: "Payment status",
        field: "paymentstatus",
        body: (rowData) => (
          <span
            className={`badge badge-xs shadow-none ${
              rowData.paymentstatus === "Unpaid"
                ? "badge-soft-danger"
                : rowData.paymentstatus === "Paid"
                  ? "badge-soft-success"
                  : "badge-soft-warning"
            }`}>
            <i className="ti ti-point-filled me-1" />
            {rowData.paymentstatus}
          </span>
        ),
        sortable: true
      },
      {
        header: "",
        field: "actions",
        sortable: false,
        body: () => (
          <div className="edit-delete-action d-flex align-items-center justify-content-center">
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#edit-sales-new">
              <i className="feather icon-edit" />
            </Link>
            <Link
              className="p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-modal">
              <i className="feather icon-trash-2" />
            </Link>
          </div>
        )
      }
    ],
    []
  );

  const invoicesPath = inTillflowShell ? "/tillflow/admin/invoices" : route.invoice;

  return (
    <div>
      <div
        className={`page-wrapper sales-return-page${
          inTillflowShell ? " sales-return-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Sales returns</h4>
                <h6>Track product returns and refunds — filter by customer, status, or payment.</h6>
              </div>
            </div>
            <TableTopHead onRefresh={resetFilters} />
            <div className="page-btn d-flex flex-wrap gap-2">
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-sales-new">
                <i className="ti ti-circle-plus me-1" />
                Add sales return
              </Link>
              <Link to={invoicesPath} className="btn btn-outline-secondary">
                <i className="ti ti-file-invoice me-1" />
                Invoices
              </Link>
              {inTillflowShell ? (
                <Link to="/tillflow/admin/online-orders" className="btn btn-outline-secondary">
                  <i className="ti ti-shopping-cart me-1" />
                  Online orders
                </Link>
              ) : (
                <Link to={route.onlineorder} className="btn btn-outline-secondary">
                  <i className="ti ti-shopping-cart me-1" />
                  Online orders
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
                    placeholder="Return status"
                    filter={false}
                  />
                </div>
                <div style={{ minWidth: "11rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={paymentOptions}
                    value={filterPayment === "" ? "" : filterPayment}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterPayment(v == null || v === "" ? "" : String(v));
                    }}
                    placeholder="Payment status"
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
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  selectionMode="checkbox"
                  selection={selectedRows}
                  onSelectionChange={(e) => setSelectedRows(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <AddSalesReturns />
      <EditSalesRetuens />
      <DeleteModal />
    </div>
  );
};

export default SalesReturn;
