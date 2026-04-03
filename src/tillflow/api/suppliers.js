import { tillflowFetch, tillflowUpload } from './client';

function appendSupplierFieldsToFormData(formData, fields) {
  formData.append('name', fields.name);
  formData.append('phone', fields.phone);
  formData.append('status', fields.status);
  if (fields.email != null && fields.email !== '') {
    formData.append('email', fields.email);
  }
  if (fields.location != null && fields.location !== '') {
    formData.append('location', fields.location);
  }
}

export function listSuppliersRequest(token) {
  return tillflowFetch('/suppliers', { token });
}

export function createSupplierRequest(token, body) {
  return tillflowFetch('/suppliers', { method: 'POST', token, body });
}

/** Multipart create when including an avatar image file. */
export function createSupplierMultipartRequest(token, fields, avatarFile) {
  const formData = new FormData();
  appendSupplierFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload('/suppliers', { method: 'POST', token, formData });
}

export function updateSupplierRequest(token, id, body) {
  return tillflowFetch(`/suppliers/${id}`, { method: 'PATCH', token, body });
}

/** Multipart update when uploading a new avatar image. */
export function updateSupplierMultipartRequest(token, id, fields, avatarFile) {
  const formData = new FormData();
  appendSupplierFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload(`/suppliers/${id}`, { method: 'PATCH', token, formData });
}

export function deleteSupplierRequest(token, id) {
  return tillflowFetch(`/suppliers/${id}`, { method: 'DELETE', token });
}
