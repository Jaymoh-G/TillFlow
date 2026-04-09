import { useCallback, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import CommonFooter from "../../components/footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { pdf, qrCodeImage, sign } from "../../utils/imagepath";
import {
  createHtmlDocumentPdfObjectUrl,
  downloadHtmlDocumentPdfFromElement,
  openHtmlDocumentPdfInBrowser,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import InvoicePrintDocument from "./InvoicePrintDocument";

/** Demo payload — replace with API / route state when invoices are wired like quotations. */
const invoiceSettings = getInvoiceSettingsSnapshot();
const invoiceLogo = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();
const DEMO_INVOICE = {
  invoiceNo: "INV0001",
  issueDateDisplay: "Sep 24, 2024",
  dueDateDisplay: "Sep 30, 2024",
  statusLabel: "Paid",
  subjectLine: "Design & development of Website",
  seller: {
    companyName: "Thomas Lawler",
    address: "3099 Kennedy Court Framingham, MA 01702",
    website: "",
    email: "Tarala2445@example.com",
    phone: "+1 987 654 3210"
  },
  buyer: {
    name: "Carl Evans",
    address: "3103 Trainer Avenue Peoria, IL 61602",
    email: "Sara_inc34@example.com",
    phone: "+1 987 471 6589"
  },
  qrSrc: qrCodeImage,
  lineRows: [
    { key: "1", title: "UX Strategy", qty: "1", cost: "$500", discount: "$100", total: "$500" },
    { key: "2", title: "Design System", qty: "1", cost: "$5000", discount: "$100", total: "$5000" },
    { key: "3", title: "Brand Guidelines", qty: "1", cost: "$5000", discount: "$100", total: "$5000" },
    { key: "4", title: "Social Media Template", qty: "1", cost: "$5000", discount: "$100", total: "$5000" }
  ],
  totals: {
    sub: "$5500",
    discountLine: "Discount (aggregate)",
    discountAmt: "$400",
    taxLine: "VAT (5%)",
    taxAmt: "$54",
    grandTotal: "$5775",
    amountPaid: "$5775",
    amountDue: "$0",
    amountInWords: "Amount in words : Dollar Five thousand Seven Seventy Five"
  },
  terms:
    "Please pay within 15 days from the date of invoice, overdue interest @ 14% will be charged on delayed payments.",
  notes: "Please quote invoice number when remitting funds.",
  footer: {
    paymentLine: "Payment made via bank transfer / cheque in the name of Thomas Lawler",
    bankLine: "Bank name: HDFC Bank · Account: 45366287987 · IFSC: HDFC0018159",
    closingLine: "Thank you for your business."
  },
  signBlock: {
    imageSrc: sign,
    name: "Ted M. Davis",
    role: "Assistant Manager"
  },
  logoSrc: invoiceLogo,
  logoDarkSrc: invoiceLogo
};

const Invoicedetails = () => {
  const route = all_routes;
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const printRootRef = useRef(null);
  const [invoicePdfPreviewUrl, setInvoicePdfPreviewUrl] = useState(null);

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

  const handleViewPdfPreview = useCallback(async () => {
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `invoice-${String(DEMO_INVOICE.invoiceNo).replace(/[^\w.-]+/g, "_")}`;
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
  }, []);

  const handleViewPdfNewTab = useCallback(async () => {
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await openHtmlDocumentPdfInBrowser(root, {
        fileSlug: `invoice-${String(DEMO_INVOICE.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === "POPUP_BLOCKED") {
        window.alert("Your browser blocked the new tab. Allow pop-ups for this site or use View PDF.");
        return;
      }
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const root = printRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `invoice-${String(DEMO_INVOICE.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, []);

  const backHref = inTillflowShell ? "/tillflow/admin/invoices" : route.invoice;

  return (
    <div>
      <div
        className={`page-wrapper invoice-details-page${inTillflowShell ? " invoice-details-page--tillflow" : ""}`}>
        <div className="content">
          <div className="page-header invoice-view-no-print">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Invoice Details</h4>
              </div>
            </div>
            <ul className="table-top-head">
              <li>
                <button
                  type="button"
                  className="border-0 bg-transparent p-0"
                  title="View PDF"
                  onClick={() => void handleViewPdfPreview()}>
                  <img src={pdf} alt="" />
                </button>
              </li>
              <li>
                <Link to="#" data-bs-toggle="tooltip" data-bs-placement="top" title="Collapse" id="collapse-header">
                  <i className="feather icon-chevron-up feather-chevron-up" />
                </Link>
              </li>
            </ul>
            <div className="page-btn">
              <Link to={backHref} className="btn btn-primary">
                <i className="feather icon-arrow-left me-2" />
                Back to Invoices
              </Link>
            </div>
          </div>

          <div className="card border-0 shadow-none">
            <div className="card-body p-0 bg-white">
              <InvoicePrintDocument ref={printRootRef} {...DEMO_INVOICE} />
            </div>
          </div>

          <div className="d-flex justify-content-center align-items-center mb-4 invoice-view-no-print flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary d-flex justify-content-center align-items-center"
              onClick={() => void handleViewPdfPreview()}>
              <i className="ti ti-file-invoice me-2" />
              View PDF
            </button>
            <button
              type="button"
              className="btn btn-outline-primary d-flex justify-content-center align-items-center"
              onClick={() => void handleViewPdfNewTab()}>
              <i className="ti ti-external-link me-2" />
              View PDF in new tab
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
              onClick={() => void handleDownloadPdf()}>
              <i className="ti ti-download me-2" />
              Download PDF
            </button>
            <Link to="#" className="btn btn-secondary d-flex justify-content-center align-items-center border">
              <i className="ti ti-copy me-2" />
              Clone invoice
            </Link>
          </div>
        </div>
        <CommonFooter />
      </div>

      <DocumentPdfPreviewModal
        url={invoicePdfPreviewUrl}
        title={`Invoice ${DEMO_INVOICE.invoiceNo}`}
        onHide={handleCloseInvoicePdfPreview}
      />
    </div>
  );
};

export default Invoicedetails;
