import { tillflowFetch } from './client';

export function listUnitsRequest(token) {
  return tillflowFetch('/units', { token });
}

export function listTrashedUnitsRequest(token) {
  return tillflowFetch('/units/trashed', { token });
}

export function createUnitRequest(token, body) {
  return tillflowFetch('/units', { method: 'POST', token, body });
}

export function updateUnitRequest(token, id, body) {
  return tillflowFetch(`/units/${id}`, { method: 'PATCH', token, body });
}

export function deleteUnitRequest(token, id) {
  return tillflowFetch(`/units/${id}`, { method: 'DELETE', token });
}

export function restoreUnitRequest(token, id) {
  return tillflowFetch(`/units/${id}/restore`, { method: 'POST', token });
}

