import { forwardRef } from "react";
import { resolveInvoiceLogoUrl } from "../../constants/defaultBrandLogo";
import { getCompanySettingsSnapshot } from "../../utils/companySettingsStorage";
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import { barcodeImg3 } from "../../utils/imagepath";

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

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function hasAmount(n) {
  const x = Number(n);
  return Number.isFinite(x) && Math.abs(x) > 0.000001;
}

function moneyVal(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default forwardRef(function PosReceiptPrintDocument({ order }, ref) {
  const company = getCompanySettingsSnapshot();
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const logoSrc = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();

  const items = Array.isArray(order?.items) ? order.items : [];
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const customerName = String(order?.customer_name ?? "").trim() || "Walk-in customer";

  return (
    <div ref={ref} className="tf-pos-receipt bg-white quotation-view-print-root">
      <div className="icon-head text-center">
        <img src={logoSrc} width={110} height={34} alt="Receipt Logo" />
      </div>
      <div className="text-center info">
        <h6>{company.companyName || "Your business"}</h6>
        <p className="mb-0">{company.location || "—"}</p>
        <p className="mb-0">{company.phone || ""}</p>
      </div>

      <div className="tax-invoice">
        <h6 className="text-center">Receipt</h6>
        <div className="row">
          <div className="col-6">
            {customerName.toLowerCase() !== "walk-in customer" ? (
              <div className="invoice-user-name">
                <span>Name: </span>
                {customerName}
              </div>
            ) : null}
            <div className="invoice-user-name">
              <span>Sale ID: </span>
              {order?.order_no || "—"}
            </div>
          </div>
          <div className="col-6 text-end">
            {order?.customer_id ? (
              <div className="invoice-user-name">
                <span>Customer Id: </span>
                {`#${order.customer_id}`}
              </div>
            ) : null}
            <div className="invoice-user-name">
              <span>Date: </span>
              {formatDt(order?.completed_at)}
            </div>
          </div>
        </div>
      </div>

      <table className="table-borderless w-100 table-fit">
        <thead>
          <tr>
            <th># Item</th>
            <th>Price</th>
            <th>Qty</th>
            <th className="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((it, idx) => (
              <tr key={it.id ?? `${it.product_id ?? ""}-${it.position ?? ""}`}>
                <td>{`${idx + 1}. ${it.product_name}`}</td>
                <td>{formatKes(it.unit_price)}</td>
                <td>{Number(it.quantity ?? 0) || 0}</td>
                <td className="text-end">{formatKes(it.line_total)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center text-muted py-3">
                No items
              </td>
            </tr>
          )}

          <tr>
            <td colSpan={4}>
              <table className="table-borderless w-100 table-fit">
                <tbody>
                  {moneyVal(order?.subtotal_amount) !== moneyVal(order?.total_amount) ? (
                    <tr>
                      <td className="fw-bold">Sub Total :</td>
                      <td className="text-end">{formatKes(order?.subtotal_amount)}</td>
                    </tr>
                  ) : null}
                  {hasAmount(order?.tax_amount) ? (
                    <tr>
                      <td className="fw-bold">Tax :</td>
                      <td className="text-end">{formatKes(order?.tax_amount)}</td>
                    </tr>
                  ) : null}
                  {hasAmount(order?.discount_amount) ? (
                    <tr>
                      <td className="fw-bold">Discount :</td>
                      <td className="text-end">-{formatKes(order?.discount_amount)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="fw-bold">Total :</td>
                    <td className="text-end">{formatKes(order?.total_amount)}</td>
                  </tr>
                  {hasAmount(order?.change_amount) ? (
                    <tr>
                      <td className="fw-bold">Change :</td>
                      <td className="text-end">{formatKes(order?.change_amount)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {payments.length ? (
        <div className="mt-2 small">
          {payments.map((p) => (
            <div key={p.id ?? `${p.method}-${p.amount}`} className="d-flex justify-content-between">
              <span>{String(p.method ?? "").replace(/_/g, " ") || "payment"}</span>
              <span>{formatKes(p.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="text-center invoice-bar">
        <div className="border-bottom border-dashed">
          <p>**VAT against this challan is payable through central registration. Thank you for your business!</p>
        </div>
        <img src={barcodeImg3} alt="Barcode" />
        <p className="text-dark fw-bold mb-1">{order?.order_no || "Sale"}</p>
        <p className="mb-0">Thank You For Shopping With Us. Please Come Again</p>
      </div>
    </div>
  );
});

