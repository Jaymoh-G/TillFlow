import { tillflowFetch } from './client';

export function listVariantAttributesRequest(token) {
  return tillflowFetch('/variant-attributes', { token });
}

export function listTrashedVariantAttributesRequest(token) {
  return tillflowFetch('/variant-attributes/trashed', { token });
}

export function createVariantAttributeRequest(token, body) {
  return tillflowFetch('/variant-attributes', { method: 'POST', token, body });
}

export function updateVariantAttributeRequest(token, id, body) {
  return tillflowFetch(`/variant-attributes/${id}`, { method: 'PATCH', token, body });
}

export function deleteVariantAttributeRequest(token, id) {
  return tillflowFetch(`/variant-attributes/${id}`, { method: 'DELETE', token });
}

export function restoreVariantAttributeRequest(token, id) {
  return tillflowFetch(`/variant-attributes/${id}/restore`, { method: 'POST', token });
}

