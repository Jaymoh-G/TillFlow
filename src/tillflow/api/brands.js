import { tillflowFetch, tillflowUpload } from './client';

export function listBrandsRequest(token) {
  return tillflowFetch('/brands', { token });
}

export function listTrashedBrandsRequest(token) {
  return tillflowFetch('/brands/trashed', { token });
}

export function createBrandRequest(token, body) {
  return tillflowFetch('/brands', { method: 'POST', token, body });
}

export function updateBrandRequest(token, id, body) {
  return tillflowFetch(`/brands/${id}`, { method: 'PATCH', token, body });
}

export function deleteBrandRequest(token, id) {
  return tillflowFetch(`/brands/${id}`, { method: 'DELETE', token });
}

export function restoreBrandRequest(token, id) {
  return tillflowFetch(`/brands/${id}/restore`, { method: 'POST', token });
}

export async function createBrandWithLogoRequest(token, { name, slug = null, logoFile = null }) {
  const formData = new FormData();
  formData.append('name', name);
  if (slug !== null) {
    formData.append('slug', slug);
  }
  if (logoFile) {
    formData.append('logo', logoFile);
  }
  return tillflowUpload('/brands', { method: 'POST', token, formData });
}

export async function updateBrandWithLogoRequest(token, id, { name, slug = null, logoFile = null }) {
  const formData = new FormData();
  formData.append('name', name);
  if (slug !== null) {
    formData.append('slug', slug);
  }
  if (logoFile) {
    formData.append('logo', logoFile);
  }
  return tillflowUpload(`/brands/${id}`, { method: 'PATCH', token, formData });
}
