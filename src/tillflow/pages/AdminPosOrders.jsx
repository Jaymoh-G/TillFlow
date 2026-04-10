import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import { TillFlowApiError } from "../api/errors";
import { listPosOrdersRequest } from "../api/posOrders";
import { useAuth } from "../auth/AuthContext";
import { downloadRowsExcel, downloadRowsPdf } from "../utils/listExport";

function formatKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "—";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function statusBadgeClass(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "voided" || s === "cancelled") return "badge-soft-dark";
  if (s === "completed") return "badge-soft-success";
  return "badge-soft-primary";
}

function paymentTypeLabel(s) {
  const v = String(s ?? "").trim();
  if (!v) return "—";
  if (v.toLowerCase() === "mixed") return "Mixed";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminPosOrders() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [filterBiller, setFilterBiller] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState("");
  const [tableRows, setTableRows] = useState(10);
  const [tableCurrentPage, setTableCurrentPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError("");
    try {
      const data = await listPosOrdersRequest(token);
      setOrders(Array.isArray(data?.pos_orders) ? data.pos_orders : []);
    } catch (e) {
      setOrders([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Could not load POS orders.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status && String(o.status ?? "") !== status) return false;
      if (filterBiller && String(o.biller ?? "") !== filterBiller) return false;
      if (filterPaymentType && String(o.payment_type ?? "") !== filterPaymentType) return false;
      if (!needle) return true;
      const orderNo = String(o.order_no ?? "").toLowerCase();
      const customer = String(o.customer_name ?? "").toLowerCase();
      const biller = String(o.biller ?? "").toLowerCase();
      const reference = String(o.reference ?? "").toLowerCase();
      return orderNo.includes(needle) || customer.includes(needle) || biller.includes(needle) || reference.includes(needle);
    });
  }, [orders, q, status, filterBiller, filterPaymentType]);

  useEffect(() => {
    setTableCurrentPage(1);
  }, [q, status, filterBiller, filterPaymentType, tableRows]);

  const statusOptions = useMemo(() => ["", "Completed", "Voided"], []);
  const billerOptions = useMemo(
    () => ["", ...Array.from(new Set(orders.map((o) => String(o.biller ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))],
    [orders]
  );
  const paymentTypeOptions = useMemo(
    () => [
      "",
      ...Array.from(new Set(orders.map((o) => String(o.payment_type ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    ],
    [orders]
  );

  const handleExportExcel = useCallback(async () => {
    const rows = filtered.map((o) => ({
      Receipt: o.order_no || `#${o.id}`,
      Biller: o.biller || "",
      Reference: o.reference || "",
      "Payment type": paymentTypeLabel(o.payment_type),
      Customer: o.customer_name || "Walk-in customer",
      Total: Number(o.total_amount ?? 0),
      Tendered: Number(o.tendered_amount ?? 0),
      Change: Number(o.change_amount ?? 0),
      Status: o.status || "",
      "Paid at": formatDt(o.completed_at)
    }));
    await downloadRowsExcel(rows, "POS Orders", "pos-orders");
  }, [filtered]);

  const handleExportPdf = useCallback(async () => {
    const head = ["Receipt", "Biller", "Reference", "Payment Type", "Customer", "Total", "Tendered", "Change", "Status", "Paid At"];
    const body = filtered.map((o) => [
      o.order_no || `#${o.id}`,
      o.biller || "—",
      o.reference || "—",
      paymentTypeLabel(o.payment_type),
      o.customer_name || "Walk-in customer",
      formatKes(o.total_amount),
      formatKes(o.tendered_amount),
      formatKes(o.change_amount),
      o.status || "—",
      formatDt(o.completed_at)
    ]);
    await downloadRowsPdf("POS Orders", head, body, "pos-orders");
  }, [filtered]);

  const columns = useMemo(
    () => [
      {
        header: "Receipt",
        field: "order_no",
        body: (row) => (
          <Link to={`/tillflow/admin/pos-orders/${row.id}`} className="fw-medium text-nowrap">
            {row.order_no || `#${row.id}`}
          </Link>
        )
      },
      {
        header: "Biller",
        field: "biller",
        body: (row) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 160 }} title={row.biller}>
            {row.biller || "—"}
          </span>
        )
      },
      {
        header: "Reference",
        field: "reference",
        body: (row) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 160 }} title={row.reference}>
            {row.reference || "—"}
          </span>
        )
      },
      {
        header: "Payment type",
        field: "payment_type",
        body: (row) => <span className="small text-nowrap">{paymentTypeLabel(row.payment_type)}</span>
      },
      {
        header: "Customer",
        field: "customer_name",
        body: (row) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 220 }} title={row.customer_name}>
            {row.customer_name || "Walk-in customer"}
          </span>
        )
      },
      {
        header: "Total",
        field: "total_amount",
        className: "text-end",
        headerClassName: "text-end",
        body: (row) => <span className="text-end fw-medium d-block">{formatKes(row.total_amount)}</span>
      },
      {
        header: "Tendered",
        field: "tendered_amount",
        className: "text-end",
        headerClassName: "text-end",
        body: (row) => <span className="text-end d-block tf-mono">{formatKes(row.tendered_amount)}</span>
      },
      {
        header: "Change",
        field: "change_amount",
        className: "text-end",
        headerClassName: "text-end",
        body: (row) => <span className="text-end d-block tf-mono">{formatKes(row.change_amount)}</span>
      },
      {
        header: "Paid at",
        field: "completed_at",
        body: (row) => <span className="small text-nowrap">{formatDt(row.completed_at)}</span>
      },
      {
        header: "Status",
        field: "status",
        body: (row) => (
          <span className={`badge ${statusBadgeClass(row.status)} badge-xs shadow-none`}>
            {String(row.status ?? "") || "—"}
          </span>
        )
      },
      {
        header: "Actions",
        field: "actions",
        sortable: false,
        className: "text-end text-nowrap",
        headerClassName: "text-end",
        body: (row) => (
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="light"
              id={`pos-order-actions-${String(row.id)}`}
              className="btn btn-sm btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center pos-orders__row-actions-toggle"
              aria-label="POS order actions">
              <i className="ti ti-dots-vertical" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item as="button" type="button" onClick={() => navigate(`/tillflow/admin/pos-orders/${row.id}`)}>
                <i className="ti ti-eye me-2 text-dark" />
                View
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )
      }
    ],
    [navigate]
  );

  return (
    <div className="page-wrapper pos-orders-page">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
            <div className="page-title">
              <h4>POS orders</h4>
              <h6 className="mb-0">Receipts created from TillFlow POS checkouts.</h6>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <TableTopHead onRefresh={load} onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
              <div className="page-btn d-flex flex-wrap gap-2 m-0">
                <Link to="/tillflow/pos" className="btn btn-primary text-white">
                  <i className="feather icon-shopping-cart me-1" />
                  POS
                </Link>
              </div>
            </div>
          </div>
        </div>

        {listError ? <div className="alert alert-warning">{listError}</div> : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label small mb-0">Search</label>
                <input
                  type="search"
                  className="form-control"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Receipt, customer, biller, reference…"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Status</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statusOptions.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "All"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">Biller</label>
                <select className="form-select" value={filterBiller} onChange={(e) => setFilterBiller(e.target.value)}>
                  {billerOptions.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "All"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">Payment type</label>
                <select className="form-select" value={filterPaymentType} onChange={(e) => setFilterPaymentType(e.target.value)}>
                  {paymentTypeOptions.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s ? paymentTypeLabel(s) : "All"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="custom-datatable-filter table-responsive">
              <PrimeDataTable
                column={columns}
                data={filtered}
                rows={tableRows}
                setRows={setTableRows}
                currentPage={tableCurrentPage}
                setCurrentPage={setTableCurrentPage}
                totalRecords={filtered.length}
                loading={loading}
                isPaginationEnabled
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

