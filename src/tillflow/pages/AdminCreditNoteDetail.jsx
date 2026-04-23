import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Link, NavLink, useSearchParams, useParams } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import PrimeDataTable from "../../components/data-table";
import CommonFooter from "../../components/footer/commonFooter";
import CreditNotePrintDocument from "../../feature-module/sales/CreditNotePrintDocument";
import {
  apiCreditNoteToRow,
  buildCreditNoteViewDocumentData,
  creditStatusBadgeClass
} from "../../feature-module/sales/creditNoteViewHelpers";
import {
  createHtmlDocumentPdfObjectUrl,
  htmlDocumentPdfBlobFromElement,
  downloadHtmlDocumentPdfFromElement,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { TillFlowApiError } from "../api/errors";
import {
  cancelCreditNoteRequest,
  listCreditNotesRequest,
  previewCreditNoteEmailRequest,
  sendCreditNoteToCustomerRequest,
  showCreditNoteRequest
} from "../api/creditNotes";
import { useAuth } from "../auth/AuthContext";

export default function AdminCreditNoteDetail() {
  const { creditNoteId } = useParams();
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

  const clearSearchParam = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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

  const loadList = useCallback(async () => {
    if (!token) {
      return;
    }
    setListLoading(true);
    setListError("");
    try {
      const data = await listCreditNotesRequest(token);
      setListRows((data?.credit_notes ?? []).map(apiCreditNoteToRow));
    } catch (e) {
      setListRows([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Could not load credit notes.");
    } finally {
      setListLoading(false);
    }
  }, [token]);

  const loadDetail = useCallback(async () => {
    if (!token || !creditNoteId) {
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await showCreditNoteRequest(token, creditNoteId);
      const note = data?.credit_note ?? null;
      if (!note) {
        setDetailError("Credit note not found.");
        setRow(null);
        return;
      }
      setRow(apiCreditNoteToRow(note));
    } catch (e) {
      setDetailError(e instanceof TillFlowApiError ? e.message : "Could not load credit note.");
      setRow(null);
    } finally {
      setDetailLoading(false);
    }
  }, [token, creditNoteId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!creditNoteId || !listRows.length) {
      return;
    }
    const idx = listRows.findIndex((item) => String(item.apiId) === String(creditNoteId));
    if (idx < 0) {
      return;
    }
    const page = Math.floor(idx / listSidebarRows) + 1;
    setListSidebarCurrentPage(page);
  }, [creditNoteId, listRows, listSidebarRows]);

  const listSidebarColumns = useMemo(
    () => [
      {
        header: "Credit note",
        field: "creditNoteNo",
        body: (item) => (
          <Link to={`/admin/credit-notes/${item.apiId}`} className="fw-medium text-nowrap">
            {item.creditNoteNo}
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
        header: "Amount",
        field: "totalAmountDisplay",
        className: "text-end",
        body: (item) => (
          <span className="small text-end d-block text-nowrap">{item.totalAmountDisplay}</span>
        )
      },
      {
        header: "Status",
        field: "status",
        body: (item) => (
          <span className={`badge ${creditStatusBadgeClass(item.status)} badge-xs shadow-none`}>{item.status}</span>
        )
      }
    ],
    []
  );

  const viewDoc = useMemo(() => (row ? buildCreditNoteViewDocumentData(row) : null), [row]);

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
      const slug = `credit-note-${String(viewDoc.noteNo).replace(/[^\w.-]+/g, "_")}`;
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
        fileSlug: `credit-note-${String(viewDoc.noteNo).replace(/[^\w.-]+/g, "_")}`
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
      const data = await cancelCreditNoteRequest(token, row.apiId);
      const next = data?.credit_note ?? null;
      if (next) {
        setRow(apiCreditNoteToRow(next));
      }
      setCancelOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof TillFlowApiError ? e.message : "Could not cancel credit note.");
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
      const data = await previewCreditNoteEmailRequest(token, row.apiId);
      if (String(data?.to_email ?? "").trim()) {
        setEmailPreviewTo(String(data.to_email).trim());
      }
      setEmailPreviewSubject(String(data?.subject ?? ""));
      setEmailPreviewMessage(String(data?.message_template ?? "Please find your credit note attached."));
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
        fileSlug: `credit-note-${String(row.creditNoteNo ?? row.apiId).replace(/[^\w.-]+/g, "_")}`
      });
      await sendCreditNoteToCustomerRequest(token, row.apiId, {
        pdfBlob,
        attachmentFilename: `credit-note-${String(row.creditNoteNo ?? row.apiId).replace(/[^\w.-]+/g, "_")}.pdf`,
        toEmail: String(emailPreviewTo ?? "").trim(),
        subject: String(emailPreviewSubject ?? "").trim(),
        message: String(emailPreviewMessage ?? "")
      });
      resetEmailPreview();
      showEmailSuccess("Credit note email sent.");
    } catch (e) {
      window.alert(e instanceof TillFlowApiError ? e.message : "Could not send credit note email.");
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
            <h5 className="tf-heading mb-0">Credit notes</h5>
            <NavLink to="/admin/invoices" className="btn btn-sm btn-outline-primary">
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
            <NavLink to="/admin/credit-notes" className="small">
              Full credit notes list
            </NavLink>
          </div>
        </aside>

        <main className="tf-admin-invoice-detail__main">
          {detailLoading ? <p className="text-muted quotation-view-no-print">Loading credit note...</p> : null}
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
                    <NavLink to={`/admin/invoices/${row.invoiceId}`} className="btn btn-outline-secondary btn-sm">
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
                  <span className={`badge ${creditStatusBadgeClass(row.status)} badge-xs shadow-none ms-1`}>{row.status}</span>
                </div>
              </div>
              <div className="tf-admin-invoice-detail__doc bg-white rounded border">
                <div className="p-3">
                  <CreditNotePrintDocument ref={printRootRef} {...viewDoc} />
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      <Modal show={cancelOpen} onHide={() => setCancelOpen(false)} centered backdrop={actionBusy ? "static" : true}>
        <Modal.Header closeButton={!actionBusy}>
          <Modal.Title>Cancel credit note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Cancel this credit note? It will remain on record as cancelled.</p>
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
        title={viewDoc ? `Credit Note ${viewDoc.noteNo}` : "Credit Note PDF"}
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

