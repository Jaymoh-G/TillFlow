import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import PrimeDataTable from "../../components/data-table";
import PosReceiptPrintDocument from "../../feature-module/sales/PosReceiptPrintDocument";
import {
  createHtmlDocumentPdfObjectUrl,
  downloadHtmlDocumentPdfFromElement,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { printPosReceiptThermal } from "../utils/printPosReceiptThermal";
import { TillFlowApiError } from "../api/errors";
import {
  listPosOrdersRequest,
  previewPosOrderReceiptEmailRequest,
  sendPosOrderReceiptToCustomerRequest,
  showPosOrderRequest
} from "../api/posOrders";
import { useAuth } from "../auth/AuthContext";

const POS_ORDERS_LIST_PATH = "/tillflow/admin/orders";

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

function statusBadgeClass(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "voided" || s === "cancelled") return "badge-soft-dark";
  if (s === "completed") return "badge-soft-success";
  return "badge-soft-primary";
}

export default function AdminPosOrderDetail() {
  const { posOrderId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const receiptRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listSidebarRows, setListSidebarRows] = useState(10);
  const [listSidebarCurrentPage, setListSidebarCurrentPage] = useState(1);

  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  const [receiptPdfPreviewUrl, setReceiptPdfPreviewUrl] = useState(null);

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState("");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSendError, setEmailSendError] = useState("");

  const loadList = useCallback(async () => {
    if (!token) return;
    setListError("");
    setListLoading(true);
    try {
      const data = await listPosOrdersRequest(token);
      setOrders(Array.isArray(data?.pos_orders) ? data.pos_orders : []);
    } catch (e) {
      setOrders([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Failed to load POS orders.");
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const selectedSummary = useMemo(() => {
    if (!posOrderId) return null;
    const idNum = Number(posOrderId);
    if (Number.isFinite(idNum)) {
      return orders.find((o) => Number(o.id) === idNum) ?? null;
    }
    const key = String(posOrderId).trim();
    return orders.find((o) => String(o.order_no ?? "").trim() === key) ?? null;
  }, [orders, posOrderId]);

  useEffect(() => {
    if (!posOrderId || !orders.length) return;
    let idx = -1;
    const idNum = Number(posOrderId);
    if (Number.isFinite(idNum)) {
      idx = orders.findIndex((o) => Number(o.id) === idNum);
    }
    if (idx < 0) {
      const key = String(posOrderId).trim();
      idx = orders.findIndex((o) => String(o.order_no ?? "").trim() === key);
    }
    if (idx < 0) return;
    const page = Math.floor(idx / listSidebarRows) + 1;
    setListSidebarCurrentPage(page);
  }, [posOrderId, orders, listSidebarRows]);

  const loadDetail = useCallback(
    async (id) => {
      if (!token || !id) return;
      setDetailError("");
      setDetailLoading(true);
      try {
        const data = await showPosOrderRequest(token, id);
        setDetailOrder(data?.pos_order ?? null);
      } catch (e) {
        setDetailOrder(null);
        setDetailError(e instanceof TillFlowApiError ? e.message : "Failed to load POS order.");
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const id = selectedSummary?.id ?? null;
    if (!id) {
      setDetailOrder(null);
      setDetailLoading(false);
      setDetailError("");
      return;
    }
    void loadDetail(id);
  }, [selectedSummary?.id, loadDetail]);

  useEffect(() => {
    setReceiptPdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, [selectedSummary?.id]);

  const sidebarColumns = useMemo(
    () => [
      {
        header: "Receipt",
        field: "order_no",
        body: (o) => (
          <NavLink
            to={`/tillflow/admin/orders/${o.id}`}
            className={({ isActive }) => (isActive ? "fw-semibold text-primary" : "fw-medium")}>
            {o.order_no || `#${o.id}`}
          </NavLink>
        )
      },
      {
        header: "Amount",
        field: "total_amount",
        className: "text-end",
        headerClassName: "text-end",
        body: (o) => <span className="d-block text-end tf-mono">{formatKes(o.total_amount)}</span>
      },
      {
        header: "Status",
        field: "status",
        body: (o) => (
          <span className={`badge ${statusBadgeClass(o.status)} badge-xs shadow-none`}>
            {String(o.status ?? "") || "—"}
          </span>
        )
      },
      {
        header: "Customer",
        field: "customer_name",
        body: (o) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 180 }} title={o.customer_name}>
            {o.customer_name || "Walk-in"}
          </span>
        )
      }
    ],
    []
  );

  const previewReceiptPdf = useCallback(async () => {
    if (!receiptRef.current) return;
    setReceiptPdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    await waitForPrintRootImages(receiptRef.current);
    const next = await createHtmlDocumentPdfObjectUrl(receiptRef.current, {
      filename: `${detailOrder?.order_no || "pos-receipt"}.pdf`
    });
    setReceiptPdfPreviewUrl(next);
  }, [detailOrder?.order_no]);

  const downloadReceiptPdf = useCallback(async () => {
    if (!receiptRef.current) return;
    await waitForPrintRootImages(receiptRef.current);
    await downloadHtmlDocumentPdfFromElement(receiptRef.current, {
      filename: `${detailOrder?.order_no || "pos-receipt"}.pdf`
    });
  }, [detailOrder?.order_no]);

  const printReceipt = useCallback(async () => {
    if (!receiptRef.current) return;
    try {
      await waitForPrintRootImages(receiptRef.current);
      printPosReceiptThermal(
        receiptRef.current,
        detailOrder?.order_no ? `Receipt ${detailOrder.order_no}` : "Receipt"
      );
    } catch {
      window.alert("Could not print receipt.");
    }
  }, [detailOrder?.order_no]);

  const openEmailPreview = useCallback(async () => {
    if (!token || !detailOrder?.id) return;
    setEmailPreviewOpen(true);
    setEmailPreviewError("");
    setEmailSendError("");
    setEmailPreviewLoading(true);
    try {
      const data = await previewPosOrderReceiptEmailRequest(token, detailOrder.id);
      setEmailPreviewHtml(String(data?.html ?? ""));
      setEmailTo(String(detailOrder.customer_email ?? ""));
      setEmailSubject(String(data?.subject ?? `Receipt ${detailOrder.order_no ?? ""}`));
      setEmailMessage(
        String(data?.message_template ?? "Please find your POS receipt details below.")
      );
    } catch (e) {
      setEmailPreviewHtml("");
      setEmailPreviewError(e instanceof TillFlowApiError ? e.message : "Failed to load email preview.");
    } finally {
      setEmailPreviewLoading(false);
    }
  }, [token, detailOrder?.id, detailOrder?.order_no, detailOrder?.customer_email]);

  const sendEmail = useCallback(async () => {
    if (!token || !detailOrder?.id) return;
    setEmailSending(true);
    setEmailSendError("");
    try {
      await sendPosOrderReceiptToCustomerRequest(token, detailOrder.id, {
        toEmail: emailTo,
        subject: emailSubject,
        message: emailMessage
      });
      setEmailPreviewOpen(false);
    } catch (e) {
      setEmailSendError(e instanceof TillFlowApiError ? e.message : "Failed to send email.");
    } finally {
      setEmailSending(false);
    }
  }, [token, detailOrder?.id, emailTo, emailSubject, emailMessage]);

  return (
    <div className="page-wrapper pos-orders-page tf-admin-invoice-detail">
      <div className="content">


        {listError ? <div className="alert alert-warning">{listError}</div> : null}

        <div className="tf-admin-invoice-detail__layout">
          <aside className="tf-admin-invoice-detail__list">
            <div className="tf-admin-invoice-detail__list-scroll">


          <div className="add-item d-flex align-items-center justify-content-between w-100 gap-2 flex-wrap">
            <div className="page-title">
              <h4 className="mb-4">Orders</h4>


          </div>
        </div>
              <div className="custom-datatable-filter table-responsive">
                <PrimeDataTable
                  column={sidebarColumns}
                  data={orders}
                  rows={listSidebarRows}
                  setRows={setListSidebarRows}
                  currentPage={listSidebarCurrentPage}
                  setCurrentPage={setListSidebarCurrentPage}
                  totalRecords={orders.length}
                  loading={listLoading}
                  isPaginationEnabled
                />
              </div>
            </div>
          </aside>

          <main className="tf-admin-invoice-detail__main">
            {detailError ? <div className="alert alert-danger">{detailError}</div> : null}

            {detailLoading ? (
              <div className="text-muted">Loading…</div>
            ) : detailOrder ? (
              <>
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="small mb-0">
                        <Link to={POS_ORDERS_LIST_PATH}>Orders</Link>
                        {selectedSummary?.order_no ? <span className="text-muted"> / {selectedSummary.order_no}</span> : null}
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap justify-content-end">
                      <button type="button" className="btn btn-light border" onClick={() => void loadList()}>
                        <i className="feather icon-refresh-cw" /> Refresh
                      </button>
                      <button type="button" className="btn btn-light border" onClick={() => void previewReceiptPdf()}>
                        View PDF
                      </button>
                      <button type="button" className="btn btn-light border" onClick={() => void downloadReceiptPdf()}>
                        Download PDF
                      </button>
                      <button type="button" className="btn btn-light border" onClick={() => void printReceipt()}>
                        Print
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => void openEmailPreview()}>
                        Email receipt
                      </button>
                      <button type="button" className="btn btn-light border" onClick={() => navigate(POS_ORDERS_LIST_PATH)}>
                        Back to list
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm tf-admin-invoice-detail__doc bg-white rounded border">
                  <div className="card-body p-2 p-md-3">
                    <PosReceiptPrintDocument order={detailOrder} ref={receiptRef} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted">Select an order from the list.</div>
            )}
          </main>
        </div>
      </div>

      <DocumentPdfPreviewModal
        show={Boolean(receiptPdfPreviewUrl)}
        onHide={() =>
          setReceiptPdfPreviewUrl((prev) => {
            if (prev) {
              try {
                URL.revokeObjectURL(prev);
              } catch {
                /* ignore */
              }
            }
            return null;
          })
        }
        url={receiptPdfPreviewUrl}
        title={detailOrder?.order_no ? `Receipt ${detailOrder.order_no}` : "Receipt"}
      />

      <InvoiceEmailPreviewModal
        show={emailPreviewOpen}
        onHide={() => {
          if (!emailSending) setEmailPreviewOpen(false);
        }}
        loading={emailPreviewLoading}
        error={emailPreviewError || emailSendError}
        html={emailPreviewHtml}
        toEmail={emailTo}
        subject={emailSubject}
        message={emailMessage}
        onChangeToEmail={setEmailTo}
        onChangeSubject={setEmailSubject}
        onChangeMessage={setEmailMessage}
        onSend={sendEmail}
        sending={emailSending}
        sendDisabled={!String(emailTo ?? "").trim()}
        sendButtonLabel="Send receipt"
      />
    </div>
  );
}

