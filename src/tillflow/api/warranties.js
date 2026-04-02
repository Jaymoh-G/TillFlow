import { tillflowFetch } from './client';

export function listWarrantiesRequest(token) {
  return tillflowFetch('/warranties', { token });
}

export function listTrashedWarrantiesRequest(token) {
  return tillflowFetch('/warranties/trashed', { token });
}

export function createWarrantyRequest(token, body) {
  return tillflowFetch('/warranties', { method: 'POST', token, body });
}

export function updateWarrantyRequest(token, id, body) {
  return tillflowFetch(`/warranties/${id}`, { method: 'PATCH', token, body });
}

export function deleteWarrantyRequest(token, id) {
  return tillflowFetch(`/warranties/${id}`, { method: 'DELETE', token });
}

export function restoreWarrantyRequest(token, id) {
  return tillflowFetch(`/warranties/${id}/restore`, { method: 'POST', token });
}

