import { useMemo } from "react";
import Modal from "react-bootstrap/Modal";
import { INVOICE_PAYMENT_METHOD_OPTIONS } from "../../tillflow/api/invoicePayments";
import ReceiptPrintDocument from "./ReceiptPrintDocument";
import {
  buildReceiptViewData,
  formatInvoiceMoneyKes,
  formatRelativeTimeAgoEn,
  invoiceSentToCustomerHoverTitle,
  invoiceWasIssuedToCustomer
} from "./invoiceViewHelpers";
import { roundMoney } from "../../utils/salesDocumentLineItems";

export function RecordInvoicePaymentModal({
  show,
  onHide,
  recordPayTarget,
  recordPayAmount,
  setRecordPayAmount,
  recordPayMethod,
  setRecordPayMethod,
  recordPayPaidAt,
  setRecordPayPaidAt,
  recordPayTransactionId,
  setRecordPayTransactionId,
  recordPayNotes,
  setRecordPayNotes,
  recordPayError,
  recordPaySaving,
  onSubmit
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Record payment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {recordPayError ? <div className="alert alert-danger py-2">{recordPayError}</div> : null}
        <p className="small text-muted mb-2">
          Invoice {recordPayTarget?.invoiceno} — balance{" "}
          {recordPayTarget
            ? formatInvoiceMoneyKes(
                Math.max(0, roundMoney(Number(recordPayTarget.totalNum ?? 0) - Number(recordPayTarget.paidNum ?? 0)))
              )
            : ""}
        </p>
        <div className="mb-2">
          <label className="form-label">Amount (Ksh)</label>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="form-control"
            value={recordPayAmount}
            onChange={(e) => setRecordPayAmount(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="form-label">Method</label>
          <select
            className="form-select"
            value={recordPayMethod}
            onChange={(e) => setRecordPayMethod(e.target.value)}>
            {INVOICE_PAYMENT_METHOD_OPTIONS.map((o) => (
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
            value={recordPayPaidAt}
            onChange={(e) => setRecordPayPaidAt(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="form-label">Transaction ID</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. M-Pesa confirmation code"
            value={recordPayTransactionId}
            onChange={(e) => setRecordPayTransactionId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="mb-0">
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            rows={2}
            value={recordPayNotes}
            onChange={(e) => setRecordPayNotes(e.target.value)}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-light border" onClick={onHide}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={recordPaySaving} onClick={() => void onSubmit()}>
          {recordPaySaving ? "Saving…" : "Save payment"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export function InvoiceReceiptPreviewModal({
  receiptPreview,
  receiptPreviewRow,
  receiptPrintRootRef,
  onHide,
  onDownloadPdf,
  tillflowEmailActionsEnabled = false,
  onOpenInvoiceEmailPreview,
  onViewInvoicePdf,
  onActivityLog
}) {
  const receiptPreviewDoc = useMemo(
    () => (receiptPreview && receiptPreviewRow ? buildReceiptViewData(receiptPreview, receiptPreviewRow) : null),
    [receiptPreview, receiptPreviewRow]
  );

  const issued = receiptPreviewRow ? invoiceWasIssuedToCustomer(receiptPreviewRow) : false;
  const hasEmail = Boolean(String(receiptPreviewRow?.customerEmail ?? "").trim());
  const canEmail = Boolean(
    tillflowEmailActionsEnabled &&
      onOpenInvoiceEmailPreview &&
      receiptPreviewRow?.apiId &&
      hasEmail &&
      receiptPreviewRow.status !== "Cancelled"
  );
  const sentRel =
    issued && String(receiptPreviewRow?.sentToCustomerAt ?? "").trim()
      ? formatRelativeTimeAgoEn(String(receiptPreviewRow.sentToCustomerAt).trim())
      : "";

  return (
    <Modal show={Boolean(receiptPreview)} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Receipt {receiptPreview?.receipt_ref}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-white">
        {receiptPreviewDoc ? (
          <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 quotation-view-no-print">
              <button type="button" className="btn btn-primary" onClick={() => void onDownloadPdf()}>
                <i className="ti ti-file-download me-1" />
                Download PDF
              </button>
              {onViewInvoicePdf ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => void onViewInvoicePdf()}>
                  <i className="ti ti-file-invoice me-1" />
                  View PDF
                </button>
              ) : null}
              {onActivityLog ? (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void onActivityLog()}>
                  <i className="ti ti-history me-1" />
                  Activity log
                </button>
              ) : null}
              {tillflowEmailActionsEnabled && receiptPreviewRow ? (
                <>
                  {issued ? (
                    <span className="badge rounded-pill bg-success px-2 py-1 small">
                      Sent{sentRel ? ` · ${sentRel}` : ""}
                    </span>
                  ) : null}
                  {canEmail ? (
                    <button
                      type="button"
                      className={`btn btn-sm ${issued ? "btn-outline-danger" : "btn-outline-success"}`}
                      title={
                        issued
                          ? invoiceSentToCustomerHoverTitle(receiptPreviewRow)
                          : "Send this invoice to the customer's email"
                      }
                      onClick={() => void onOpenInvoiceEmailPreview()}>
                      <i className="ti ti-mail me-1" />
                      {issued ? "Resend to customer" : "Send to customer"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <ReceiptPrintDocument ref={receiptPrintRootRef} {...receiptPreviewDoc} />
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

export function EditInvoicePaymentModal({
  viewPayEdit,
  onHide,
  viewPayEditAmount,
  setViewPayEditAmount,
  viewPayEditMethod,
  setViewPayEditMethod,
  viewPayEditPaidAt,
  setViewPayEditPaidAt,
  viewPayEditTransactionId,
  setViewPayEditTransactionId,
  viewPayEditNotes,
  setViewPayEditNotes,
  viewPayEditError,
  viewPayEditSaving,
  onSubmit
}) {
  return (
    <Modal show={Boolean(viewPayEdit)} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit payment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {viewPayEditError ? <div className="alert alert-danger py-2">{viewPayEditError}</div> : null}
        <div className="mb-2">
          <label className="form-label">Amount (Ksh)</label>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="form-control"
            value={viewPayEditAmount}
            onChange={(e) => setViewPayEditAmount(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="form-label">Method</label>
          <select
            className="form-select"
            value={viewPayEditMethod}
            onChange={(e) => setViewPayEditMethod(e.target.value)}>
            {(viewPayEdit?.payment_method === "opening_balance"
              ? [{ value: "opening_balance", label: "Opening balance" }, ...INVOICE_PAYMENT_METHOD_OPTIONS]
              : INVOICE_PAYMENT_METHOD_OPTIONS
            ).map((o) => (
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
            value={viewPayEditPaidAt}
            onChange={(e) => setViewPayEditPaidAt(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="form-label">Transaction ID</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. M-Pesa confirmation code"
            value={viewPayEditTransactionId}
            onChange={(e) => setViewPayEditTransactionId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="mb-0">
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            rows={2}
            value={viewPayEditNotes}
            onChange={(e) => setViewPayEditNotes(e.target.value)}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-light border" onClick={onHide}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={viewPayEditSaving} onClick={() => void onSubmit()}>
          {viewPayEditSaving ? "Saving…" : "Save"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
