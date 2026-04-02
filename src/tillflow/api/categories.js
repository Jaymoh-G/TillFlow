import { tillflowFetch } from './client';

export function listCategoriesRequest(token) {
  return tillflowFetch('/categories', { token });
}

export function listTrashedCategoriesRequest(token) {
  return tillflowFetch('/categories/trashed', { token });
}

export function createCategoryRequest(token, body) {
  return tillflowFetch('/categories', { method: 'POST', token, body });
}

export function updateCategoryRequest(token, id, body) {
  return tillflowFetch(`/categories/${id}`, { method: 'PATCH', token, body });
}

export function deleteCategoryRequest(token, id) {
  return tillflowFetch(`/categories/${id}`, { method: 'DELETE', token });
}

export function restoreCategoryRequest(token, id) {
  return tillflowFetch(`/categories/${id}/restore`, { method: 'POST', token });
}
