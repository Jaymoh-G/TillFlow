import { forwardRef, memo } from "react";
import ImageWithBasePath from "../../components/image-with-base-path";
import { compactQuotationFooterBankLine } from "../../utils/companySettingsStorage";

/** Mirrors quotation list view (CRM + legacy labels). */
const QUOTATION_CRM_STATUSES = ["Draft", "Sent", "Expired", "Declined", "Accepted"];
const LEGACY_QUOTATION_STATUS_MAP = {
  Pending: "Draft",
  Ordered: "Accepted"
};

function normalizeQuotationStatus(s) {
  if (s == null || s === "") {
    return "Draft";
  }
  const str = String(s);
  if (LEGACY_QUOTATION_STATUS_MAP[str]) {
    return LEGACY_QUOTATION_STATUS_MAP[str];
  }
  return QUOTATION_CRM_STATUSES.includes(str) ? str : "Draft";
}

function quotationStatusTextClass(status) {
  const n = normalizeQuotationStatus(status);
  switch (n) {
    case "Draft":
      return "text-secondary";
    case "Sent":
      return "text-primary";
    case "Expired":
      return "text-warning text-dark";
    case "Declined":
      return "text-danger";
    case "Accepted":
      return "text-success";
    default:
      return "text-secondary";
  }
}

function formatQuotedDisplay(isoDate) {
  if (!isoDate) {
    return "";
  }
  const raw = String(isoDate).trim();
  const hasTime = raw.includes("T");
  const normalized = hasTime ? raw.replace(/\.(\d{3})\d+Z$/, ".$1Z") : `${raw}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Printable quotation card — same DOM as the view modal (html2canvas + jsPDF capture).
 * @typedef {object} QuotationFooterResolved
 * @property {string} paymentLine
 * @property {string} bankLine
 * @property {string} closingLine
 */
const QuotationPrintDocument = forwardRef(function QuotationPrintDocument(
  {
    viewRow,
    quotationViewModel,
    companySnapshot,
    quotationFooter,
    quotationLogoSrc,
    quotationLogoDarkSrc,
    formatMoney: viewFormatMoney
  },
  ref
) {
  if (!viewRow || !quotationViewModel || !companySnapshot || !quotationFooter) {
    return null;
  }

  return (
    <div ref={ref} className="card border-0 shadow-none bg-white quotation-view-print-root">
      <div className="card-body pt-2 pb-3 px-3 bg-white">
        <div className="row justify-content-between align-items-center mb-1">
          <div className="col-md-6">
            <div className="mb-1">
              <div className="mb-1 invoice-logo">
                <img src={quotationLogoSrc} width={130} className="img-fluid logo" alt="" />
                <img src={quotationLogoDarkSrc} width={130} className="img-fluid logo-white" alt="" />
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="text-end mb-0 quotation-view-quote-meta-col">
              <h2
                className="text-black mb-0 text-uppercase fw-bolder"
                style={{ letterSpacing: "0.07em", fontSize: "1.5rem" }}>
                QUOTATION
              </h2>
              <p className="mb-1 fw-bold text-black" style={{ fontSize: "1.05rem", marginTop: 0 }}>
                # {viewRow.quoteRef}
              </p>
              <p
                className={`mb-0 fw-semibold text-uppercase quotation-view-status ${quotationStatusTextClass(viewRow.Status)}`}>
                {normalizeQuotationStatus(viewRow.Status).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
        <div className="row mb-2">
          <div className="col-md-6">
            <div>
              <h4 className="mb-1">{companySnapshot.companyName.trim() || "Your business"}</h4>
              <p className="mb-1 text-dark text-break">
                {(companySnapshot.location || companySnapshot.addressLine || "").trim() || "—"}
              </p>
              <p className="mb-1 text-dark text-break">
                {(() => {
                  const web = String(companySnapshot.website ?? "").trim();
                  if (!web) {
                    return "—";
                  }
                  const href = /^https?:\/\//i.test(web) ? web : `https://${web}`;
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dark text-decoration-none">
                      {web}
                    </a>
                  );
                })()}
              </p>
              <p className="mb-1 text-dark text-break">{companySnapshot.email.trim() || "—"}</p>
              <p className="mb-0 text-dark">{companySnapshot.phone.trim() || "—"}</p>
            </div>
          </div>
          <div className="col-md-6 text-end">
            <p className="text-dark mb-2 fw-semibold">To</p>
            <div>
              <h4 className="mb-1">{viewRow.Custmer_Name}</h4>
              {(() => {
                const loc = String(viewRow.customer_location ?? "").trim();
                const em = String(viewRow.customer_email ?? "").trim();
                const ph = String(viewRow.customer_phone ?? "").trim();
                return (
                  <>
                    {loc ? <p className="mb-1 text-dark text-break">{loc}</p> : null}
                    {em ? (
                      <p className={ph ? "mb-1 text-dark text-break" : "mb-2 text-dark text-break"}>{em}</p>
                    ) : null}
                    {ph ? <p className="mb-2 text-dark">{ph}</p> : null}
                    <p className="mt-2 mb-0 fw-medium text-end text-break">
                      <span>
                        Quote date : <span className="text-dark">{viewRow.quotedDate}</span>
                      </span>
                      <span className="text-muted px-2">·</span>
                      <span>
                        Valid until :{" "}
                        <span className="text-dark">
                          {viewRow.expiresAtIso ? formatQuotedDisplay(viewRow.expiresAtIso) : "—"}
                        </span>
                      </span>
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2 mb-2 quotation-view-quote-title-wrap">
          <h4
            className="mb-0 text-break quotation-view-quote-title text-black fw-bold"
            style={{ whiteSpace: "pre-wrap" }}>
            Quotation for : {String(viewRow.quoteTitle ?? "").trim() || "—"}
          </h4>
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
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">Qty</th>
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">Rate</th>
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotationViewModel.rows.map((r, rowIx) => (
                <tr key={r.key}>
                  <td className="text-gray-9 fw-medium text-center tabular-nums">{rowIx + 1}</td>
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
                  <td className="text-gray-9 fw-medium text-end">{viewFormatMoney(r.unit)}</td>
                  <td className="text-gray-9 fw-medium text-end">{viewFormatMoney(r.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="quotation-view-line-items__totals">
              <tr>
                <td colSpan={3} className="bg-transparent border-bottom-0" />
                <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                  Sub Total
                </td>
                <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                  {viewFormatMoney(quotationViewModel.subEx)}
                </td>
              </tr>
              {quotationViewModel.dtype !== "none" ? (
                <tr>
                  <td colSpan={3} className="bg-transparent border-bottom-0" />
                  <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                    {quotationViewModel.discountLabel}
                  </td>
                  <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                    −{viewFormatMoney(quotationViewModel.discountAmt)}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} className="bg-transparent border-bottom-0" />
                <td className="text-gray-9 text-end fw-bold align-middle border-bottom-0 quotation-view-line-items__rollup">
                  Tax
                </td>
                <td className="text-gray-9 text-end fw-bold tabular-nums align-middle border-bottom-0 quotation-view-line-items__rollup">
                  {viewFormatMoney(quotationViewModel.taxAmt)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="bg-transparent border-bottom-0" />
                <td className="text-gray-9 text-end fw-bolder align-middle border-bottom-0 pt-1 quotation-view-line-items__total-label">
                  Total
                </td>
                <td className="text-gray-9 text-end fw-bolder tabular-nums align-middle border-bottom-0 pt-1 quotation-view-line-items__total-amt">
                  {viewFormatMoney(quotationViewModel.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {(() => {
          const termsStr = String(viewRow.termsAndConditions ?? "").trim();
          const clientStr = String(viewRow.clientNote ?? "").trim();
          const hasNotes = termsStr !== "" || clientStr !== "";
          if (!hasNotes) {
            return null;
          }
          return (
            <div className="row align-items-center mb-3 quotation-view-terms-block">
              <div className="col-12">
                {termsStr ? (
                  <div className="mb-3">
                    <h6 className="mb-1">Terms &amp; conditions</h6>
                    <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                      {viewRow.termsAndConditions}
                    </p>
                  </div>
                ) : null}
                {clientStr ? (
                  <div className="mb-0">
                    <h6 className="mb-1">Client note</h6>
                    <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                      {viewRow.clientNote}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}
        <div className="text-center quotation-view-payment-footer">
          <div className="mb-3 invoice-logo d-flex align-items-center justify-content-center">
            <ImageWithBasePath src={quotationLogoSrc} width={130} className="img-fluid logo" alt="" />
            <ImageWithBasePath src={quotationLogoDarkSrc} width={130} className="img-fluid logo-white" alt="" />
          </div>
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {quotationFooter.paymentLine}
          </p>
          <p className="text-dark small mb-1 text-break" style={{ lineHeight: 1.45 }}>
            {compactQuotationFooterBankLine(quotationFooter.bankLine)}
          </p>
          <p className="text-muted small mb-0 text-break" style={{ lineHeight: 1.45 }}>
            {quotationFooter.closingLine}
          </p>
        </div>
      </div>
    </div>
  );
});

export default memo(QuotationPrintDocument);
