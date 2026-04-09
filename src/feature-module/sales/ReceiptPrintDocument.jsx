import { forwardRef, memo } from "react";
import { compactQuotationFooterBankLine } from "../../utils/companySettingsStorage";

/**
 * Printable payment receipt — uses same root class as invoice for PDF/print CSS.
 */
const ReceiptPrintDocument = forwardRef(function ReceiptPrintDocument(
  {
    receiptRef,
    invoiceNo,
    customerName,
    paymentDateDisplay,
    invoiceDateDisplay,
    invoiceAmountFormatted,
    amountFormatted,
    amountDueFormatted,
    paymentMethodLabel: methodLabel,
    transactionIdDisplay,
    seller,
    footer,
    logoSrc,
    logoDarkSrc
  },
  ref
) {
  const hasLogo = Boolean(String(logoSrc ?? "").trim());
  const hasDarkLogo = Boolean(String(logoDarkSrc ?? "").trim());
  const txnId = String(transactionIdDisplay ?? "").trim();

  return (
    <div ref={ref} className="card border-0 shadow-none bg-white quotation-view-print-root">
      <div className="card-body pt-2 pb-3 px-3 bg-white">
        <div className="row justify-content-between align-items-start mb-3">
          <div className="col-md-6">
            <div className="mb-1 invoice-logo">
              {hasLogo ? <img src={logoSrc} width={130} className="img-fluid logo" alt="" /> : null}
              {hasDarkLogo ? (
                <img src={logoDarkSrc} width={130} className="img-fluid logo-white" alt="" />
              ) : null}
            </div>
            <h4 className="mb-1">{seller?.companyName || "Your business"}</h4>
            <p className="mb-1 text-dark text-break small">{seller?.address || "—"}</p>
            <p className="mb-0 text-dark small">{seller?.phone || "—"}</p>
          </div>
          <div className="col-md-6 text-md-end">
            <h2
              className="text-black mb-0 text-uppercase fw-bolder"
              style={{ letterSpacing: "0.07em", fontSize: "1.5rem" }}>
              RECEIPT
            </h2>
            <p className="mb-0 fw-bold text-black" style={{ fontSize: "1.05rem", marginTop: 4 }}>
              # {receiptRef}
            </p>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-12">
            <p className="text-dark mb-1 fw-semibold">Received from</p>
            <h5 className="mb-3 text-break">{customerName || "—"}</h5>

            <div className="text-center mb-3 receipt-amount-paid-wrap">
              <div
                className="d-inline-flex flex-column align-items-center justify-content-center bg-success text-white rounded-3 shadow-sm mx-auto receipt-amount-paid-button"
                style={{
                  minWidth: "min(100%, 18rem)",
                  padding: "1rem 1.75rem"
                }}>
                <span
                  className="small fw-semibold text-uppercase mb-1"
                  style={{ letterSpacing: "0.06em", opacity: 0.95 }}>
                  Amount paid
                </span>
                <span
                  className="fw-bold tabular-nums"
                  style={{ fontSize: "clamp(1.4rem, 5vw, 2.1rem)", lineHeight: 1.15 }}>
                  {amountFormatted}
                </span>
              </div>
            </div>

            <div className="table-responsive receipt-payment-details-table">
              <table className="table table-sm table-bordered mb-0 bg-white quotation-view-line-items">
                <tbody>
                  <tr>
                    <td className="text-gray-9 fw-medium" style={{ width: "44%" }}>
                      Payment date
                    </td>
                    <td className="text-gray-9 text-end tabular-nums">{paymentDateDisplay || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Payment for invoice number</td>
                    <td className="text-gray-9 text-end">{invoiceNo || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Invoice date</td>
                    <td className="text-gray-9 text-end">{invoiceDateDisplay || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Invoice amount</td>
                    <td className="text-gray-9 text-end fw-medium tabular-nums">{invoiceAmountFormatted || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Payment amount</td>
                    <td className="text-gray-9 text-end fw-medium tabular-nums">{amountFormatted || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Amount due</td>
                    <td className="text-danger text-end fw-medium tabular-nums">{amountDueFormatted || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-9 fw-medium">Payment method</td>
                    <td className="text-gray-9 text-end fw-medium">{methodLabel}</td>
                  </tr>
                  {txnId ? (
                    <tr>
                      <td className="text-gray-9 fw-medium">Transaction ID</td>
                      <td className="text-gray-9 text-end fw-medium text-break">{txnId}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="text-center quotation-view-payment-footer pt-2">
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {footer?.paymentLine}
          </p>
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {compactQuotationFooterBankLine(footer?.bankLine)}
          </p>
          <p className="text-muted small mb-0 text-break" style={{ lineHeight: 1.45 }}>
            {footer?.closingLine}
          </p>
        </div>
      </div>
    </div>
  );
});

export default memo(ReceiptPrintDocument);
