import { tillflowFetch } from './client';

export function listLeadsRequest(token) {
  return tillflowFetch('/leads', { token });
}

export function getLeadRequest(token, id) {
  return tillflowFetch(`/leads/${encodeURIComponent(id)}`, { token });
}

export function listLeadProposalsRequest(token, leadId) {
  return tillflowFetch(`/leads/${encodeURIComponent(leadId)}/proposals`, { token });
}

export function convertLeadToCustomerRequest(token, leadId, body = {}) {
  return tillflowFetch(`/leads/${encodeURIComponent(leadId)}/convert-to-customer`, { method: 'POST', token, body });
}

export function createLeadRequest(token, body) {
  return tillflowFetch('/leads', { method: 'POST', token, body });
}

export function updateLeadRequest(token, id, body) {
  return tillflowFetch(`/leads/${id}`, { method: 'PATCH', token, body });
}

export function deleteLeadRequest(token, id) {
  return tillflowFetch(`/leads/${id}`, { method: 'DELETE', token });
}
