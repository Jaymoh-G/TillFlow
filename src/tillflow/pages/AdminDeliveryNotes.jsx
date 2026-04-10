import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import CommonFooter from "../../components/footer/commonFooter";
import PrimeDataTable from "../../components/data-table";
import { apiDeliveryNoteToRow, deliveryStatusBadgeClass } from "../../feature-module/sales/deliveryNoteViewHelpers";
import { TillFlowApiError } from "../api/errors";
import { listDeliveryNotesRequest } from "../api/deliveryNotes";
import { useAuth } from "../auth/AuthContext";

export default function AdminDeliveryNotes() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tableRows, setTableRows] = useState(10);
  const [tableCurrentPage, setTableCurrentPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const data = await listDeliveryNotesRequest(token, {
        q: searchQ.trim() || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined
      });
      const list = (data?.delivery_notes ?? data?.notes ?? []).map(apiDeliveryNoteToRow);
      setRows(list);
    } catch (e) {
      setRows([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError("Could not load delivery notes.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, searchQ, statusFilter, from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const statusOptions = useMemo(() => ["", "Draft", "Issued", "Cancelled"], []);
  const columns = useMemo(
    () => [
      {
        header: "Delivery note",
        field: "deliveryNoteNo",
        body: (row) => (
          <Link to={`/tillflow/admin/delivery-notes/${row.apiId}`} className="fw-medium">
            {row.deliveryNoteNo}
          </Link>
        )
      },
      {
        header: "Invoice",
        field: "invoiceRef",
        body: (row) =>
          row.invoiceId ? (
            <Link to={`/tillflow/admin/invoices/${row.invoiceId}`}>{row.invoiceRef || `Invoice #${row.invoiceId}`}</Link>
          ) : (
            row.invoiceRef || "—"
          )
      },
      { header: "Customer", field: "customerName", body: (row) => row.customerName || "—" },
      { header: "Issue date", field: "issueDate", body: (row) => row.issueDate || "—" },
      {
        header: "Qty",
        field: "totalQty",
        className: "text-end",
        body: (row) => <span className="text-end d-block">{row.totalQty}</span>
      },
      {
        header: "Status",
        field: "status",
        body: (row) => (
          <span className={`badge ${deliveryStatusBadgeClass(row.status)} badge-xs shadow-none`}>
            {row.status}
          </span>
        )
      },
      {
        header: "Actions",
        field: "action",
        sortable: false,
        className: "text-end",
        body: (row) => (
          <div className="text-end text-nowrap">
            <Dropdown align="end">
              <Dropdown.Toggle
                variant="light"
                id={`delivery-note-actions-${String(row.apiId ?? row.id)}`}
                className="btn btn-sm btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center tf-delivery-notes-kebab"
                aria-label="Delivery note actions">
                <i className="ti ti-dots-vertical" />
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item as={Link} to={`/tillflow/admin/delivery-notes/${row.apiId}`}>
                  <i className="ti ti-eye me-2 text-dark" />
                  View
                </Dropdown.Item>
                {row.invoiceId ? (
                  <Dropdown.Item as={Link} to={`/tillflow/admin/invoices/${row.invoiceId}`}>
                    <i className="ti ti-file-invoice me-2 text-dark" />
                    View invoice
                  </Dropdown.Item>
                ) : null}
                <Dropdown.Item
                  as={Link}
                  to={`/tillflow/admin/delivery-notes/${row.apiId}?emailCustomer=1`}
                  disabled={String(row.status ?? "") === "Cancelled" || !String(row.customerEmail ?? "").trim()}>
                  <i className="ti ti-send me-2 text-dark" />
                  Send to customer
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  as={Link}
                  to={`/tillflow/admin/delivery-notes/${row.apiId}?cancel=1`}
                  className="text-danger"
                  disabled={String(row.status ?? "") === "Cancelled"}>
                  <i className="ti ti-trash me-2" />
                  Cancel note
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )
      }
    ],
    []
  );

  return (
    <div className="page-wrapper invoice-payments-page">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
            <div className="page-title">
              <h4>Delivery notes</h4>
              <h6 className="mb-0">Documents generated from invoices to track dispatched quantities.</h6>
            </div>
            <Link to="/tillflow/admin/invoices" className="btn btn-outline-primary">
              <i className="feather icon-arrow-left me-1" />
              Invoices
            </Link>
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
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Delivery note, invoice, customer..."
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Status</label>
                <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status || "all"} value={status}>
                      {status || "All"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">From</label>
                <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">To</label>
                <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <PrimeDataTable
              column={columns}
              data={rows}
              rows={tableRows}
              setRows={setTableRows}
              currentPage={tableCurrentPage}
              setCurrentPage={setTableCurrentPage}
              totalRecords={rows.length}
              loading={loading}
              isPaginationEnabled
            />
          </div>
        </div>
      </div>
      <CommonFooter />
    </div>
  );
}
