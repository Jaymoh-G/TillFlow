import { forwardRef, memo } from "react";
import { compactQuotationFooterBankLine } from "../../utils/companySettingsStorage";

const CreditNotePrintDocument = forwardRef(function CreditNotePrintDocument(
  { noteNo, invoiceNo, issueDateDisplay, statusLabel, seller, buyer, lineRows, totals, notes, footer, logoSrc, logoDarkSrc },
  ref
) {
  const hasLogo = Boolean(String(logoSrc ?? "").trim());
  const hasDarkLogo = Boolean(String(logoDarkSrc ?? "").trim());
  const hasAnyUom = Array.isArray(lineRows) ? lineRows.some((r) => String(r?.uom ?? "").trim() !== "") : false;

  return (
    <div ref={ref} className="card border-0 shadow-none bg-white quotation-view-print-root" style={{ overflowX: "hidden" }}>
      <div className="card-body pt-2 pb-3 px-3 bg-white" style={{ overflowX: "hidden" }}>
        <div className="row g-0 justify-content-between align-items-start mb-1">
          <div className="col-md-6">
            <div className="mb-1 invoice-logo">
              {hasLogo ? <img src={logoSrc} width={130} className="img-fluid logo" alt="" /> : null}
              {hasDarkLogo ? <img src={logoDarkSrc} width={130} className="img-fluid logo-white" alt="" /> : null}
            </div>
          </div>
          <div className="col-md-6 text-end">
            <h2 className="text-black mb-0 text-uppercase fw-bolder" style={{ letterSpacing: "0.07em", fontSize: "1.5rem" }}>
              CREDIT NOTE
            </h2>
            <p className="mb-1 fw-bold text-black" style={{ fontSize: "1.05rem", marginTop: 0 }}>
              # {noteNo}
            </p>
            {invoiceNo ? <p className="mb-0 text-muted">Invoice: {invoiceNo}</p> : null}
            <p className="mb-0 fw-semibold text-uppercase text-dark">{String(statusLabel ?? "").trim()}</p>
          </div>
        </div>

        <div className="row g-0 mb-2">
          <div className="col-md-6">
            <h4 className="mb-1">{seller.companyName}</h4>
            <p className="mb-1 text-dark text-break">{seller.address || "—"}</p>
            <p className="mb-1 text-dark text-break">{seller.email || "—"}</p>
            <p className="mb-0 text-dark">{seller.phone || "—"}</p>
          </div>
          <div className="col-md-6 text-md-end">
            <p className="text-dark mb-2 fw-semibold">Credit to</p>
            <h4 className="mb-1">{buyer.name}</h4>
            {buyer.email ? <p className="mb-0 text-dark text-break">{buyer.email}</p> : null}
            <p className="mb-0 text-dark mt-1">Issue date: {issueDateDisplay}</p>
          </div>
        </div>

        <div className="table-responsive mb-3" style={{ overflowX: "hidden" }}>
          <table className="table quotation-view-line-items mb-0 bg-white w-100" style={{ tableLayout: "fixed" }}>
            <thead className="quotation-view-line-items__thead">
              <tr>
                <th className="quotation-view-line-items__head-strong text-center text-white fw-bolder" style={{ width: "2.25rem" }}>
                  #
                </th>
                <th className="quotation-view-line-items__head-strong text-white fw-bolder">Item</th>
                {hasAnyUom ? (
                  <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder" style={{ width: "5.5rem" }}>
                    UOM
                  </th>
                ) : null}
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder" style={{ width: "6rem" }}>
                  Qty
                </th>
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder" style={{ width: "7rem" }}>
                  Unit
                </th>
                <th className="quotation-view-line-items__head-strong text-end text-white fw-bolder" style={{ width: "8rem" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((r, ix) => (
                <tr key={r.key ?? ix}>
                  <td className="text-center fw-medium">{ix + 1}</td>
                  <td>
                    <h6 className="mb-0">{r.title}</h6>
                    {r.desc ? <p className="text-muted small mb-0 mt-1">{r.desc}</p> : null}
                  </td>
                  {hasAnyUom ? <td className="text-end">{r.uom || "—"}</td> : null}
                  <td className="text-end fw-medium">{r.qty}</td>
                  <td className="text-end">{r.unit}</td>
                  <td className="text-end fw-medium">{r.lineTotal}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasAnyUom ? 4 : 3} className="bg-transparent border-bottom-0" />
                <td className="text-end fw-bold border-bottom-0">Total qty</td>
                <td className="text-end fw-bold border-bottom-0">{totals.totalQty}</td>
              </tr>
              <tr>
                <td colSpan={hasAnyUom ? 4 : 3} className="bg-transparent border-bottom-0" />
                <td className="text-end fw-bold border-bottom-0">Total amount</td>
                <td className="text-end fw-bold border-bottom-0">{totals.totalAmount}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {notes ? (
          <div className="mb-3 border-bottom pb-3">
            <h6 className="mb-1">Notes</h6>
            <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
              {notes}
            </p>
          </div>
        ) : null}

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

export default memo(CreditNotePrintDocument);

