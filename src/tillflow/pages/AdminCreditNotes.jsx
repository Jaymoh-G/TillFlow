import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { apiCreditNoteToRow, creditStatusBadgeClass } from "../../feature-module/sales/creditNoteViewHelpers";
import { TillFlowApiError } from "../api/errors";
import { listCreditNotesRequest } from "../api/creditNotes";
import { useAuth } from "../auth/AuthContext";
import { downloadRowsExcel, downloadRowsPdf } from "../utils/listExport";

export default function AdminCreditNotes() {
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
      const data = await listCreditNotesRequest(token, {
        q: searchQ.trim() || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined
      });
      const list = (data?.credit_notes ?? []).map(apiCreditNoteToRow);
      setRows(list);
    } catch (e) {
      setRows([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Could not load credit notes.");
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

  const handleExportExcel = useCallback(async () => {
    const records = rows.map((row) => ({
      "Credit note": row.creditNoteNo,
      Invoice: row.invoiceRef,
      Customer: row.customerName,
      "Issue date": row.issueDate,
      Qty: row.totalQty,
      Amount: row.totalAmountDisplay,
      Status: row.status
    }));
    await downloadRowsExcel(records, "Credit notes", "credit-notes");
  }, [rows]);

  const handleExportPdf = useCallback(async () => {
    const body = rows.map((row) => [
      String(row.creditNoteNo ?? ""),
      String(row.invoiceRef ?? ""),
      String(row.customerName ?? ""),
      String(row.issueDate ?? ""),
      String(row.totalQty ?? ""),
      String(row.totalAmountDisplay ?? ""),
      String(row.status ?? "")
    ]);
    await downloadRowsPdf(
      "Credit notes",
      ["Credit note", "Invoice", "Customer", "Issue date", "Qty", "Amount", "Status"],
      body,
      "credit-notes"
    );
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        header: "Credit note",
        field: "creditNoteNo",
        body: (row) => (
          <Link to={`/tillflow/admin/credit-notes/${row.apiId}`} className="fw-medium">
            {row.creditNoteNo}
          </Link>
        )
      },
      {
        header: "Invoice #",
        field: "invoiceRef",
        body: (row) =>
          row.invoiceId ? (
            <Link to={`/tillflow/admin/invoices/${row.invoiceId}`} className="small fw-medium text-nowrap">
              {row.invoiceRef || `Invoice #${row.invoiceId}`}
            </Link>
          ) : (
            <span className="small text-muted">—</span>
          )
      },
      {
        header: "Customer",
        field: "customerName",
        body: (row) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 220 }} title={row.customerName}>
            {row.customerName || "—"}
          </span>
        )
      },
      {
        header: "Amount",
        field: "totalAmountDisplay",
        sortField: "totalAmount",
        headerClassName: "text-end",
        className: "text-end",
        body: (row) => <span className="text-end fw-medium d-block">{row.totalAmountDisplay}</span>
      },
      {
        header: "Status",
        field: "status",
        body: (row) => (
          <span className={`badge ${creditStatusBadgeClass(row.status)} badge-xs shadow-none`}>{row.status}</span>
        )
      },
      {
        header: "Actions",
        field: "actions",
        sortable: false,
        headerClassName: "text-end",
        className: "text-end text-nowrap",
        body: (row) => (
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="light"
              id={`credit-note-actions-${String(row.apiId ?? row.id)}`}
              className="btn btn-sm btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center tf-delivery-notes-kebab"
              aria-label="Credit note actions">
              <i className="ti ti-dots-vertical" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item as={Link} to={`/tillflow/admin/credit-notes/${row.apiId}`}>
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
                to={`/tillflow/admin/credit-notes/${row.apiId}?emailCustomer=1`}
                disabled={String(row.status ?? "") === "Cancelled" || !String(row.customerEmail ?? "").trim()}>
                <i className="ti ti-send me-2 text-dark" />
                Send to customer
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                as={Link}
                to={`/tillflow/admin/credit-notes/${row.apiId}?cancel=1`}
                className="text-danger"
                disabled={String(row.status ?? "") === "Cancelled"}>
                <i className="ti ti-trash me-2" />
                Cancel note
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
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
              <h4>Credit notes</h4>
              <h6 className="mb-0">Documents generated from invoices to record credited quantities and amounts.</h6>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <TableTopHead
                onRefresh={() => void load()}
                onExportPdf={
                  loading || rows.length === 0 ? undefined : () => void handleExportPdf()
                }
                onExportExcel={
                  loading || rows.length === 0 ? undefined : () => void handleExportExcel()
                }
              />
              <Link to="/tillflow/admin/invoices" className="btn btn-outline-primary">
                <i className="feather icon-arrow-left me-1" />
                Invoices
              </Link>
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
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Credit note, invoice, customer..."
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

            <div className="custom-datatable-filter table-responsive">
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
      </div>
      <CommonFooter />
    </div>
  );
}

