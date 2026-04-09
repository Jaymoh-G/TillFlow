import { tillflowFetch } from "./client";

export const INVOICE_PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" }
];

export function paymentMethodLabel(method) {
  const m = String(method ?? "").trim();
  const map = {
    cash: "Cash",
    bank_transfer: "Bank transfer",
    mpesa: "M-Pesa",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
    opening_balance: "Opening balance"
  };
  return map[m] || (m ? m.replace(/_/g, " ") : "—");
}

export function listAllInvoicePaymentsRequest(token, params = {}) {
  const q = new URLSearchParams();
  if (params.invoice_id != null && params.invoice_id !== "") {
    q.set("invoice_id", String(params.invoice_id));
  }
  if (params.from) {
    q.set("from", params.from);
  }
  if (params.to) {
    q.set("to", params.to);
  }
  if (params.q) {
    q.set("q", params.q);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return tillflowFetch(`/invoice-payments${suffix}`, { token });
}

export function listInvoicePaymentsRequest(token, invoiceId) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(invoiceId))}/payments`, { token });
}

export function createInvoicePaymentRequest(token, invoiceId, body) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(invoiceId))}/payments`, {
    method: "POST",
    token,
    body
  });
}

export function updateInvoicePaymentRequest(token, invoiceId, paymentId, body) {
  return tillflowFetch(
    `/invoices/${encodeURIComponent(String(invoiceId))}/payments/${encodeURIComponent(String(paymentId))}`,
    { method: "PATCH", token, body }
  );
}

export function deleteInvoicePaymentRequest(token, invoiceId, paymentId) {
  return tillflowFetch(
    `/invoices/${encodeURIComponent(String(invoiceId))}/payments/${encodeURIComponent(String(paymentId))}`,
    { method: "DELETE", token }
  );
}
