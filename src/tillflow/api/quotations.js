import { tillflowFetch } from './client';

export function listQuotationsRequest(token) {
  return tillflowFetch('/quotations', { token });
}

export function createQuotationRequest(token, body) {
  return tillflowFetch('/quotations', { method: 'POST', token, body });
}

export function updateQuotationRequest(token, id, body) {
  return tillflowFetch(`/quotations/${id}`, { method: 'PATCH', token, body });
}

export function deleteQuotationRequest(token, id) {
  return tillflowFetch(`/quotations/${id}`, { method: 'DELETE', token });
}
