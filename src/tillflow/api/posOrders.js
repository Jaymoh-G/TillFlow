import { tillflowFetch } from "./client";

export function listPosOrdersRequest(token) {
  return tillflowFetch("/pos-orders", { token });
}

/**
 * @param {string} token
 * @param {{ store_id?: number|string|null, date?: string|null }} [params]
 */
export function fetchPosRegisterSummaryRequest(token, params = {}) {
  const q = new URLSearchParams();
  const sid = params.store_id;
  if (sid !== undefined && sid !== null && sid !== "") {
    const n = Number(sid);
    if (Number.isFinite(n) && n > 0) {
      q.set("store_id", String(n));
    }
  }
  if (params.date) {
    q.set("date", String(params.date).trim());
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return tillflowFetch(`/pos-orders/register-summary${suffix}`, { token });
}

export function showPosOrderRequest(token, id) {
  return tillflowFetch(`/pos-orders/${encodeURIComponent(String(id))}`, { token });
}

/**
 * @param {string} token
 * @param {{
 *  customer_id?: number|null,
 *  customer_name?: string|null,
 *  customer_email?: string|null,
 *  currency?: string,
 *  discount_amount?: number,
 *  notes?: string|null,
 *  items: Array<{product_id?: number|null, sku?: string|null, product_name: string, description?: string|null, quantity: number, unit_price: number, tax_percent?: number}>,
 *  payments?: Array<{method: string, amount: number, transaction_ref?: string|null, paid_at?: string|null, notes?: string|null}>
 * }} body
 */
export function createPosOrderRequest(token, body) {
  return tillflowFetch("/pos-orders", { method: "POST", token, body });
}

export function previewPosOrderReceiptEmailRequest(token, orderId) {
  return tillflowFetch(`/pos-orders/${encodeURIComponent(String(orderId))}/email-preview`, { token });
}

export function sendPosOrderReceiptToCustomerRequest(token, orderId, options = {}) {
  const body = {};
  if (typeof options.toEmail === "string" && options.toEmail.trim()) {
    body.to_email = options.toEmail.trim();
  }
  if (typeof options.subject === "string" && options.subject.trim()) {
    body.subject = options.subject.trim();
  }
  if (typeof options.message === "string" && options.message.trim()) {
    body.message = options.message.trim();
  }
  const payload = Object.keys(body).length ? body : undefined;
  return tillflowFetch(`/pos-orders/${encodeURIComponent(String(orderId))}/send-to-customer`, {
    method: "POST",
    token,
    body: payload
  });
}

