import { tillflowFetch } from './client';

export function listStoreManagersRequest(token) {
  return tillflowFetch('/store-managers', { token });
}

export function createStoreManagerRequest(token, body) {
  return tillflowFetch('/store-managers', { method: 'POST', token, body });
}

export function updateStoreManagerRequest(token, id, body) {
  return tillflowFetch(`/store-managers/${id}`, { method: 'PATCH', token, body });
}

export function deleteStoreManagerRequest(token, id) {
  return tillflowFetch(`/store-managers/${id}`, { method: 'DELETE', token });
}
