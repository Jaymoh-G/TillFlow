import { tillflowFetch, tillflowUpload } from './client';

function appendCustomerFieldsToFormData(formData, fields) {
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

export function listCustomersRequest(token) {
  return tillflowFetch('/customers', { token });
}

export function createCustomerRequest(token, body) {
  return tillflowFetch('/customers', { method: 'POST', token, body });
}

/** Multipart create when including an avatar image file. */
export function createCustomerMultipartRequest(token, fields, avatarFile) {
  const formData = new FormData();
  appendCustomerFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload('/customers', { method: 'POST', token, formData });
}

export function updateCustomerRequest(token, id, body) {
  return tillflowFetch(`/customers/${id}`, { method: 'PATCH', token, body });
}

/** Multipart update when uploading a new avatar image. */
export function updateCustomerMultipartRequest(token, id, fields, avatarFile) {
  const formData = new FormData();
  appendCustomerFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload(`/customers/${id}`, { method: 'PATCH', token, formData });
}

export function deleteCustomerRequest(token, id) {
  return tillflowFetch(`/customers/${id}`, { method: 'DELETE', token });
}
