import { tillflowFetch } from "./client";

export function listPosOrdersRequest(token) {
  return tillflowFetch("/pos-orders", { token });
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

