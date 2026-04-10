import { forwardRef, memo } from "react";
import { compactQuotationFooterBankLine } from "../../utils/companySettingsStorage";

function invoiceStatusTextClass(status) {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  switch (s) {
    case "paid":
      return "text-success";
    case "overdue":
      return "text-warning";
    case "unpaid":
      return "text-danger";
    case "partially_paid":
      return "text-primary";
    case "draft":
      return "text-secondary";
    case "sent":
      return "text-danger";
    case "cancelled":
      return "text-dark";
    default:
      return "text-secondary";
  }
}

/**
 * Printable invoice — same CSS hooks as quotations (`.quotation-view-print-root`, line-items table)
 * so `htmlDocumentPdfExport` and print styles apply unchanged.
 *
 * @typedef {{ paymentLine: string, bankLine: string, closingLine: string }} FooterLines
 */
const InvoicePrintDocument = forwardRef(function InvoicePrintDocument(
  {
    invoiceNo,
    issueDateDisplay,
    dueDateDisplay,
    statusLabel,
    subjectLine,
    seller,
    buyer,
    qrSrc,
    lineRows,
    totals,
    terms,
    notes,
    footer,
    signBlock,
    logoSrc,
    logoDarkSrc
  },
  ref
) {
  const statusUpper = String(statusLabel ?? "").trim().toUpperCase();
  const invoiceTitle = String(subjectLine ?? "").trim();
  const hasDiscountColumn =
    Boolean(String(totals?.discountLine ?? "").trim()) ||
    (Array.isArray(lineRows) &&
      lineRows.some((r) => {
        const discountText = String(r?.discount ?? "")
          .trim()
          .toLowerCase();
        return discountText !== "" && discountText !== "—" && discountText !== "-";
      }));
  const hasLogo = Boolean(String(logoSrc ?? "").trim());
  const hasDarkLogo = Boolean(String(logoDarkSrc ?? "").trim());

  return (
    <div ref={ref} className="card border-0 shadow-none bg-white quotation-view-print-root">
      <div className="card-body pt-2 pb-3 px-3 bg-white">
        <div className="row justify-content-between align-items-start mb-1">
          <div className="col-md-6">
            <div className="mb-1 invoice-logo">
              {hasLogo ? <img src={logoSrc} width={130} className="img-fluid logo" alt="" /> : null}
              {hasDarkLogo ? (
                <img src={logoDarkSrc} width={130} className="img-fluid logo-white" alt="" />
              ) : null}
            </div>
          </div>
          <div className="col-md-6">
            <div className="row">
              <div className={qrSrc ? "col-md-10 text-end" : "col-12 text-end"}>
                <h2
                  className="text-black mb-0 text-uppercase fw-bolder"
                  style={{ letterSpacing: "0.07em", fontSize: "1.5rem" }}>
                  INVOICE
                </h2>
                <p className="mb-1 fw-bold text-black" style={{ fontSize: "1.05rem", marginTop: 0 }}>
                  # {invoiceNo}
                </p>
                <p
                  className={`mb-0 fw-semibold text-uppercase quotation-view-status ${invoiceStatusTextClass(statusLabel)}`}>
                  {statusUpper}
                </p>
              </div>
              {qrSrc ? (
                <div className="col-md-2 text-end mt-2 mt-md-0">
                  <img src={qrSrc} className="img-fluid" alt="" style={{ maxWidth: 100 }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="row mb-2">
          <div className="col-md-6">
            <h4 className="mb-1">{seller.companyName}</h4>
            <p className="mb-1 text-dark text-break">{seller.address || "—"}</p>
            <p className="mb-1 text-dark text-break">
              {seller.website ? (
                <a
                  href={/^https?:\/\//i.test(seller.website) ? seller.website : `https://${seller.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark text-decoration-none">
                  {seller.website}
                </a>
              ) : (
                "—"
              )}
            </p>
            <p className="mb-1 text-dark text-break">{seller.email || "—"}</p>
            <p className="mb-0 text-dark">{seller.phone || "—"}</p>
          </div>
          <div className="col-md-6 text-md-end">
            <p className="text-dark mb-2 fw-semibold">To</p>
            <h4 className="mb-1">{buyer.name}</h4>
            {buyer.address ? <p className="mb-1 text-dark text-break">{buyer.address}</p> : null}
            {buyer.email ? <p className="mb-1 text-dark text-break">{buyer.email}</p> : null}
            {buyer.phone ? <p className="mb-0 text-dark">{buyer.phone}</p> : null}
          </div>
        </div>

        <div className="mt-3 pt-2 mb-2 invoice-view-doc-title-wrap d-flex justify-content-between align-items-center gap-2">
          <h4
            className="mb-0 text-break invoice-view-doc-title text-black fw-bold"
            style={{ whiteSpace: "pre-wrap" }}>
            {invoiceTitle ? `Invoice for : ${invoiceTitle}` : ""}
          </h4>
          <p className="mb-0 fw-medium text-dark text-break text-end">
            <span>
              Issued : <span className="text-dark">{issueDateDisplay}</span>
            </span>
            <span className="text-muted px-2">·</span>
            <span>
              Due : <span className="text-dark">{dueDateDisplay}</span>
            </span>
          </p>
        </div>

        <div className="table-responsive mb-3">
          <table className="table quotation-view-line-items mb-0 bg-white">
            <thead className="quotation-view-line-items__thead">
              <tr>
                <th
                  className="quotation-view-line-items__head-strong text-center text-white fw-bolder"
                  style={{ width: "2.25rem" }}>
                  #
                </th>
                <th className="quotation-view-line-items__head-strong text-white fw-bolder">Item</th>
                <th
                  className="quotation-view-line-items__head-strong text-end text-white fw-bolder"
                  style={{ width: "3.5rem" }}>
                  Qty
                </th>
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">
                  Rate
                </th>
                {hasDiscountColumn ? (
                  <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">
                    Discount
                  </th>
                ) : null}
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((r, ix) => (
                <tr key={r.key ?? ix}>
                  <td className="text-gray-9 fw-medium text-center tabular-nums">{ix + 1}</td>
                  <td>
                    <h6 className="mb-0">{r.title}</h6>
                    {r.desc ? (
                      <p
                        className="text-muted small mb-0 mt-1 text-break"
                        style={{ whiteSpace: "pre-wrap" }}>
                        {r.desc}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-gray-9 fw-medium text-end">{r.qty}</td>
                  <td className="text-gray-9 fw-medium text-end">{r.cost}</td>
                  {hasDiscountColumn ? (
                    <td className="text-gray-9 fw-medium text-end">{r.discount}</td>
                  ) : null}
                  <td className="text-gray-9 fw-medium text-end">{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="quotation-view-line-items__totals">
              <tr>
                <td colSpan={3} className="bg-transparent border-bottom-0" />
                <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                  Sub Total
                </td>
                {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                  {totals.sub}
                </td>
              </tr>
              {totals.discountLine ? (
                <tr>
                  <td colSpan={3} className="bg-transparent border-bottom-0" />
                  <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.discountLine}
                  </td>
                  {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                  <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.discountAmt}
                  </td>
                </tr>
              ) : null}
              {totals.taxLine ? (
                <tr>
                  <td colSpan={3} className="bg-transparent border-bottom-0" />
                  <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.taxLine}
                  </td>
                  {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                  <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.taxAmt}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} className="bg-transparent border-bottom-0" />
                <td className="text-gray-9 text-end fw-bolder align-middle border-bottom-0 pt-1 quotation-view-line-items__total-label">
                  Total
                </td>
                {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                <td className="text-gray-9 text-end fw-bolder tabular-nums align-middle border-bottom-0 pt-1 quotation-view-line-items__total-amt">
                  {totals.grandTotal}
                </td>
              </tr>
              {totals.amountPaid != null && totals.amountPaid !== "" ? (
                <tr>
                  <td colSpan={3} className="bg-transparent border-bottom-0" />
                  <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                    Amount paid
                  </td>
                  {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                  <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.amountPaid}
                  </td>
                </tr>
              ) : null}
              {totals.amountDue != null && totals.amountDue !== "" ? (
                <tr>
                  <td colSpan={3} className="bg-transparent border-bottom-0" />
                  <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                    Amount due
                  </td>
                  {hasDiscountColumn ? <td className="bg-transparent border-bottom-0" /> : null}
                  <td className="text-danger text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {totals.amountDue}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </div>
        {totals.amountInWords ? (
          <p className="fs-12 text-muted mb-3 text-end">{totals.amountInWords}</p>
        ) : null}

        {(terms || notes || signBlock) && (
          <div className="row align-items-start mb-3 quotation-view-terms-block border-bottom pb-3">
            <div className="col-md-7">
              {terms ? (
                <div className="mb-3">
                  <h6 className="mb-1">Terms and conditions</h6>
                  <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                    {terms}
                  </p>
                </div>
              ) : null}
              {notes ? (
                <div className="mb-0">
                  <h6 className="mb-1">Notes</h6>
                  <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                    {notes}
                  </p>
                </div>
              ) : null}
            </div>
            {signBlock ? (
              <div className="col-md-5 text-end">
                {signBlock.imageSrc ? (
                  <img src={signBlock.imageSrc} className="img-fluid" alt="" style={{ maxHeight: 56 }} />
                ) : null}
                {signBlock.name ? <h6 className="fs-14 fw-medium pe-3 mb-0">{signBlock.name}</h6> : null}
                {signBlock.role ? <p className="mb-0">{signBlock.role}</p> : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="text-center quotation-view-payment-footer">
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {footer.paymentLine}
          </p>
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {compactQuotationFooterBankLine(footer.bankLine)}
          </p>
          <p className="text-muted small mb-0 text-break" style={{ lineHeight: 1.45 }}>
            {footer.closingLine}
          </p>
        </div>
      </div>
    </div>
  );
});

export default memo(InvoicePrintDocument);
