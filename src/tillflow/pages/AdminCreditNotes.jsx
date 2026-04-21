import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { apiCreditNoteToRow, creditStatusBadgeClass } from "../../feature-module/sales/creditNoteViewHelpers";
import { TillFlowApiError } from "../api/errors";
import { createInvoiceCreditNoteRequest, listCreditNotesRequest } from "../api/creditNotes";
import { useAuth } from "../auth/AuthContext";
import { downloadRowsExcel, downloadRowsPdf } from "../utils/listExport";
import { downloadCreditNotesImportTemplate, parseCreditNotesImportFile } from "../utils/creditNotesImport";

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
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importWorking, setImportWorking] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

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

  const runImport = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImportWorking(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createInvoiceCreditNoteRequest(token, row.invoiceId, {
          issued_at: row.issued_at,
          notes: row.notes,
          items: row.items
        });
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(
          `Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : "could not create credit note."}`
        );
      }
    }
    await load();
    setImportSummary({ created, skipped: 0, failed, details });
    setImportWorking(false);
  }, [token, importRows, load]);

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
                onImport={token ? () => setShowImport(true) : undefined}
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
      <Modal
        show={showImport}
        onHide={() => {
          if (!importWorking) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        centered
        size="lg"
        scrollable>
        <Modal.Header closeButton={!importWorking}>
          <Modal.Title>Import credit notes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!importSummary ? (
            <>
              <div className="d-flex gap-2 flex-wrap mb-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => void downloadCreditNotesImportTemplate()}>
                  Download template
                </button>
                <label className="btn btn-outline-secondary btn-sm mb-0">
                  Upload file
                  <input
                    type="file"
                    className="d-none"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (e.target) e.target.value = "";
                      if (!file) return;
                      const parsed = await parseCreditNotesImportFile(file);
                      setImportRows(parsed.rows);
                      setImportErrors(parsed.errors);
                      setImportSummary(null);
                    }}
                  />
                </label>
              </div>
              {importErrors.length > 0 ? (
                <div className="alert alert-warning py-2">
                  <ul className="mb-0 small ps-3">
                    {importErrors.map((er, i) => (
                      <li key={`${er.sheetRow}-${i}`}>
                        Row {er.sheetRow}: {er.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="table-responsive border rounded" style={{ maxHeight: 320 }}>
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Row</th>
                      <th>Invoice ID</th>
                      <th>Issue date</th>
                      <th>Items</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 40).map((r) => (
                      <tr key={`imp-cn-${r.sheetRow}`}>
                        <td>{r.sheetRow}</td>
                        <td>{r.invoiceId}</td>
                        <td>{r.issued_at || "—"}</td>
                        <td>{Array.isArray(r.items) ? r.items.length : 0}</td>
                        <td>{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2">
                <strong>Created:</strong> {importSummary.created}, <strong>Failed:</strong>{" "}
                {importSummary.failed}
              </p>
              <ul className="small mb-0 ps-3" style={{ maxHeight: 220, overflow: "auto" }}>
                {importSummary.details.map((d, i) => (
                  <li key={`icn-${i}`}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!importSummary ? (
            <>
              <button type="button" className="btn btn-light border" onClick={() => setShowImport(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importWorking || importRows.length === 0}
                onClick={() => void runImport()}>
                {importWorking ? "Importing..." : "Import"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setShowImport(false)}>
              Done
            </button>
          )}
        </Modal.Footer>
      </Modal>
      <CommonFooter />
    </div>
  );
}

