import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import InvoicePrintDocument from "../../feature-module/sales/InvoicePrintDocument";
import DeliveryNoteCreateModal from "../../feature-module/sales/DeliveryNoteCreateModal";
import CreditNoteCreateModal from "../../feature-module/sales/CreditNoteCreateModal";
import {
  apiInvoiceToRow,
  buildInvoiceCloneCreateBody,
  buildInvoiceViewDocumentData,
  formatInvoiceMoneyKes,
  formatReceiptPaidAtDisplay,
  invoiceSentToCustomerHoverTitle,
  invoiceStatusBadgeClass,
  invoiceWasIssuedToCustomer,
  receiptWasSentToCustomer,
  taxTotalFromInvoiceLineItems
} from "../../feature-module/sales/invoiceViewHelpers";
import {
  apiDeliveryNoteToRow,
  deliveryStatusBadgeClass,
  invoiceDeliveryStatusLabel
} from "../../feature-module/sales/deliveryNoteViewHelpers";
import { apiCreditNoteToRow, creditStatusBadgeClass } from "../../feature-module/sales/creditNoteViewHelpers";
import {
  EditInvoicePaymentModal,
  InvoiceReceiptPreviewModal,
  RecordInvoicePaymentModal
} from "../../feature-module/sales/InvoicePaymentModals";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import PrimeDataTable from "../../components/data-table";
import {
  createHtmlDocumentPdfObjectUrl,
  downloadHtmlDocumentPdfFromElement,
  htmlDocumentPdfBlobFromElement,
  openHtmlDocumentPdfInBrowser,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { listCustomersRequest } from "../api/customers";
import { TillFlowApiError } from "../api/errors";
import {
  createInvoicePaymentRequest,
  paymentMethodLabel,
  previewInvoicePaymentReceiptEmailRequest,
  sendInvoicePaymentReceiptToCustomerRequest,
  updateInvoicePaymentRequest
} from "../api/invoicePayments";
import {
  cancelInvoiceRequest,
  createInvoiceRequest,
  listInvoicesRequest,
  previewInvoiceEmailRequest,
  restoreInvoiceRequest,
  sendInvoiceToCustomerRequest,
  showInvoiceRequest,
  updateInvoiceRequest
} from "../api/invoices";
import { createInvoiceDeliveryNoteRequest, listInvoiceDeliveryNotesRequest } from "../api/deliveryNotes";
import { createInvoiceCreditNoteRequest, listInvoiceCreditNotesRequest } from "../api/creditNotes";
import { useOptionalAuth } from "../auth/AuthContext";
import { PERMISSION } from "../auth/permissions";
import ActivityLogModal from "../components/ActivityLogModal";
import { roundMoney } from "../../utils/salesDocumentLineItems";

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

export default function AdminInvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useOptionalAuth();
  const token = auth?.token ?? null;
  const canViewActivityLog = Boolean(auth?.hasPermission?.(PERMISSION.ACTIVITY_LOGS_VIEW));

  const paymentsSectionRef = useRef(null);
  const paymentsHintTimerRef = useRef(null);
  const printRootRef = useRef(null);
  const receiptPrintRootRef = useRef(null);

  const [listRows, setListRows] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listSidebarRows, setListSidebarRows] = useState(10);
  const [listSidebarCurrentPage, setListSidebarCurrentPage] = useState(1);

  const [detailRow, setDetailRow] = useState(null);
  const [rawInvoice, setRawInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  const [customers, setCustomers] = useState([]);

  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [placeholder, setPlaceholder] = useState(null);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [paymentsHint, setPaymentsHint] = useState("");

  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [recordPayTarget, setRecordPayTarget] = useState(null);
  const [recordPayAmount, setRecordPayAmount] = useState("");
  const [recordPayMethod, setRecordPayMethod] = useState("cash");
  const [recordPayPaidAt, setRecordPayPaidAt] = useState("");
  const [recordPayTransactionId, setRecordPayTransactionId] = useState("");
  const [recordPayNotes, setRecordPayNotes] = useState("");
  const [recordPayError, setRecordPayError] = useState("");
  const [recordPaySaving, setRecordPaySaving] = useState(false);

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptPreviewRow, setReceiptPreviewRow] = useState(null);

  const [viewPayEdit, setViewPayEdit] = useState(null);
  const [viewPayEditAmount, setViewPayEditAmount] = useState("");
  const [viewPayEditMethod, setViewPayEditMethod] = useState("cash");
  const [viewPayEditPaidAt, setViewPayEditPaidAt] = useState("");
  const [viewPayEditTransactionId, setViewPayEditTransactionId] = useState("");
  const [viewPayEditNotes, setViewPayEditNotes] = useState("");
  const [viewPayEditError, setViewPayEditError] = useState("");
  const [viewPayEditSaving, setViewPayEditSaving] = useState(false);

  const [actionBusy, setActionBusy] = useState("");
  const [showCancelInvoiceModal, setShowCancelInvoiceModal] = useState(false);
  const [showRestoreInvoiceModal, setShowRestoreInvoiceModal] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [deliveryNotesLoading, setDeliveryNotesLoading] = useState(false);
  const [deliveryNotesError, setDeliveryNotesError] = useState("");
  const [showCreateDeliveryNote, setShowCreateDeliveryNote] = useState(false);
  const [createDeliveryNoteSaving, setCreateDeliveryNoteSaving] = useState(false);
  const [createDeliveryNoteError, setCreateDeliveryNoteError] = useState("");
  const [creditNotes, setCreditNotes] = useState([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);
  const [creditNotesError, setCreditNotesError] = useState("");
  const [showCreateCreditNote, setShowCreateCreditNote] = useState(false);
  const [createCreditNoteSaving, setCreateCreditNoteSaving] = useState(false);
  const [createCreditNoteError, setCreateCreditNoteError] = useState("");
  const [invoiceEmailPreviewOpen, setInvoiceEmailPreviewOpen] = useState(false);
  const [invoiceEmailPreviewSubject, setInvoiceEmailPreviewSubject] = useState("");
  const [invoiceEmailPreviewHtml, setInvoiceEmailPreviewHtml] = useState("");
  const [invoiceEmailPreviewTo, setInvoiceEmailPreviewTo] = useState("");
  const [invoiceEmailPreviewMessage, setInvoiceEmailPreviewMessage] = useState("");
  const [invoiceEmailPreviewLoading, setInvoiceEmailPreviewLoading] = useState(false);
  const [invoiceEmailPreviewError, setInvoiceEmailPreviewError] = useState("");
  const [invoiceEmailPreviewSending, setInvoiceEmailPreviewSending] = useState(false);
  const [invoiceEmailPreviewSource, setInvoiceEmailPreviewSource] = useState("invoice");
  const [invoiceEmailPreviewPaymentId, setInvoiceEmailPreviewPaymentId] = useState(null);
  const [invoicePdfPreviewUrl, setInvoicePdfPreviewUrl] = useState(null);
  const [invoiceEmailSuccessMessage, setInvoiceEmailSuccessMessage] = useState("");
  const invoiceEmailSuccessTimerRef = useRef(null);

  const viewDoc = useMemo(() => (detailRow ? buildInvoiceViewDocumentData(detailRow) : null), [detailRow]);
  const activityLogInvoiceId = useMemo(() => {
    const raw = rawInvoice?.id ?? detailRow?.apiId ?? invoiceId;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rawInvoice?.id, detailRow?.apiId, invoiceId]);
  const listSidebarColumns = useMemo(
    () => [
      {
        header: "Invoice",
        field: "invoiceno",
        body: (r) => (
          <Link to={`/tillflow/admin/invoices/${r.apiId ?? r.id}`} className="fw-medium text-nowrap">
            {r.invoiceno}
          </Link>
        )
      },
      {
        header: "Customer",
        field: "customer",
        body: (r) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 120 }} title={r.customer}>
            {r.customer}
          </span>
        )
      },
      {
        header: "Amount",
        field: "amount",
        className: "text-end",
        body: (r) => <span className="small text-end d-block text-nowrap">{r.amount}</span>
      },
      {
        header: "Status",
        field: "status",
        body: (r) => (
          <span className={`badge ${invoiceStatusBadgeClass(r.status)} badge-xs shadow-none`}>
            {String(r.status ?? "").replace(/_/g, " ")}
          </span>
        )
      }
    ],
    []
  );

  const isCancelled = String(detailRow?.status ?? "") === "Cancelled";
  const isDraftInvoice = String(detailRow?.status ?? "") === "Draft";
  const deliveryStatus = invoiceDeliveryStatusLabel(detailRow);
  const invoiceFullyDelivered = deliveryStatus === "Fully delivered";
  const hasPayments = (detailRow?.payments ?? []).length > 0;
  const hasGeneratedDeliveryNote = deliveryNotes.length > 0;
  const hasGeneratedCreditNote = creditNotes.length > 0;
  const generateDeliveryDisabled =
    isCancelled || isDraftInvoice || !detailRow?.apiId || invoiceFullyDelivered || hasGeneratedDeliveryNote;
  const generateDeliveryTitle = hasGeneratedDeliveryNote
    ? "A delivery note is already generated for this invoice."
    : invoiceFullyDelivered
      ? "All quantities from this invoice are already delivered."
      : "Generate a delivery note from invoice quantities";
  const generateCreditNoteDisabled = isCancelled || isDraftInvoice || !detailRow?.apiId;
  const generateCreditNoteTitle = isCancelled
    ? "Cancelled invoices cannot generate credit notes."
    : isDraftInvoice
      ? "Draft invoices cannot generate credit notes."
      : "Generate a credit note from invoice quantities";
  const generateActionsDisabled = generateDeliveryDisabled && generateCreditNoteDisabled;
  const sendToCustomerIssued = detailRow ? invoiceWasIssuedToCustomer(detailRow) : false;
  const sendToCustomerButtonClass = sendToCustomerIssued
    ? "btn-outline-danger"
    : isDraftInvoice && String(detailRow?.customerEmail ?? "").trim()
      ? "tf-invoice-btn-send-customer"
      : "btn-outline-secondary";

  useEffect(() => {
    return () => {
      if (invoiceEmailSuccessTimerRef.current) {
        window.clearTimeout(invoiceEmailSuccessTimerRef.current);
      }
    };
  }, []);

  const showInvoiceEmailSuccess = useCallback((message) => {
    setInvoiceEmailSuccessMessage(String(message ?? "").trim());
    if (invoiceEmailSuccessTimerRef.current) {
      window.clearTimeout(invoiceEmailSuccessTimerRef.current);
    }
    invoiceEmailSuccessTimerRef.current = window.setTimeout(() => {
      setInvoiceEmailSuccessMessage("");
      invoiceEmailSuccessTimerRef.current = null;
    }, 4500);
  }, []);

  const loadList = useCallback(async () => {
    if (!token) {
      return;
    }
    setListLoading(true);
    setListError("");
    try {
      const data = await listInvoicesRequest(token);
      const apiRows = (data.invoices ?? []).map(apiInvoiceToRow);
      setListRows(apiRows);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError("Could not load invoices.");
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

  const loadDetail = useCallback(async () => {
    if (!token || !invoiceId) {
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await showInvoiceRequest(token, invoiceId);
      if (data?.invoice) {
        setRawInvoice(data.invoice);
        const row = enrichCustomerRow(apiInvoiceToRow(data.invoice), customers);
        setDetailRow(row);
        setNotesDraft(String(row.notes ?? ""));
      } else {
        setDetailError("Invoice not found.");
      }
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setDetailError(e.message);
      } else {
        setDetailError("Could not load invoice.");
      }
      setDetailRow(null);
      setRawInvoice(null);
    } finally {
      setDetailLoading(false);
    }
  }, [token, invoiceId, customers]);

  const loadDeliveryNotes = useCallback(async () => {
    if (!token || !invoiceId) {
      return;
    }
    setDeliveryNotesLoading(true);
    setDeliveryNotesError("");
    try {
      const data = await listInvoiceDeliveryNotesRequest(token, invoiceId);
      const notes = (data?.delivery_notes ?? data?.notes ?? []).map(apiDeliveryNoteToRow);
      setDeliveryNotes(notes);
    } catch (e) {
      setDeliveryNotes([]);
      if (e instanceof TillFlowApiError) {
        setDeliveryNotesError(e.message);
      } else {
        setDeliveryNotesError("Could not load delivery notes.");
      }
    } finally {
      setDeliveryNotesLoading(false);
    }
  }, [token, invoiceId]);

  const loadCreditNotes = useCallback(async () => {
    if (!token || !invoiceId) {
      return;
    }
    setCreditNotesLoading(true);
    setCreditNotesError("");
    try {
      const data = await listInvoiceCreditNotesRequest(token, invoiceId);
      const notes = (data?.credit_notes ?? data?.notes ?? []).map(apiCreditNoteToRow);
      setCreditNotes(notes);
    } catch (e) {
      setCreditNotes([]);
      if (e instanceof TillFlowApiError) {
        setCreditNotesError(e.message);
      } else {
        setCreditNotesError("Could not load credit notes.");
      }
    } finally {
      setCreditNotesLoading(false);
    }
  }, [token, invoiceId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadDeliveryNotes();
  }, [loadDeliveryNotes]);

  useEffect(() => {
    void loadCreditNotes();
  }, [loadCreditNotes]);

  const mergeRowIntoList = useCallback((inv) => {
    if (!inv?.apiId) {
      return;
    }
    setListRows((prev) => {
      const next = prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? { ...inv, id: String(inv.id) } : r));
      if (!next.some((r) => String(r.apiId) === String(inv.apiId))) {
        return [{ ...inv, id: String(inv.id) }, ...next];
      }
      return next;
    });
    setDetailRow((prev) =>
      prev && String(prev.apiId) === String(inv.apiId)
        ? { ...prev, ...inv, invoiceTitle: prev.invoiceTitle || inv.invoiceTitle }
        : prev
    );
    setNotesDraft(String(inv.notes ?? ""));
  }, []);

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
  }, [invoiceId]);

  const handleViewPdfPreview = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`;
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
  }, [viewDoc]);

  const handleViewPdfNewTab = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await openHtmlDocumentPdfInBrowser(root, {
        fileSlug: `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === "POPUP_BLOCKED") {
        window.alert("Your browser blocked the new tab. Allow pop-ups for this site or use View PDF.");
        return;
      }
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewDoc]);

  const handleDownloadPdf = useCallback(async () => {
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
        fileSlug: `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewDoc]);

  const handleDownloadReceiptPdf = useCallback(async () => {
    if (!receiptPreview || !receiptPreviewRow) {
      return;
    }
    const root = receiptPrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `receipt-${String(receiptPreview.receipt_ref ?? "").replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [receiptPreview, receiptPreviewRow]);

  const resetInvoiceEmailPreview = useCallback(() => {
    setInvoiceEmailPreviewOpen(false);
    setInvoiceEmailPreviewSubject("");
    setInvoiceEmailPreviewHtml("");
    setInvoiceEmailPreviewTo("");
    setInvoiceEmailPreviewMessage("");
    setInvoiceEmailPreviewLoading(false);
    setInvoiceEmailPreviewError("");
    setInvoiceEmailPreviewSending(false);
    setInvoiceEmailPreviewSource("invoice");
    setInvoiceEmailPreviewPaymentId(null);
  }, []);

  const openSendInvoiceEmailPreview = useCallback(async (source = "invoice") => {
    if (!token || !detailRow?.apiId || String(detailRow.status ?? "") === "Cancelled") {
      return;
    }
    if (!String(detailRow.customerEmail ?? "").trim()) {
      window.alert("Add an email to the customer before sending.");
      return;
    }
    setInvoiceEmailPreviewSubject("");
    setInvoiceEmailPreviewHtml("");
    setInvoiceEmailPreviewTo(String(detailRow.customerEmail ?? "").trim());
    setInvoiceEmailPreviewMessage("");
    setInvoiceEmailPreviewError("");
    setInvoiceEmailPreviewOpen(true);
    setInvoiceEmailPreviewSource(source === "receipt" ? "receipt" : "invoice");
    setInvoiceEmailPreviewLoading(true);
    try {
      const data = await previewInvoiceEmailRequest(token, detailRow.apiId);
      setInvoiceEmailPreviewSubject(String(data?.subject ?? ""));
      setInvoiceEmailPreviewHtml(String(data?.html ?? ""));
      if (String(data?.to_email ?? "").trim()) {
        setInvoiceEmailPreviewTo(String(data.to_email).trim());
      }
      setInvoiceEmailPreviewMessage(String(data?.message_template ?? "Please find your invoice below."));
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setInvoiceEmailPreviewError(e.message);
      } else {
        setInvoiceEmailPreviewError("Could not load email preview.");
      }
    } finally {
      setInvoiceEmailPreviewLoading(false);
    }
  }, [token, detailRow?.apiId, detailRow?.status, detailRow?.customerEmail]);

  const handleSendReceiptToCustomer = useCallback(async () => {
    if (!token || !detailRow?.apiId || isCancelled || !String(detailRow.customerEmail ?? "").trim() || !receiptPreview?.id) {
      return;
    }
    try {
      setInvoiceEmailPreviewSubject("");
      setInvoiceEmailPreviewHtml("");
      setInvoiceEmailPreviewTo(String(detailRow.customerEmail ?? "").trim());
      setInvoiceEmailPreviewMessage("");
      setInvoiceEmailPreviewError("");
      setInvoiceEmailPreviewOpen(true);
      setInvoiceEmailPreviewSource("receipt");
      setInvoiceEmailPreviewPaymentId(receiptPreview.id);
      setInvoiceEmailPreviewLoading(true);
      const data = await previewInvoicePaymentReceiptEmailRequest(token, receiptPreview.id);
      setInvoiceEmailPreviewSubject(String(data?.subject ?? ""));
      setInvoiceEmailPreviewHtml(String(data?.html ?? ""));
      if (String(data?.to_email ?? "").trim()) {
        setInvoiceEmailPreviewTo(String(data.to_email).trim());
      }
      setInvoiceEmailPreviewMessage(String(data?.message_template ?? "Please find your payment receipt details below."));
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setInvoiceEmailPreviewError(e.message);
      } else {
        setInvoiceEmailPreviewError("Could not load receipt email preview.");
      }
    } finally {
      setInvoiceEmailPreviewLoading(false);
    }
  }, [token, detailRow, isCancelled, receiptPreview?.id]);

  const confirmSendInvoiceFromPreview = useCallback(async () => {
    if (!token || !detailRow?.apiId || String(detailRow.status ?? "") === "Cancelled") {
      return;
    }
    const wasResend = invoiceWasIssuedToCustomer(detailRow);
    setInvoiceEmailPreviewSending(true);
    try {
      if (invoiceEmailPreviewSource === "receipt") {
        const paymentId = invoiceEmailPreviewPaymentId;
        if (!paymentId) {
          throw new Error("Missing receipt payment id.");
        }
        const data = await sendInvoicePaymentReceiptToCustomerRequest(token, detailRow.apiId, paymentId, {
          toEmail: String(invoiceEmailPreviewTo ?? "").trim(),
          subject: String(invoiceEmailPreviewSubject ?? "").trim(),
          message: String(invoiceEmailPreviewMessage ?? "")
        });
        if (data?.payment?.id) {
          const sentPay = data.payment;
          setReceiptPreview((prev) => (prev && String(prev.id) === String(sentPay.id) ? { ...prev, ...sentPay } : prev));
          setDetailRow((prev) => {
            if (!prev) {
              return prev;
            }
            const nextPayments = Array.isArray(prev.payments)
              ? prev.payments.map((p) => (String(p.id) === String(sentPay.id) ? { ...p, ...sentPay } : p))
              : prev.payments;
            return { ...prev, payments: nextPayments };
          });
        }
        const msg = String(data?.message ?? "").trim() || "Receipt was sent to the customer.";
        showInvoiceEmailSuccess(msg);
        resetInvoiceEmailPreview();
        return;
      }
      let pdfBlob = null;
      const useClientPdf = invoiceWasIssuedToCustomer(detailRow);
      if (useClientPdf && typeof document !== "undefined") {
        try {
          const enriched = enrichCustomerRow(detailRow, customers);
          const viewDocSend = buildInvoiceViewDocumentData(enriched);
          const host = document.createElement("div");
          host.setAttribute("aria-hidden", "true");
          Object.assign(host.style, {
            position: "fixed",
            left: "-9999px",
            top: "0",
            width: "794px",
            zIndex: "-1",
            pointerEvents: "none",
            opacity: "0",
            overflow: "hidden"
          });
          document.body.appendChild(host);
          const reactRoot = createRoot(host);
          let printEl = null;
          flushSync(() => {
            reactRoot.render(
              <InvoicePrintDocument
                ref={(el) => {
                  printEl = el;
                }}
                {...viewDocSend}
              />
            );
          });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (printEl) {
            await waitForPrintRootImages(printEl);
            await new Promise((r) => setTimeout(r, 120));
            pdfBlob = await htmlDocumentPdfBlobFromElement(printEl, {
              fileSlug: `invoice-${String(enriched.invoiceno ?? enriched.apiId ?? "inv").replace(/[^\w.-]+/g, "_")}`
            });
          }
          reactRoot.unmount();
          document.body.removeChild(host);
        } catch (e) {
          console.warn("Client PDF for email failed; server Dompdf will be used.", e);
          pdfBlob = null;
        }
      }

      const attachFilename = `invoice-${String(detailRow.invoiceRefStored ?? detailRow.invoiceno ?? detailRow.apiId ?? "invoice").replace(/[^\w.-]+/g, "_")}.pdf`;

      const data = await sendInvoiceToCustomerRequest(token, detailRow.apiId, {
        pdfBlob: pdfBlob instanceof Blob ? pdfBlob : undefined,
        attachmentFilename: attachFilename,
        toEmail: String(invoiceEmailPreviewTo ?? "").trim(),
        subject: String(invoiceEmailPreviewSubject ?? "").trim(),
        message: String(invoiceEmailPreviewMessage ?? "")
      });
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        const rowOut = {
          ...inv,
          id: String(inv.id),
          taxNum: taxTotalFromInvoiceLineItems(inv.items),
          ...(invoiceEmailPreviewSource === "invoice"
            ? {
                sentToCustomerAt: inv.sentToCustomerAt || new Date().toISOString(),
                emailSentConfirmed: true
              }
            : {
                sentToCustomerAt: detailRow?.sentToCustomerAt ?? null,
                emailSentConfirmed: Boolean(detailRow?.emailSentConfirmed)
              })
        };
        mergeRowIntoList(rowOut);
        setRawInvoice(data.invoice);
      }
      const apiMsg = String(data?.message ?? "").trim();
      const fallback = wasResend
        ? "Invoice email was resent to the customer."
        : "Invoice was sent to the customer.";
      showInvoiceEmailSuccess(apiMsg || fallback);
      resetInvoiceEmailPreview();
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        window.alert(e.message);
      } else {
        window.alert("Could not send invoice email.");
      }
    } finally {
      setInvoiceEmailPreviewSending(false);
    }
  }, [
    token,
    detailRow,
    invoiceEmailPreviewTo,
    invoiceEmailPreviewSubject,
    invoiceEmailPreviewMessage,
    invoiceEmailPreviewSource,
    invoiceEmailPreviewPaymentId,
    customers,
    mergeRowIntoList,
    resetInvoiceEmailPreview,
    showInvoiceEmailSuccess
  ]);

  const scrollToPayments = useCallback(() => {
    paymentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    return () => {
      if (paymentsHintTimerRef.current) {
        window.clearTimeout(paymentsHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPaymentsHint("");
    if (paymentsHintTimerRef.current) {
      window.clearTimeout(paymentsHintTimerRef.current);
      paymentsHintTimerRef.current = null;
    }
  }, [invoiceId]);

  useEffect(() => {
    if ((detailRow?.payments ?? []).length > 0) {
      setPaymentsHint("");
      if (paymentsHintTimerRef.current) {
        window.clearTimeout(paymentsHintTimerRef.current);
        paymentsHintTimerRef.current = null;
      }
    }
  }, [detailRow?.payments, detailRow?.apiId]);

  const handlePaymentsDropdown = useCallback(
    (mode) => {
      if (!detailRow?.apiId || String(detailRow.status ?? "") === "Cancelled") {
        return;
      }
      if (String(detailRow.status ?? "") === "Draft") {
        setPlaceholder({
          title: "Payments",
          body: "This invoice is still a draft. Payments can be recorded after it is no longer in Draft status."
        });
        return;
      }
      if (paymentsHintTimerRef.current) {
        window.clearTimeout(paymentsHintTimerRef.current);
        paymentsHintTimerRef.current = null;
      }
      scrollToPayments();
      const hasPayments = (detailRow.payments ?? []).length > 0;
      if (!hasPayments) {
        setPaymentsHint(
          mode === "update"
            ? "There are no payments on this invoice yet. Use Record payment in the Payments menu first."
            : "No payments have been recorded on this invoice yet. Use Record payment in the Payments menu above."
        );
        paymentsHintTimerRef.current = window.setTimeout(() => {
          setPaymentsHint("");
          paymentsHintTimerRef.current = null;
        }, 12000);
      } else {
        setPaymentsHint("");
      }
    },
    [detailRow, scrollToPayments]
  );

  const openRecordPayment = useCallback(() => {
    const row = detailRow;
    if (!row?.apiId) {
      return;
    }
    setRecordPayTarget(row);
    const due = Math.max(0, roundMoney(Number(row.totalNum ?? 0) - Number(row.paidNum ?? 0)));
    setRecordPayAmount(due > 0 ? String(due) : "");
    setRecordPayMethod("cash");
    setRecordPayPaidAt(
      typeof window !== "undefined"
        ? new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : ""
    );
    setRecordPayTransactionId("");
    setRecordPayNotes("");
    setRecordPayError("");
    setShowRecordPayment(true);
  }, [detailRow]);

  const handleRecordPaymentFromMenu = useCallback(() => {
    if (!detailRow?.apiId || String(detailRow.status ?? "") === "Cancelled") {
      return;
    }
    if (String(detailRow.status ?? "") === "Draft") {
      setPlaceholder({
        title: "Payments",
        body: "This invoice is still a draft. Payments can be recorded after it is no longer in Draft status."
      });
      return;
    }
    openRecordPayment();
  }, [detailRow, openRecordPayment]);

  const clearSearchParam = useCallback(
    (key) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(key);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (searchParams.get("recordPayment") !== "1" || !detailRow?.apiId) {
      return;
    }
    if (String(detailRow.status ?? "") === "Cancelled") {
      clearSearchParam("recordPayment");
      return;
    }
    if (String(detailRow.status ?? "") === "Draft") {
      setPlaceholder({
        title: "Payments",
        body: "This invoice is still a draft. Payments can be recorded after it is no longer in Draft status."
      });
      clearSearchParam("recordPayment");
      return;
    }
    openRecordPayment();
    clearSearchParam("recordPayment");
  }, [detailRow?.apiId, detailRow?.status, searchParams, openRecordPayment, clearSearchParam]);

  useEffect(() => {
    if (searchParams.get("emailCustomer") !== "1" || !detailRow?.apiId) {
      return;
    }
    if (String(detailRow.status ?? "") === "Cancelled") {
      clearSearchParam("emailCustomer");
      return;
    }
    if (!String(detailRow.customerEmail ?? "").trim()) {
      window.alert("Add an email to the customer before sending.");
      clearSearchParam("emailCustomer");
      return;
    }
    void openSendInvoiceEmailPreview();
    clearSearchParam("emailCustomer");
  }, [detailRow?.apiId, detailRow?.status, detailRow?.customerEmail, searchParams, openSendInvoiceEmailPreview, clearSearchParam]);

  useEffect(() => {
    if (searchParams.get("generateDelivery") !== "1" || !detailRow?.apiId) {
      return;
    }
    if (String(detailRow.status ?? "") === "Cancelled" || String(detailRow.status ?? "") === "Draft") {
      clearSearchParam("generateDelivery");
      return;
    }
    setCreateDeliveryNoteError("");
    setShowCreateDeliveryNote(true);
    clearSearchParam("generateDelivery");
  }, [detailRow?.apiId, detailRow?.status, searchParams, clearSearchParam]);

  useEffect(() => {
    if (searchParams.get("generateCreditNote") !== "1" || !detailRow?.apiId) {
      return;
    }
    if (String(detailRow.status ?? "") === "Cancelled" || String(detailRow.status ?? "") === "Draft") {
      clearSearchParam("generateCreditNote");
      return;
    }
    setCreateCreditNoteError("");
    setShowCreateCreditNote(true);
    clearSearchParam("generateCreditNote");
  }, [detailRow?.apiId, detailRow?.status, searchParams, clearSearchParam]);

  const submitRecordPayment = useCallback(async () => {
    if (!token || !recordPayTarget?.apiId) {
      return;
    }
    setRecordPaySaving(true);
    setRecordPayError("");
    try {
      const amt = roundMoney(Math.max(0.01, Number(String(recordPayAmount).replace(/,/g, "")) || 0));
      const data = await createInvoicePaymentRequest(token, recordPayTarget.apiId, {
        amount: amt,
        payment_method: recordPayMethod,
        paid_at: recordPayPaidAt ? new Date(recordPayPaidAt).toISOString() : undefined,
        transaction_id: recordPayTransactionId.trim() || undefined,
        notes: recordPayNotes.trim() || undefined
      });
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        mergeRowIntoList(inv);
        setRawInvoice(data.invoice);
      }
      if (data?.payment) {
        setReceiptPreview(data.payment);
        setReceiptPreviewRow(recordPayTarget);
      }
      setShowRecordPayment(false);
      setRecordPayTarget(null);
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setRecordPayError(err.message);
      } else {
        setRecordPayError("Could not record payment.");
      }
    } finally {
      setRecordPaySaving(false);
    }
  }, [
    token,
    recordPayTarget,
    recordPayAmount,
    recordPayMethod,
    recordPayPaidAt,
    recordPayTransactionId,
    recordPayNotes,
    customers,
    mergeRowIntoList
  ]);

  const openViewPaymentEdit = useCallback((pay) => {
    if (!detailRow?.apiId || !pay?.id) {
      return;
    }
    setViewPayEdit(pay);
    setViewPayEditAmount(String(pay.amount ?? ""));
    setViewPayEditMethod(String(pay.payment_method ?? "cash"));
    const iso = pay.paid_at ? String(pay.paid_at) : "";
    setViewPayEditPaidAt(iso ? iso.slice(0, 16) : "");
    setViewPayEditTransactionId(String(pay.transaction_id ?? ""));
    setViewPayEditNotes(String(pay.notes ?? ""));
    setViewPayEditError("");
  }, [detailRow?.apiId]);

  const submitViewPaymentEdit = useCallback(async () => {
    if (!token || !detailRow?.apiId || !viewPayEdit?.id) {
      return;
    }
    setViewPayEditSaving(true);
    setViewPayEditError("");
    try {
      const data = await updateInvoicePaymentRequest(token, detailRow.apiId, viewPayEdit.id, {
        amount: Number(String(viewPayEditAmount).replace(/,/g, "")) || 0,
        payment_method: viewPayEditMethod,
        paid_at: viewPayEditPaidAt ? new Date(viewPayEditPaidAt).toISOString() : undefined,
        transaction_id: viewPayEditTransactionId.trim() || null,
        notes: viewPayEditNotes.trim() || null
      });
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        mergeRowIntoList(inv);
        setRawInvoice(data.invoice);
      }
      setViewPayEdit(null);
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setViewPayEditError(err.message);
      } else {
        setViewPayEditError("Could not update payment.");
      }
    } finally {
      setViewPayEditSaving(false);
    }
  }, [
    token,
    detailRow?.apiId,
    viewPayEdit?.id,
    viewPayEditAmount,
    viewPayEditMethod,
    viewPayEditPaidAt,
    viewPayEditTransactionId,
    viewPayEditNotes,
    customers,
    mergeRowIntoList
  ]);

  const saveNotes = useCallback(async () => {
    if (!token || !detailRow?.apiId) {
      return;
    }
    setNotesSaving(true);
    try {
      const data = await updateInvoiceRequest(token, detailRow.apiId, { notes: notesDraft.trim() || null });
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        mergeRowIntoList(inv);
        setRawInvoice(data.invoice);
      }
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        window.alert(e.message);
      } else {
        window.alert("Could not save notes.");
      }
    } finally {
      setNotesSaving(false);
    }
  }, [token, detailRow?.apiId, notesDraft, customers, mergeRowIntoList]);

  const submitCreateDeliveryNote = useCallback(
    async (payload) => {
      if (!token || !detailRow?.apiId) {
        return;
      }
      setCreateDeliveryNoteSaving(true);
      setCreateDeliveryNoteError("");
      try {
        await createInvoiceDeliveryNoteRequest(token, detailRow.apiId, payload);
        setShowCreateDeliveryNote(false);
        await loadDeliveryNotes();
        await loadDetail();
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setCreateDeliveryNoteError(e.message);
        } else {
          setCreateDeliveryNoteError("Could not generate delivery note.");
        }
      } finally {
        setCreateDeliveryNoteSaving(false);
      }
    },
    [token, detailRow?.apiId, loadDeliveryNotes, loadDetail]
  );

  const submitCreateCreditNote = useCallback(
    async (payload) => {
      if (!token || !detailRow?.apiId) {
        return;
      }
      setCreateCreditNoteSaving(true);
      setCreateCreditNoteError("");
      try {
        await createInvoiceCreditNoteRequest(token, detailRow.apiId, payload);
        setShowCreateCreditNote(false);
        await loadCreditNotes();
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setCreateCreditNoteError(e.message);
        } else {
          setCreateCreditNoteError("Could not generate credit note.");
        }
      } finally {
        setCreateCreditNoteSaving(false);
      }
    },
    [token, detailRow?.apiId, loadCreditNotes]
  );

  const handleClone = useCallback(async () => {
    if (!token || !rawInvoice) {
      return;
    }
    setActionBusy("clone");
    try {
      const body = buildInvoiceCloneCreateBody(rawInvoice);
      const data = await createInvoiceRequest(token, body);
      const newInv = data?.invoice;
      if (newInv?.id) {
        await loadList();
        navigate(`/tillflow/admin/invoices/${newInv.id}`, { replace: false });
      }
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        window.alert(e.message);
      } else {
        window.alert("Could not clone invoice.");
      }
    } finally {
      setActionBusy("");
    }
  }, [token, rawInvoice, navigate, loadList]);

  const confirmCancelInvoice = useCallback(async () => {
    if (!token || !detailRow?.apiId || String(detailRow?.status ?? "") === "Draft") {
      return;
    }
    setActionBusy("cancel");
    try {
      const data = await cancelInvoiceRequest(token, detailRow.apiId);
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        mergeRowIntoList(inv);
        setRawInvoice(data.invoice);
      }
      setShowCancelInvoiceModal(false);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        window.alert(e.message);
      } else {
        window.alert("Could not cancel invoice.");
      }
    } finally {
      setActionBusy("");
    }
  }, [token, detailRow?.apiId, detailRow?.status, customers, mergeRowIntoList]);

  const confirmRestoreInvoice = useCallback(async () => {
    if (!token || !detailRow?.apiId || String(detailRow?.status ?? "") !== "Cancelled") {
      return;
    }
    setActionBusy("restore");
    try {
      const data = await restoreInvoiceRequest(token, detailRow.apiId);
      const inv = data?.invoice ? enrichCustomerRow(apiInvoiceToRow(data.invoice), customers) : null;
      if (inv) {
        mergeRowIntoList(inv);
        setRawInvoice(data.invoice);
      }
      setShowRestoreInvoiceModal(false);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        window.alert(e.message);
      } else {
        window.alert("Could not restore invoice.");
      }
    } finally {
      setActionBusy("");
    }
  }, [token, detailRow?.apiId, detailRow?.status, customers, mergeRowIntoList]);

  const placeholderBody =
    "This feature is not implemented yet. It needs backend support (e.g. mail, tracking tables, or credits).";

  if (!token) {
    return (
      <div className="page-wrapper p-4">
        <p className="text-muted mb-0">Sign in to view invoices.</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper tf-admin-invoice-detail">
      {invoiceEmailSuccessMessage ? (
        <div
          className="position-fixed top-0 end-0 p-3 quotation-view-no-print"
          style={{ zIndex: 2000, minWidth: 280, maxWidth: 420 }}>
          <div className="alert alert-success shadow-sm mb-0 d-flex align-items-center justify-content-between gap-2">
            <span>{invoiceEmailSuccessMessage}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setInvoiceEmailSuccessMessage("")}
            />
          </div>
        </div>
      ) : null}
      <div className="tf-admin-invoice-detail__layout">
        <aside className="tf-admin-invoice-detail__list">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <h5 className="tf-heading mb-0">Invoices</h5>
            <NavLink to="/tillflow/admin/invoices/new" className="btn btn-sm btn-outline-primary">
              New
            </NavLink>
          </div>
          {listError ? <div className="alert alert-warning py-2 small">{listError}</div> : null}
          {listLoading ? <p className="text-muted small">Loading…</p> : null}
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
            />
          </div>
          <div className="mt-2">
            <NavLink to="/tillflow/admin/invoices" className="small">
              Full invoice list
            </NavLink>
          </div>
        </aside>

        <main className="tf-admin-invoice-detail__main">
          {detailLoading ? (
            <p className="text-muted quotation-view-no-print">Loading invoice…</p>
          ) : null}
          {detailError ? (
            <div className="alert alert-danger quotation-view-no-print">{detailError}</div>
          ) : null}
          {!detailLoading && detailRow && viewDoc ? (
            <>
              {isCancelled ? (
                <div className="alert alert-secondary py-2 mb-0 quotation-view-no-print d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
                  <span>
                    This invoice is <strong>cancelled</strong>. It stays on record but cannot be edited or paid until
                    restored.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={!detailRow.apiId || actionBusy === "restore"}
                    onClick={() => setShowRestoreInvoiceModal(true)}>
                    <i className="ti ti-restore me-1" />
                    {actionBusy === "restore" ? "Restoring…" : "Restore invoice"}
                  </button>
                </div>
              ) : null}
              <div className="tf-admin-invoice-detail__toolbar quotation-view-no-print">
                <div className="d-flex flex-wrap align-items-center gap-2 w-100">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={isCancelled || !detailRow?.apiId}
                    onClick={() => navigate(`/tillflow/admin/invoices/${detailRow.apiId}/edit`)}>
                    <i className="ti ti-edit me-1" />
                    Edit
                  </button>
                  <span title={generateActionsDisabled ? generateDeliveryTitle : undefined}>
                    <Dropdown className="d-inline-block">
                      <Dropdown.Toggle
                        variant={generateActionsDisabled ? "outline-secondary" : "primary"}
                        size="sm"
                        id="inv-detail-generate"
                        disabled={generateActionsDisabled}>
                        <i className="ti ti-plus me-1" />
                        Generate
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          disabled={generateDeliveryDisabled}
                          title={generateDeliveryDisabled ? generateDeliveryTitle : undefined}
                          onClick={() => {
                            setCreateDeliveryNoteError("");
                            setShowCreateDeliveryNote(true);
                          }}>
                          <i className="ti ti-truck-delivery me-2 text-dark" />
                          Delivery note
                        </Dropdown.Item>
                        <Dropdown.Item
                          disabled={generateCreditNoteDisabled}
                          title={generateCreditNoteDisabled ? generateCreditNoteTitle : undefined}
                          onClick={() => {
                            setCreateCreditNoteError("");
                            setShowCreateCreditNote(true);
                          }}>
                          <i className="ti ti-file-minus me-2 text-dark" />
                          Credit note
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </span>
                  <Dropdown className="d-inline-block">
                    <Dropdown.Toggle variant="primary" size="sm" id="inv-detail-pdf-print">
                      <i className="ti ti-file-export me-1" />
                      PDF
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => void handleViewPdfPreview()}>
                        <i className="ti ti-file-invoice me-2 text-dark" />
                        View PDF
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={() => void handleViewPdfNewTab()}>
                        <i className="ti ti-external-link me-2 text-dark" />
                        View PDF in new tab
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={() => void handleDownloadPdf()}>
                        <i className="ti ti-download me-2 text-dark" />
                        Download
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                  <Dropdown className="d-inline-block">
                    <Dropdown.Toggle variant="success" size="sm" id="inv-detail-payments">
                      <i className="ti ti-currency-dollar me-1" />
                      Payments
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item
                        onClick={() => handleRecordPaymentFromMenu()}
                        disabled={!detailRow.apiId || isCancelled}>
                        <i className="ti ti-currency-dollar me-2 text-dark" />
                        Record payment
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        onClick={() => handlePaymentsDropdown("list")}
                        disabled={!detailRow.apiId || isCancelled}>
                        <i className="ti ti-clipboard-list me-2 text-dark" />
                        Payments
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        onClick={() => handlePaymentsDropdown("update")}
                        disabled={!detailRow.apiId || isCancelled}>
                        <i className="ti ti-edit me-2 text-dark" />
                        Update payment
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        onClick={() => setPlaceholder({ title: "Applied credits", body: placeholderBody })}>
                        <i className="ti ti-discount-2 me-2 text-dark" />
                        Applied credits
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                  <button
                    type="button"
                    className={`btn ${sendToCustomerButtonClass} btn-sm`}
                    disabled={isCancelled || !String(detailRow?.customerEmail ?? "").trim()}
                    title={
                      !String(detailRow?.customerEmail ?? "").trim()
                        ? "Customer needs an email address"
                        : sendToCustomerIssued && detailRow
                          ? invoiceSentToCustomerHoverTitle(detailRow)
                          : "Send this invoice to the customer's email address"
                    }
                    onClick={() => void openSendInvoiceEmailPreview()}>
                    <i className="ti ti-mail me-1" />
                    {sendToCustomerIssued ? "Resend to customer" : "Send to customer"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => void handleClone()}
                    disabled={actionBusy === "clone" || !rawInvoice || isCancelled}>
                    <i className="ti ti-copy me-1" />
                    {actionBusy === "clone" ? "Cloning…" : "Clone invoice"}
                  </button>
                  <Dropdown className="d-inline-block ms-auto align-self-center">
                    <Dropdown.Toggle variant="outline-secondary" size="sm" id="inv-detail-more-actions">
                      <i className="ti ti-dots-vertical me-1" />
                      More actions
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                      <Dropdown.Item
                        disabled={isCancelled}
                        onClick={() => setPlaceholder({ title: "View invoice as customer", body: placeholderBody })}>
                        <i className="ti ti-eye me-2 text-dark" />
                        View invoice as customer
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        onClick={() => {
                          document.getElementById("invoice-detail-notes")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                          });
                        }}>
                        <i className="ti ti-notes me-2 text-dark" />
                        Notes
                      </Dropdown.Item>
                      <Dropdown.Item
                        disabled={isCancelled}
                        onClick={() => setPlaceholder({ title: "Reminders", body: placeholderBody })}>
                        <i className="ti ti-bell me-2 text-dark" />
                        Reminders
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Header className="small text-muted py-1">Tracking & history</Dropdown.Header>
                      {canViewActivityLog ? (
                        <Dropdown.Item
                          disabled={!activityLogInvoiceId}
                          onClick={() => setActivityLogOpen(true)}>
                          <i className="ti ti-history me-2 text-dark" />
                          Activity log
                        </Dropdown.Item>
                      ) : null}
                      <Dropdown.Item
                        disabled={isCancelled}
                        onClick={() =>
                          setPlaceholder({ title: "Email tracking — tracked emails sent", body: placeholderBody })
                        }>
                        <i className="ti ti-mail me-2 text-dark" />
                        Email tracking
                      </Dropdown.Item>
                      <Dropdown.Item
                        disabled={isCancelled}
                        onClick={() => setPlaceholder({ title: "Views tracking", body: placeholderBody })}>
                        <i className="ti ti-eye me-2 text-dark" />
                        Views tracking
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      {isCancelled ? (
                        <Dropdown.Item
                          className="text-success"
                          disabled={!detailRow.apiId || actionBusy === "restore"}
                          onClick={() => setShowRestoreInvoiceModal(true)}>
                          <i className="ti ti-restore me-2" />
                          Restore invoice
                        </Dropdown.Item>
                      ) : null}
                      <Dropdown.Item
                        className="text-danger"
                        disabled={isCancelled || isDraftInvoice || !detailRow.apiId}
                        title={isDraftInvoice ? "Draft invoices cannot be cancelled" : undefined}
                        onClick={() => setShowCancelInvoiceModal(true)}>
                        <i className="ti ti-ban me-2" />
                        Cancel invoice
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>

              <div className="tf-admin-invoice-detail__doc bg-white rounded border">
                <div className="p-3">
                  <InvoicePrintDocument ref={printRootRef} {...viewDoc} />
                </div>

                {detailRow.apiId && detailRow.status !== "Draft" && hasPayments ? (
                  <div
                    ref={paymentsSectionRef}
                    id="invoice-detail-payments"
                    className="px-3 pb-3 quotation-view-no-print border-top pt-3">
                    {paymentsHint ? (
                      <div className="alert alert-info py-2 mb-2 small" role="status">
                        {paymentsHint}
                      </div>
                    ) : null}
                    <h6 className="mb-2 fw-semibold text-success">Payments</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead>
                          <tr>
                            <th>Receipt</th>
                            <th>Paid</th>
                            <th>Method</th>
                            <th>Txn ID</th>
                            <th className="text-end">Amount</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detailRow.payments ?? []).map((p) => (
                              <tr key={p.id}>
                                <td className="fw-medium">
                                  <Link to={`/tillflow/admin/invoice-payments/${p.id}`}>{p.receipt_ref}</Link>
                                </td>
                                <td className="small">{formatReceiptPaidAtDisplay(p.paid_at)}</td>
                                <td>{paymentMethodLabel(p.payment_method)}</td>
                                <td className="small text-break">{p.transaction_id || "—"}</td>
                                <td className="text-end">{formatInvoiceMoneyKes(p.amount)}</td>
                                <td className="text-end text-nowrap">
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm py-0"
                                    onClick={() => {
                                      setReceiptPreview(p);
                                      setReceiptPreviewRow(detailRow);
                                    }}>
                                    Receipt
                                  </button>
                                  {!isCancelled ? (
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm py-0"
                                      onClick={() => openViewPaymentEdit(p)}>
                                      Edit
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {hasGeneratedDeliveryNote ? (
                  <div id="invoice-detail-delivery-notes" className="px-3 pb-3 quotation-view-no-print border-top pt-3">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                    <h6 className="mb-0 fw-semibold">Delivery notes</h6>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-muted">Status: {deliveryStatus}</span>
                      <span title={generateDeliveryTitle}>
                        <button
                          type="button"
                          className={`btn btn-sm ${generateDeliveryDisabled ? "btn-outline-secondary" : "btn-primary"}`}
                          disabled={generateDeliveryDisabled}
                          onClick={() => {
                            setCreateDeliveryNoteError("");
                            setShowCreateDeliveryNote(true);
                          }}>
                          Generate
                        </button>
                      </span>
                    </div>
                  </div>
                  {deliveryNotesError ? <div className="alert alert-warning py-2 small mb-2">{deliveryNotesError}</div> : null}
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>Delivery note</th>
                          <th>Issue date</th>
                          <th className="text-end">Qty</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryNotesLoading ? (
                          <tr>
                            <td colSpan={5} className="text-muted text-center py-2">
                              Loading...
                            </td>
                          </tr>
                        ) : (
                          deliveryNotes.map((note) => (
                            <tr key={note.id}>
                              <td className="fw-medium">{note.deliveryNoteNo}</td>
                              <td className="small">{note.issueDate || "—"}</td>
                              <td className="text-end">{note.totalQty}</td>
                              <td>
                                <span className={`badge ${deliveryStatusBadgeClass(note.status)} badge-xs shadow-none`}>
                                  {note.status}
                                </span>
                              </td>
                              <td className="text-end">
                                <Link to={`/tillflow/admin/delivery-notes/${note.apiId}`} className="btn btn-link btn-sm py-0">
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  </div>
                ) : null}

                {hasGeneratedCreditNote ? (
                  <div id="invoice-detail-credit-notes" className="px-3 pb-3 quotation-view-no-print border-top pt-3">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                    <h6 className="mb-0 fw-semibold">Credit notes</h6>
                    <div className="d-flex align-items-center gap-2">
                      {hasGeneratedCreditNote ? <span className="small text-muted">Generated: {creditNotes.length}</span> : null}
                      <span title={generateCreditNoteTitle}>
                        <button
                          type="button"
                          className={`btn btn-sm ${generateCreditNoteDisabled ? "btn-outline-secondary" : "btn-primary"}`}
                          disabled={generateCreditNoteDisabled}
                          onClick={() => {
                            setCreateCreditNoteError("");
                            setShowCreateCreditNote(true);
                          }}>
                          Generate
                        </button>
                      </span>
                    </div>
                  </div>
                  {creditNotesError ? <div className="alert alert-warning py-2 small mb-2">{creditNotesError}</div> : null}
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>Credit note</th>
                          <th>Issue date</th>
                          <th className="text-end">Qty</th>
                          <th className="text-end">Amount</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditNotesLoading ? (
                          <tr>
                            <td colSpan={6} className="text-muted text-center py-2">
                              Loading...
                            </td>
                          </tr>
                        ) : (
                          creditNotes.map((note) => (
                            <tr key={note.id}>
                              <td className="fw-medium">{note.creditNoteNo}</td>
                              <td className="small">{note.issueDate || "—"}</td>
                              <td className="text-end">{note.totalQty}</td>
                              <td className="text-end">{note.totalAmountDisplay}</td>
                              <td>
                                <span className={`badge ${creditStatusBadgeClass(note.status)} badge-xs shadow-none`}>
                                  {note.status}
                                </span>
                              </td>
                              <td className="text-end">
                                <Link to={`/tillflow/admin/credit-notes/${note.apiId}`} className="btn btn-link btn-sm py-0">
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  </div>
                ) : null}

                <div id="invoice-detail-notes" className="px-3 pb-3 quotation-view-no-print border-top pt-3">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                    <h6 className="mb-0 fw-semibold">Notes</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={notesSaving || isCancelled}
                      onClick={() => void saveNotes()}>
                      {notesSaving ? "Saving…" : "Save notes"}
                    </button>
                  </div>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    disabled={isCancelled}
                    placeholder="Internal notes on this invoice…"
                  />
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      <RecordInvoicePaymentModal
        show={showRecordPayment}
        onHide={() => setShowRecordPayment(false)}
        recordPayTarget={recordPayTarget}
        recordPayAmount={recordPayAmount}
        setRecordPayAmount={setRecordPayAmount}
        recordPayMethod={recordPayMethod}
        setRecordPayMethod={setRecordPayMethod}
        recordPayPaidAt={recordPayPaidAt}
        setRecordPayPaidAt={setRecordPayPaidAt}
        recordPayTransactionId={recordPayTransactionId}
        setRecordPayTransactionId={setRecordPayTransactionId}
        recordPayNotes={recordPayNotes}
        setRecordPayNotes={setRecordPayNotes}
        recordPayError={recordPayError}
        recordPaySaving={recordPaySaving}
        onSubmit={submitRecordPayment}
      />

      <InvoiceReceiptPreviewModal
        receiptPreview={receiptPreview}
        receiptPreviewRow={receiptPreviewRow}
        receiptPrintRootRef={receiptPrintRootRef}
        onHide={() => {
          setReceiptPreview(null);
          setReceiptPreviewRow(null);
        }}
        onDownloadPdf={handleDownloadReceiptPdf}
        tillflowEmailActionsEnabled={Boolean(token)}
        onSendReceiptToCustomer={token ? handleSendReceiptToCustomer : undefined}
        onViewInvoicePdf={token ? () => void handleViewPdfPreview() : undefined}
        onActivityLog={
          token && canViewActivityLog && activityLogInvoiceId
            ? () => setActivityLogOpen(true)
            : undefined
        }
      />

      <EditInvoicePaymentModal
        viewPayEdit={viewPayEdit}
        onHide={() => setViewPayEdit(null)}
        viewPayEditAmount={viewPayEditAmount}
        setViewPayEditAmount={setViewPayEditAmount}
        viewPayEditMethod={viewPayEditMethod}
        setViewPayEditMethod={setViewPayEditMethod}
        viewPayEditPaidAt={viewPayEditPaidAt}
        setViewPayEditPaidAt={setViewPayEditPaidAt}
        viewPayEditTransactionId={viewPayEditTransactionId}
        setViewPayEditTransactionId={setViewPayEditTransactionId}
        viewPayEditNotes={viewPayEditNotes}
        setViewPayEditNotes={setViewPayEditNotes}
        viewPayEditError={viewPayEditError}
        viewPayEditSaving={viewPayEditSaving}
        onSubmit={submitViewPaymentEdit}
      />

      <ActivityLogModal
        show={activityLogOpen}
        onHide={() => setActivityLogOpen(false)}
        token={token}
        canView={canViewActivityLog}
        invoiceId={activityLogInvoiceId}
      />

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

      <DeliveryNoteCreateModal
        show={showCreateDeliveryNote}
        onHide={() => {
          if (!createDeliveryNoteSaving) {
            setShowCreateDeliveryNote(false);
          }
        }}
        invoiceRow={detailRow}
        saving={createDeliveryNoteSaving}
        error={createDeliveryNoteError}
        onSubmit={(payload) => void submitCreateDeliveryNote(payload)}
      />
      <CreditNoteCreateModal
        show={showCreateCreditNote}
        onHide={() => {
          if (!createCreditNoteSaving) {
            setShowCreateCreditNote(false);
          }
        }}
        invoiceRow={detailRow}
        saving={createCreditNoteSaving}
        error={createCreditNoteError}
        onSubmit={(payload) => void submitCreateCreditNote(payload)}
      />

      <InvoiceEmailPreviewModal
        show={invoiceEmailPreviewOpen}
        onHide={() => {
          if (!invoiceEmailPreviewSending) {
            resetInvoiceEmailPreview();
          }
        }}
        loading={invoiceEmailPreviewLoading}
        error={invoiceEmailPreviewError}
        subject={invoiceEmailPreviewSubject}
        html={invoiceEmailPreviewHtml}
        toEmail={invoiceEmailPreviewTo}
        message={invoiceEmailPreviewMessage}
        onChangeToEmail={setInvoiceEmailPreviewTo}
        onChangeSubject={setInvoiceEmailPreviewSubject}
        onChangeMessage={setInvoiceEmailPreviewMessage}
        showHtmlPreview={false}
        sending={invoiceEmailPreviewSending}
        sendButtonLabel={
          invoiceEmailPreviewSource === "receipt"
            ? (receiptWasSentToCustomer(receiptPreview) ? "Resend receipt" : "Send receipt")
            : detailRow && invoiceWasIssuedToCustomer(detailRow)
              ? "Resend email"
              : "Send email"
        }
        sendDisabled={
          !detailRow?.apiId ||
          String(detailRow?.status ?? "") === "Cancelled" ||
          !String(invoiceEmailPreviewTo ?? "").trim()
        }
        onSend={confirmSendInvoiceFromPreview}
      />

      <DocumentPdfPreviewModal
        url={invoicePdfPreviewUrl}
        title={viewDoc ? `Invoice ${viewDoc.invoiceNo}` : "Invoice PDF"}
        onHide={handleCloseInvoicePdfPreview}
      />

      <Modal
        show={showCancelInvoiceModal}
        onHide={() => {
          if (actionBusy !== "cancel") {
            setShowCancelInvoiceModal(false);
          }
        }}
        centered
        backdrop={actionBusy === "cancel" ? "static" : true}>
        <Modal.Header closeButton={actionBusy !== "cancel"}>
          <Modal.Title>Cancel invoice</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Cancel this invoice? It will remain on file as cancelled and can no longer be edited or receive payments.
          </p>
          {detailRow?.invoiceno ? (
            <p className="text-muted small mb-0 mt-2 fw-medium">{detailRow.invoiceno}</p>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={actionBusy === "cancel"}
            onClick={() => setShowCancelInvoiceModal(false)}>
            Keep invoice
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={actionBusy === "cancel"}
            onClick={() => void confirmCancelInvoice()}>
            {actionBusy === "cancel" ? "Cancelling…" : "Cancel invoice"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showRestoreInvoiceModal}
        onHide={() => {
          if (actionBusy !== "restore") {
            setShowRestoreInvoiceModal(false);
          }
        }}
        centered
        backdrop={actionBusy === "restore" ? "static" : true}>
        <Modal.Header closeButton={actionBusy !== "restore"}>
          <Modal.Title>Restore invoice</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Restore this invoice? Its status will be set from recorded payments and the due date (for example Unpaid,
            Partially paid, Paid, or Overdue).
          </p>
          {detailRow?.invoiceno ? (
            <p className="text-muted small mb-0 mt-2 fw-medium">{detailRow.invoiceno}</p>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={actionBusy === "restore"}
            onClick={() => setShowRestoreInvoiceModal(false)}>
            Keep cancelled
          </button>
          <button
            type="button"
            className="btn btn-success"
            disabled={actionBusy === "restore"}
            onClick={() => void confirmRestoreInvoice()}>
            {actionBusy === "restore" ? "Restoring…" : "Restore invoice"}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
