import { tillflowFetch } from './client';

export function listInvoicesRequest(token) {
  return tillflowFetch('/invoices', { token });
}

export function showInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${id}`, { token });
}

export function createInvoiceRequest(token, body) {
  return tillflowFetch('/invoices', { method: 'POST', token, body });
}

export function updateInvoiceRequest(token, id, body) {
  return tillflowFetch(`/invoices/${id}`, { method: 'PATCH', token, body });
}

export function deleteInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${id}`, { method: 'DELETE', token });
}
