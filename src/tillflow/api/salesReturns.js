import { tillflowFetch } from './client';

/**
 * @param {string|null} token
 * @param {object} [params]
 * @param {string} [params.q]
 * @param {string|number} [params.customer_id]
 * @param {string} [params.status]
 * @param {string} [params.payment_status]
 * @param {string} [params.from]
 * @param {string} [params.to]
 * @param {string} [params.sort]
 */
export function listSalesReturnsRequest(token, params = {}) {
  const q = new URLSearchParams();
  if (params.q) {
    q.set('q', String(params.q));
  }
  if (params.customer_id != null && params.customer_id !== '') {
    q.set('customer_id', String(params.customer_id));
  }
  if (params.status) {
    q.set('status', String(params.status));
  }
  if (params.payment_status) {
    q.set('payment_status', String(params.payment_status));
  }
  if (params.from) {
    q.set('from', String(params.from));
  }
  if (params.to) {
    q.set('to', String(params.to));
  }
  if (params.sort) {
    q.set('sort', String(params.sort));
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return tillflowFetch(`/sales-returns${suffix}`, { token });
}

/**
 * @param {string|null} token
 * @param {object} body
 */
export function createSalesReturnRequest(token, body) {
  return tillflowFetch('/sales-returns', { method: 'POST', token, body });
}

/**
 * @param {string|null} token
 * @param {string|number} id
 * @param {object} body
 */
export function updateSalesReturnRequest(token, id, body) {
  return tillflowFetch(`/sales-returns/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    token,
    body,
  });
}

/**
 * @param {string|null} token
 * @param {string|number} id
 */
export function deleteSalesReturnRequest(token, id) {
  return tillflowFetch(`/sales-returns/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    token,
  });
}
