import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Link, NavLink, useSearchParams, useParams } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import PrimeDataTable from "../../components/data-table";
import CommonFooter from "../../components/footer/commonFooter";
import DeliveryNotePrintDocument from "../../feature-module/sales/DeliveryNotePrintDocument";
import {
  apiDeliveryNoteToRow,
  buildDeliveryNoteViewDocumentData,
  deliveryStatusBadgeClass
} from "../../feature-module/sales/deliveryNoteViewHelpers";
import {
  createHtmlDocumentPdfObjectUrl,
  htmlDocumentPdfBlobFromElement,
  downloadHtmlDocumentPdfFromElement,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { TillFlowApiError } from "../api/errors";
import {
  cancelDeliveryNoteRequest,
  listDeliveryNotesRequest,
  previewDeliveryNoteEmailRequest,
  sendDeliveryNoteToCustomerRequest,
  showDeliveryNoteRequest
} from "../api/deliveryNotes";
import { useAuth } from "../auth/AuthContext";

export default function AdminDeliveryNoteDetail() {
  const { deliveryNoteId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const printRootRef = useRef(null);
  const emailSuccessTimerRef = useRef(null);

  const [listRows, setListRows] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listSidebarRows, setListSidebarRows] = useState(10);
  const [listSidebarCurrentPage, setListSidebarCurrentPage] = useState(1);
  const [row, setRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState("");
  const [emailPreviewSending, setEmailPreviewSending] = useState(false);
  const [emailPreviewTo, setEmailPreviewTo] = useState("");
  const [emailPreviewSubject, setEmailPreviewSubject] = useState("");
  const [emailPreviewMessage, setEmailPreviewMessage] = useState("");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [emailSuccessMessage, setEmailSuccessMessage] = useState("");

  useEffect(() => {
    return () => {
      if (emailSuccessTimerRef.current) {
        window.clearTimeout(emailSuccessTimerRef.current);
      }
    };
  }, []);

  const showEmailSuccess = useCallback((message) => {
    setEmailSuccessMessage(String(message ?? "").trim());
    if (emailSuccessTimerRef.current) {
      window.clearTimeout(emailSuccessTimerRef.current);
    }
    emailSuccessTimerRef.current = window.setTimeout(() => {
      setEmailSuccessMessage("");
      emailSuccessTimerRef.current = null;
    }, 4500);
  }, []);

  const clearSearchParam = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const loadList = useCallback(async () => {
    if (!token) {
      return;
    }
    setListLoading(true);
    setListError("");
    try {
      const data = await listDeliveryNotesRequest(token);
      setListRows((data?.delivery_notes ?? data?.notes ?? []).map(apiDeliveryNoteToRow));
    } catch (e) {
      setListRows([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Could not load delivery notes.");
    } finally {
      setListLoading(false);
    }
  }, [token]);

  const loadDetail = useCallback(async () => {
    if (!token || !deliveryNoteId) {
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await showDeliveryNoteRequest(token, deliveryNoteId);
      const note = data?.delivery_note ?? data?.note ?? null;
      if (!note) {
        setDetailError("Delivery note not found.");
        setRow(null);
        return;
      }
      setRow(apiDeliveryNoteToRow(note));
    } catch (e) {
      setDetailError(e instanceof TillFlowApiError ? e.message : "Could not load delivery note.");
      setRow(null);
    } finally {
      setDetailLoading(false);
    }
  }, [token, deliveryNoteId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!deliveryNoteId || !listRows.length) {
      return;
    }
    const idx = listRows.findIndex((item) => String(item.apiId) === String(deliveryNoteId));
    if (idx < 0) {
      return;
    }
    const page = Math.floor(idx / listSidebarRows) + 1;
    setListSidebarCurrentPage(page);
  }, [deliveryNoteId, listRows, listSidebarRows]);

  const listSidebarColumns = useMemo(
    () => [
      {
        header: "Note",
        field: "deliveryNoteNo",
        body: (item) => (
          <Link to={`/tillflow/admin/delivery-notes/${item.apiId}`} className="fw-medium text-nowrap">
            {item.deliveryNoteNo}
          </Link>
        )
      },
      {
        header: "Customer",
        field: "customerName",
        body: (item) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 120 }} title={item.customerName}>
            {item.customerName || "—"}
          </span>
        )
      },
      {
        header: "Invoice",
        field: "invoiceRef",
        body: (item) =>
          item.invoiceId ? (
            <Link to={`/tillflow/admin/invoices/${item.invoiceId}`} className="small">
              {item.invoiceRef || item.invoiceId}
            </Link>
          ) : (
            <span className="small">—</span>
          )
      },
      {
        header: "Status",
        field: "status",
        body: (item) => (
          <span className={`badge ${deliveryStatusBadgeClass(item.status)} badge-xs shadow-none`}>{item.status}</span>
        )
      }
    ],
    []
  );

  const viewDoc = useMemo(() => (row ? buildDeliveryNoteViewDocumentData(row) : null), [row]);

  const openPdfPreview = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `delivery-note-${String(viewDoc.noteNo).replace(/[^\w.-]+/g, "_")}`;
      const url = await createHtmlDocumentPdfObjectUrl(root, { fileSlug: slug });
      setPdfPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
    } catch {
      window.alert("Could not generate PDF.");
    }
  }, [viewDoc]);

  const downloadPdf = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `delivery-note-${String(viewDoc.noteNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch {
      window.alert("Could not generate PDF.");
    }
  }, [viewDoc]);

  const cancelNote = useCallback(async () => {
    if (!token || !row?.apiId) {
      return;
    }
    setActionBusy(true);
    try {
      const data = await cancelDeliveryNoteRequest(token, row.apiId);
      const next = data?.delivery_note ?? data?.note ?? null;
      if (next) {
        setRow(apiDeliveryNoteToRow(next));
      }
      setCancelOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof TillFlowApiError ? e.message : "Could not cancel delivery note.");
    } finally {
      setActionBusy(false);
    }
  }, [token, row?.apiId, loadList]);

  const resetEmailPreview = useCallback(() => {
    setEmailPreviewOpen(false);
    setEmailPreviewLoading(false);
    setEmailPreviewError("");
    setEmailPreviewSending(false);
    setEmailPreviewTo("");
    setEmailPreviewSubject("");
    setEmailPreviewMessage("");
    setEmailPreviewHtml("");
  }, []);

  const openEmailPreview = useCallback(async () => {
    if (!token || !row?.apiId) {
      return;
    }
    if (!String(row.customerEmail ?? "").trim()) {
      window.alert("Add an email to the customer before sending.");
      return;
    }
    setEmailPreviewOpen(true);
    setEmailPreviewLoading(true);
    setEmailPreviewError("");
    setEmailPreviewTo(String(row.customerEmail ?? "").trim());
    setEmailPreviewSubject("");
    setEmailPreviewMessage("");
    setEmailPreviewHtml("");
    try {
      const data = await previewDeliveryNoteEmailRequest(token, row.apiId);
      if (String(data?.to_email ?? "").trim()) {
        setEmailPreviewTo(String(data.to_email).trim());
      }
      setEmailPreviewSubject(String(data?.subject ?? ""));
      setEmailPreviewMessage(String(data?.message_template ?? "Please find your delivery note below."));
      setEmailPreviewHtml(String(data?.html ?? ""));
    } catch (e) {
      setEmailPreviewError(e instanceof TillFlowApiError ? e.message : "Could not load email preview.");
    } finally {
      setEmailPreviewLoading(false);
    }
  }, [token, row?.apiId, row?.customerEmail]);

  const confirmSendEmail = useCallback(async () => {
    if (!token || !row?.apiId) {
      return;
    }
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    setEmailPreviewSending(true);
    try {
      await waitForPrintRootImages(root);
      const pdfBlob = await htmlDocumentPdfBlobFromElement(root, {
        fileSlug: `delivery-note-${String(row.deliveryNoteNo ?? row.apiId).replace(/[^\w.-]+/g, "_")}`
      });
      await sendDeliveryNoteToCustomerRequest(token, row.apiId, {
        pdfBlob,
        attachmentFilename: `delivery-note-${String(row.deliveryNoteNo ?? row.apiId).replace(/[^\w.-]+/g, "_")}.pdf`,
        toEmail: String(emailPreviewTo ?? "").trim(),
        subject: String(emailPreviewSubject ?? "").trim(),
        message: String(emailPreviewMessage ?? "")
      });
      resetEmailPreview();
      showEmailSuccess("Delivery note email sent.");
    } catch (e) {
      window.alert(e instanceof TillFlowApiError ? e.message : "Could not send delivery note email.");
    } finally {
      setEmailPreviewSending(false);
    }
  }, [token, row, emailPreviewTo, emailPreviewSubject, emailPreviewMessage, resetEmailPreview, showEmailSuccess]);

  useEffect(() => {
    if (searchParams.get("emailCustomer") !== "1" || !row?.apiId) {
      return;
    }
    if (String(row.status ?? "") === "Cancelled") {
      clearSearchParam("emailCustomer");
      return;
    }
    if (!String(row.customerEmail ?? "").trim()) {
      window.alert("Add an email to the customer before sending.");
      clearSearchParam("emailCustomer");
      return;
    }
    void openEmailPreview();
    clearSearchParam("emailCustomer");
  }, [row?.apiId, row?.status, row?.customerEmail, searchParams, openEmailPreview, clearSearchParam]);

  useEffect(() => {
    if (searchParams.get("cancel") !== "1" || !row?.apiId) {
      return;
    }
    if (String(row.status ?? "") !== "Cancelled") {
      setCancelOpen(true);
    }
    clearSearchParam("cancel");
  }, [row?.apiId, row?.status, searchParams, clearSearchParam]);

  return (
    <div className="page-wrapper tf-admin-invoice-detail tf-admin-payment-detail">
      {emailSuccessMessage ? (
        <div className="position-fixed top-0 end-0 p-3 quotation-view-no-print" style={{ zIndex: 3000, minWidth: 280, maxWidth: 420 }}>
          <div className="alert alert-success shadow-sm mb-0 d-flex align-items-center justify-content-between gap-2">
            <span>{emailSuccessMessage}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => {
                if (emailSuccessTimerRef.current) {
                  window.clearTimeout(emailSuccessTimerRef.current);
                  emailSuccessTimerRef.current = null;
                }
                setEmailSuccessMessage("");
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="tf-admin-invoice-detail__layout">
        <aside className="tf-admin-invoice-detail__list">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <h5 className="tf-heading mb-0">Delivery notes</h5>
            <NavLink to="/tillflow/admin/invoices" className="btn btn-sm btn-outline-primary">
              Invoices
            </NavLink>
          </div>
          {listError ? <div className="alert alert-warning py-2 small">{listError}</div> : null}
          {listLoading ? <p className="text-muted small">Loading...</p> : null}
          <div className="tf-admin-invoice-detail__list-scroll">
            <PrimeDataTable
              column={listSidebarColumns}
              data={listRows}
              rows={listSidebarRows}
              setRows={setListSidebarRows}
              currentPage={listSidebarCurrentPage}
              setCurrentPage={setListSidebarCurrentPage}
              totalRecords={listRows.length}
              loading={listLoading}
              isPaginationEnabled
              sortable={false}
            />
          </div>
          <div className="mt-2">
            <NavLink to="/tillflow/admin/delivery-notes" className="small">
              Full delivery notes list
            </NavLink>
          </div>
        </aside>

        <main className="tf-admin-invoice-detail__main">
          {detailLoading ? <p className="text-muted quotation-view-no-print">Loading delivery note...</p> : null}
          {detailError ? <div className="alert alert-danger quotation-view-no-print">{detailError}</div> : null}
          {!detailLoading && row && viewDoc ? (
            <>
              <div className="tf-admin-invoice-detail__toolbar quotation-view-no-print">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void openPdfPreview()}>
                    View PDF
                  </button>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void downloadPdf()}>
                    Download PDF
                  </button>
                  {row.invoiceId ? (
                    <NavLink to={`/tillflow/admin/invoices/${row.invoiceId}`} className="btn btn-outline-secondary btn-sm">
                      Invoice {row.invoiceRef || row.invoiceId}
                    </NavLink>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={String(row.status) === "Cancelled" || !String(row.customerEmail ?? "").trim()}
                    onClick={() => void openEmailPreview()}>
                    Send to customer
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={String(row.status) === "Cancelled"}
                    onClick={() => setCancelOpen(true)}>
                    Cancel note
                  </button>
                  <span className={`badge ${deliveryStatusBadgeClass(row.status)} badge-xs shadow-none ms-1`}>{row.status}</span>
                </div>
              </div>
              <div className="tf-admin-invoice-detail__doc bg-white rounded border">
                <div className="p-3">
                  <DeliveryNotePrintDocument ref={printRootRef} {...viewDoc} />
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      <Modal show={cancelOpen} onHide={() => setCancelOpen(false)} centered backdrop={actionBusy ? "static" : true}>
        <Modal.Header closeButton={!actionBusy}>
          <Modal.Title>Cancel delivery note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Cancel this delivery note? It will remain on record as cancelled.</p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" disabled={actionBusy} onClick={() => setCancelOpen(false)}>
            Keep note
          </button>
          <button type="button" className="btn btn-danger" disabled={actionBusy} onClick={() => void cancelNote()}>
            {actionBusy ? "Cancelling..." : "Cancel note"}
          </button>
        </Modal.Footer>
      </Modal>

      <DocumentPdfPreviewModal
        url={pdfPreviewUrl}
        title={viewDoc ? `Delivery Note ${viewDoc.noteNo}` : "Delivery Note PDF"}
        onHide={() => {
          setPdfPreviewUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return null;
          });
        }}
      />
      <InvoiceEmailPreviewModal
        show={emailPreviewOpen}
        onHide={() => {
          if (!emailPreviewSending) {
            resetEmailPreview();
          }
        }}
        loading={emailPreviewLoading}
        error={emailPreviewError}
        subject={emailPreviewSubject}
        html={emailPreviewHtml}
        toEmail={emailPreviewTo}
        message={emailPreviewMessage}
        onChangeToEmail={setEmailPreviewTo}
        onChangeSubject={setEmailPreviewSubject}
        onChangeMessage={setEmailPreviewMessage}
        sending={emailPreviewSending}
        sendButtonLabel="Send email"
        showHtmlPreview={false}
        sendDisabled={!row?.apiId || String(row?.status ?? "") === "Cancelled" || !String(emailPreviewTo ?? "").trim()}
        onSend={confirmSendEmail}
      />
      <CommonFooter />
    </div>
  );
}
