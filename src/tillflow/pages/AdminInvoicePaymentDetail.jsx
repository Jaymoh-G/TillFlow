import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import PrimeDataTable from "../../components/data-table";
import CommonFooter from "../../components/footer/commonFooter";
import InvoicePrintDocument from "../../feature-module/sales/InvoicePrintDocument";
import ReceiptPrintDocument from "../../feature-module/sales/ReceiptPrintDocument";
import {
  apiInvoiceToRow,
  buildInvoiceViewDocumentData,
  buildReceiptViewData,
  invoiceSentToCustomerHoverTitle,
  invoiceStatusBadgeClass,
  invoiceWasIssuedToCustomer
} from "../../feature-module/sales/invoiceViewHelpers";
import { createHtmlDocumentPdfObjectUrl, downloadHtmlDocumentPdfFromElement, waitForPrintRootImages } from "../../utils/htmlDocumentPdfExport";
import { TillFlowApiError } from "../api/errors";
import { listCustomersRequest } from "../api/customers";
import {
  INVOICE_PAYMENT_METHOD_OPTIONS,
  listAllInvoicePaymentsRequest,
  updateInvoicePaymentRequest
} from "../api/invoicePayments";
import { showInvoiceRequest } from "../api/invoices";
import { useAuth } from "../auth/AuthContext";
import { PERMISSION } from "../auth/permissions";
import ActivityLogModal from "../components/ActivityLogModal";

const FEATURE_PLACEHOLDER_BODY =
  "This feature is not implemented yet. It needs backend support (e.g. mail, tracking tables, or credits).";

function enrichCustomerRow(baseRow, catalogCustomers) {
  if (!baseRow) {
    return baseRow;
  }
  const hasEmail = String(baseRow.customerEmail ?? "").trim() !== "";
  const hasPhone = String(baseRow.customerPhone ?? "").trim() !== "";
  const hasLocation = String(baseRow.customerLocation ?? "").trim() !== "";
  if (hasEmail && hasPhone && hasLocation) {
    return baseRow;
  }
  const matchById = String(baseRow.customerId ?? "").trim();
  let customerMatch = null;
  if (matchById) {
    customerMatch = (catalogCustomers ?? []).find((c) => String(c.id) === matchById) ?? null;
  }
  if (!customerMatch) {
    const name = String(baseRow.customer ?? "").trim().toLowerCase();
    if (name) {
      customerMatch = (catalogCustomers ?? []).find((c) => String(c.name ?? "").trim().toLowerCase() === name) ?? null;
    }
  }
  if (!customerMatch) {
    return baseRow;
  }
  return {
    ...baseRow,
    customerId: String(baseRow.customerId ?? customerMatch.id ?? ""),
    customerEmail: String(baseRow.customerEmail ?? "").trim() || String(customerMatch.email ?? ""),
    customerPhone: String(baseRow.customerPhone ?? "").trim() || String(customerMatch.phone ?? ""),
    customerLocation: String(baseRow.customerLocation ?? "").trim() || String(customerMatch.location ?? "")
  };
}

const PAYMENTS_LIST_PATH = "/admin/invoice-payments";

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

export default function AdminInvoicePaymentDetail() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const canViewActivityLog = hasPermission(PERMISSION.ACTIVITY_LOGS_VIEW);
  const receiptRef = useRef(null);
  const invoicePrintRootRef = useRef(null);

  const [payments, setPayments] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listSidebarRows, setListSidebarRows] = useState(10);
  const [listSidebarCurrentPage, setListSidebarCurrentPage] = useState(1);

  const [customers, setCustomers] = useState([]);
  const [invoiceSideRow, setInvoiceSideRow] = useState(null);
  const [invoicePdfPreviewUrl, setInvoicePdfPreviewUrl] = useState(null);
  const [placeholder, setPlaceholder] = useState(null);
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editTransactionId, setEditTransactionId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadList = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError("");
    setListLoading(true);
    try {
      const data = await listAllInvoicePaymentsRequest(token, {});
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) {
      setPayments([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError("Failed to load payments.");
      }
    } finally {
      setListLoading(false);
    }
  }, [token]);

  const loadCustomers = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const data = await listCustomersRequest(token);
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    }
  }, [token]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const selected = useMemo(() => {
    if (paymentId == null || paymentId === "") {
      return null;
    }
    const idNum = Number(paymentId);
    if (Number.isFinite(idNum)) {
      return payments.find((p) => Number(p.id) === idNum) ?? null;
    }
    const ref = String(paymentId).trim();
    return payments.find((p) => String(p.receipt_ref ?? "").trim() === ref) ?? null;
  }, [paymentId, payments]);

  useEffect(() => {
    if (paymentId == null || paymentId === "" || !payments.length) {
      return;
    }
    let idx = -1;
    const idNum = Number(paymentId);
    if (Number.isFinite(idNum)) {
      idx = payments.findIndex((p) => Number(p.id) === idNum);
    }
    if (idx < 0) {
      const ref = String(paymentId).trim();
      idx = payments.findIndex((p) => String(p.receipt_ref ?? "").trim() === ref);
    }
    if (idx < 0) {
      return;
    }
    const page = Math.floor(idx / listSidebarRows) + 1;
    setListSidebarCurrentPage(page);
  }, [paymentId, payments, listSidebarRows]);

  useEffect(() => {
    if (!token || !selected?.invoice_id) {
      setInvoiceSideRow(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await showInvoiceRequest(token, selected.invoice_id);
        if (cancelled || !data?.invoice) {
          return;
        }
        setInvoiceSideRow(enrichCustomerRow(apiInvoiceToRow(data.invoice), customers));
      } catch {
        if (!cancelled) {
          setInvoiceSideRow(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selected?.invoice_id, customers]);

  useEffect(() => {
    setInvoicePdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, [selected?.invoice_id]);

  const paymentSidebarColumns = useMemo(
    () => [
      {
        header: "Receipt",
        field: "receipt_ref",
        body: (p) => (
          <Link to={`${PAYMENTS_LIST_PATH}/${p.id}`} className="fw-medium text-nowrap">
            {p.receipt_ref}
          </Link>
        )
      },
      {
        header: "Customer",
        field: "customer_name",
        body: (p) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 120 }} title={p.customer_name}>
            {p.customer_name || "—"}
          </span>
        )
      },
      {
        header: "Amount",
        field: "amount",
        className: "text-end",
        body: (p) => <span className="small text-end d-block text-nowrap">{formatKes(p.amount)}</span>
      },
      {
        header: "Status",
        field: "invoice_status",
        body: (p) => {
          const invStatus = String(p.invoice_status ?? "").trim();
          return invStatus ? (
            <span className={`badge ${invoiceStatusBadgeClass(invStatus)} badge-xs shadow-none`}>
              {invStatus.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="small">—</span>
          );
        }
      }
    ],
    []
  );

  const receiptDoc = useMemo(
    () => (selected ? buildReceiptViewData(selected, null) : null),
    [selected]
  );

  const invoiceViewDoc = useMemo(
    () =>
      invoiceSideRow ? buildInvoiceViewDocumentData(enrichCustomerRow(invoiceSideRow, customers)) : null,
    [invoiceSideRow, customers]
  );

  const invoiceIssued = Boolean(invoiceSideRow && invoiceWasIssuedToCustomer(invoiceSideRow));
  const canEmailCustomer = Boolean(
    invoiceSideRow?.apiId &&
      String(invoiceSideRow.status ?? "") !== "Cancelled" &&
      String(invoiceSideRow.status ?? "") !== "Draft" &&
      String(invoiceSideRow.customerEmail ?? "").trim()
  );

  const handleCloseInvoicePdfPreview = useCallback(() => {
    setInvoicePdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, []);

  const handleViewInvoicePdf = useCallback(async () => {
    if (!invoiceViewDoc) {
      return;
    }
    const root = invoicePrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `invoice-${String(invoiceViewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`;
      const url = await createHtmlDocumentPdfObjectUrl(root, { fileSlug: slug });
      setInvoicePdfPreviewUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {
            /* ignore */
          }
        }
        return url;
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [invoiceViewDoc]);

  const openEdit = useCallback((p) => {
    if (!p) {
      return;
    }
    setEditRow(p);
    setEditAmount(String(p.amount ?? ""));
    setEditMethod(String(p.payment_method ?? "cash"));
    const iso = p.paid_at ? String(p.paid_at) : "";
    setEditPaidAt(iso ? iso.slice(0, 16) : "");
    setEditTransactionId(String(p.transaction_id ?? ""));
    setEditNotes(String(p.notes ?? ""));
    setEditError("");
  }, []);

  const closeEdit = useCallback(() => {
    setEditRow(null);
    setEditSaving(false);
    setEditError("");
  }, []);

  const editMethodOptions = useMemo(() => {
    const o = [...INVOICE_PAYMENT_METHOD_OPTIONS];
    if (editRow?.payment_method === "opening_balance") {
      o.unshift({ value: "opening_balance", label: "Opening balance" });
    }
    return o;
  }, [editRow]);

  const saveEdit = useCallback(async () => {
    if (!token || !editRow) {
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const body = {
        amount: Number(String(editAmount).replace(/,/g, "")) || 0,
        payment_method: editMethod,
        paid_at: editPaidAt ? new Date(editPaidAt).toISOString() : undefined,
        transaction_id: editTransactionId.trim() || null,
        notes: editNotes.trim() || null
      };
      await updateInvoicePaymentRequest(token, editRow.invoice_id, editRow.id, body);
      closeEdit();
      void loadList();
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setEditError(e.message);
      } else {
        setEditError("Could not update payment.");
      }
    } finally {
      setEditSaving(false);
    }
  }, [token, editRow, editAmount, editMethod, editPaidAt, editTransactionId, editNotes, closeEdit, loadList]);

  const downloadReceiptPdf = useCallback(async () => {
    const root = receiptRef.current;
    if (!root || !(root instanceof HTMLElement) || !selected) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `receipt-${String(selected.receipt_ref).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (err) {
      console.error(err);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [selected]);

  const goEmailCustomer = useCallback(() => {
    if (!selected?.invoice_id || !canEmailCustomer) {
      return;
    }
    navigate(`/admin/invoices/${selected.invoice_id}?emailCustomer=1`);
  }, [navigate, selected?.invoice_id, canEmailCustomer]);

  const notFound = !listLoading && !listError && payments.length > 0 && paymentId && !selected;

  if (!token) {
    return (
      <div className="page-wrapper p-4">
        <p className="text-muted mb-0">Sign in to view payments.</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper tf-admin-invoice-detail tf-admin-payment-detail">
      {invoiceViewDoc ? (
        <div
          className="position-fixed quotation-view-no-print"
          style={{
            left: "-9999px",
            top: 0,
            width: "794px",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
            overflow: "hidden"
          }}
          aria-hidden="true">
          <InvoicePrintDocument ref={invoicePrintRootRef} {...invoiceViewDoc} />
        </div>
      ) : null}

      <div className="tf-admin-invoice-detail__layout">
        <aside className="tf-admin-invoice-detail__list">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <h5 className="tf-heading mb-0">Receipts</h5>
            {selected?.invoice_id ? (
              <NavLink
                to={`/admin/invoices/${selected.invoice_id}?recordPayment=1`}
                className="btn btn-sm btn-primary"
                title="Record a new payment on this invoice">
                New
              </NavLink>
            ) : (
              <span className="btn btn-sm btn-primary disabled" style={{ pointerEvents: "none" }}>
                New
              </span>
            )}
          </div>
          {listError ? <div className="alert alert-warning py-2 small">{listError}</div> : null}
          {listLoading ? <p className="text-muted small">Loading…</p> : null}
          <div className="tf-admin-invoice-detail__list-scroll">
            <PrimeDataTable
              column={paymentSidebarColumns}
              data={payments}
              rows={listSidebarRows}
              setRows={setListSidebarRows}
              currentPage={listSidebarCurrentPage}
              setCurrentPage={setListSidebarCurrentPage}
              totalRecords={payments.length}
              loading={listLoading}
              isPaginationEnabled
              sortable={false}
            />
          </div>
          <div className="mt-2">
            <NavLink to={PAYMENTS_LIST_PATH} className="small">
              Full payments list
            </NavLink>
          </div>
        </aside>

        <main className="tf-admin-invoice-detail__main">
          {listLoading ? <p className="text-muted quotation-view-no-print">Loading…</p> : null}
          {notFound ? (
            <div className="alert alert-warning quotation-view-no-print" role="alert">
              Payment not found in the current list.{" "}
              <Link to={PAYMENTS_LIST_PATH} className="alert-link">
                Back to invoice payments
              </Link>
            </div>
          ) : null}
          {!listLoading && selected && receiptDoc ? (
            <>
              <div className="tf-admin-invoice-detail__toolbar quotation-view-no-print">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void downloadReceiptPdf()}>
                    <i className="ti ti-file-download me-1" />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={!invoiceViewDoc}
                    title={"Preview invoice PDF (this payment's invoice)"}
                    onClick={() => void handleViewInvoicePdf()}>
                    <i className="ti ti-file-invoice me-1" />
                    View PDF
                  </button>
                  {canViewActivityLog ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setActivityLogOpen(true)}
                      disabled={!selected?.invoice_id}>
                      <i className="ti ti-history me-1" />
                      Activity log
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`btn btn-sm ${invoiceIssued ? "btn-outline-danger" : "btn-outline-success"}`}
                    disabled={!canEmailCustomer}
                    title={
                      invoiceIssued && invoiceSideRow
                        ? invoiceSentToCustomerHoverTitle(invoiceSideRow)
                        : "Send invoice to the customer's email"
                    }
                    onClick={goEmailCustomer}>
                    <i className="ti ti-mail me-1" />
                    {invoiceIssued ? "Resend to customer" : "Send to customer"}
                  </button>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openEdit(selected)}>
                    <i className="ti ti-edit me-1" />
                    Edit payment
                  </button>
                  <NavLink
                    to={`/admin/invoices/${selected.invoice_id}`}
                    className="btn btn-outline-secondary btn-sm">
                    <i className="ti ti-file-invoice me-1" />
                    Invoice {selected.invoice_ref}
                  </NavLink>
                </div>
                <div className="w-100 mt-2 pt-2 border-top border-light-subtle small d-flex flex-wrap align-items-center gap-2">
                  <span>
                    <span className="text-muted fw-semibold">Customer</span>{" "}
                    <span className="text-body">{String(selected.customer_name ?? "").trim() || "—"}</span>
                  </span>
                  <span className="text-muted" aria-hidden="true">
                    ·
                  </span>
                  <span className="d-inline-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold">Invoice status</span>
                    {String(selected.invoice_status ?? "").trim() ? (
                      <span className={`badge ${invoiceStatusBadgeClass(selected.invoice_status)} badge-xs shadow-none`}>
                        {String(selected.invoice_status).replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-body">—</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="tf-admin-invoice-detail__doc bg-white rounded border">
                <div className="p-3">
                  <ReceiptPrintDocument ref={receiptRef} {...receiptDoc} />
                </div>
              </div>
            </>
          ) : null}
          {!listLoading && !selected && !notFound && !listError && payments.length === 0 ? (
            <p className="text-muted quotation-view-no-print mb-0">
              No payments yet.{" "}
              <Link to={PAYMENTS_LIST_PATH} className="text-primary">
                Open payments
              </Link>
            </p>
          ) : null}
        </main>
      </div>

      <Modal show={Boolean(placeholder)} onHide={() => setPlaceholder(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{placeholder?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{placeholder?.body}</Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-primary" onClick={() => setPlaceholder(null)}>
            OK
          </button>
        </Modal.Footer>
      </Modal>

      <ActivityLogModal
        show={activityLogOpen}
        onHide={() => setActivityLogOpen(false)}
        token={token}
        canView={canViewActivityLog}
        invoiceId={selected?.invoice_id ? Number(selected.invoice_id) : null}
      />

      <DocumentPdfPreviewModal
        url={invoicePdfPreviewUrl}
        title={invoiceViewDoc ? `Invoice ${invoiceViewDoc.invoiceNo}` : "Invoice PDF"}
        onHide={handleCloseInvoicePdfPreview}
      />

      <Modal show={Boolean(editRow)} onHide={closeEdit} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
          <div className="mb-2">
            <label className="form-label">Amount (Ksh)</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className="form-control"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Method</label>
            <select className="form-select" value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
              {editMethodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Paid at</label>
            <input
              type="datetime-local"
              className="form-control"
              value={editPaidAt}
              onChange={(e) => setEditPaidAt(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Transaction ID</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. M-Pesa confirmation code"
              value={editTransactionId}
              onChange={(e) => setEditTransactionId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="mb-0">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={closeEdit}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={editSaving} onClick={() => void saveEdit()}>
            {editSaving ? "Saving…" : "Save"}
          </button>
        </Modal.Footer>
      </Modal>

      <CommonFooter />
    </div>
  );
}
