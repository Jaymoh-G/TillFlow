import PrimeDataTable from "../../../components/data-table";
import { posOrderData } from "../../../core/json/posOrderData";
import { Link, useLocation } from "react-router-dom";
import OnlineorderModal from "../online-order/onlineorderModal";
import CommonFooter from "../../../components/footer/commonFooter";
import TableTopHead from "../../../components/table-top-head";
import DeleteModal from "../../../components/delete-modal";
import SearchFromApi from "../../../components/data-table/search";
import CommonSelect from "../../../components/select/common-select";
import { useCallback, useEffect, useMemo, useState } from "react";
import { all_routes } from "../../../routes/all_routes";

const ALL = { label: "All", value: "" };

function parseRowDate(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PosOrder = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const [sourceRows] = useState(() => [...posOrderData]);
  const [selectedOrders, setSelectedOrders] = useState([]);
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
      { label: "Completed", value: "Completed" },
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
      { label: "Reference A–Z", value: "refAsc" },
      { label: "Reference Z–A", value: "refDesc" },
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
          String(r.customer).toLowerCase().includes(q) ||
          String(r.reference).toLowerCase().includes(q) ||
          String(r.biller).toLowerCase().includes(q) ||
          String(r.terminal).toLowerCase().includes(q)
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
      list.sort((a, b) => String(a.reference).localeCompare(String(b.reference)));
    } else if (sortMode === "refDesc") {
      list.sort((a, b) => String(b.reference).localeCompare(String(a.reference)));
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
        header: "Customer Name",
        field: "customer",
        body: (rowData) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.image} alt="" />
            </Link>
            <Link to="#">{rowData.customer}</Link>
          </div>
        )
      },
      {
        header: "Reference",
        field: "reference"
      },
      {
        header: "Register",
        field: "terminal"
      },
      {
        header: "Date",
        field: "date"
      },
      {
        header: "Status",
        field: "status",
        body: (rowData) => (
          <span
            className={`badge ${
              rowData.status === "Pending"
                ? "badge-cyan"
                : rowData.status === "Completed"
                  ? "badge-success"
                  : ""
            }`}>
            {rowData.status}
          </span>
        )
      },
      {
        header: "Grand Total",
        field: "total"
      },
      {
        header: "Paid",
        field: "paid"
      },
      {
        header: "Due",
        field: "due"
      },
      {
        header: "Payment Status",
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
        )
      },
      {
        header: "Biller",
        field: "biller"
      },
      {
        header: "",
        field: "action",
        sortable: false,
        body: () => (
          <>
            <Link
              className="action-set"
              to="#"
              data-bs-toggle="dropdown"
              aria-expanded="true">
              <i className="fa fa-ellipsis-v" aria-hidden="true" />
            </Link>
            <ul className="dropdown-menu">
              <li>
                <Link
                  to="#"
                  className="dropdown-item"
                  data-bs-toggle="modal"
                  data-bs-target="#sales-details-new">
                  <i className="feather icon-eye info-img" />
                  Sale Detail
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item"
                  data-bs-toggle="modal"
                  data-bs-target="#edit-sales-new">
                  <i className="feather icon-edit info-img" />
                  Edit Sale
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item"
                  data-bs-toggle="modal"
                  data-bs-target="#showpayment">
                  <i className="feather icon-dollar-sign info-img" />
                  Show Payments
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item"
                  data-bs-toggle="modal"
                  data-bs-target="#createpayment">
                  <i className="feather icon-plus-circle info-img" />
                  Create Payment
                </Link>
              </li>
              <li>
                <Link to="#" className="dropdown-item">
                  <i className="feather icon-download info-img" />
                  Download pdf
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item mb-0"
                  data-bs-toggle="modal"
                  data-bs-target="#delete-modal">
                  <i className="feather icon-trash-2 info-img" />
                  Delete Sale
                </Link>
              </li>
            </ul>
          </>
        )
      }
    ],
    []
  );

  const handleSearch = (value) => {
    setSearchQuery(value ?? "");
  };

  return (
    <div>
      <div
        className={`page-wrapper pos-orders-page${
          inTillflowShell ? " pos-orders-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>POS Orders</h4>
                <h6>
                  Point-of-sale tickets and payments — filter by customer, status, or
                  date range.
                </h6>
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
                Add sale
              </Link>
              {inTillflowShell ? (
                <Link
                  to="/tillflow/admin/online-orders"
                  className="btn btn-outline-secondary">
                  <i className="ti ti-shopping-cart me-1" />
                  Online orders
                </Link>
              ) : (
                <Link
                  to={all_routes.onlineorder}
                  className="btn btn-outline-secondary">
                  <i className="ti ti-shopping-cart me-1" />
                  Online orders
                </Link>
              )}
              <Link
                to={inTillflowShell ? "/tillflow/pos" : all_routes.pos}
                className="btn btn-outline-primary">
                <i className="ti ti-device-laptop me-1" />
                Open POS
              </Link>
            </div>
          </div>
          <div className="card table-list-card manage-stock">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={handleSearch}
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
                  selection={selectedOrders}
                  onSelectionChange={(e) => setSelectedOrders(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
      <OnlineorderModal />
      <DeleteModal />
    </div>
  );
};

export default PosOrder;
