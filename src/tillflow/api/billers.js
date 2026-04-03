import { tillflowFetch, tillflowUpload } from './client';

function appendBillerFieldsToFormData(formData, fields) {
  formData.append('name', fields.name);
  formData.append('company', fields.company);
  formData.append('phone', fields.phone);
  formData.append('status', fields.status);
  if (fields.email != null && fields.email !== '') {
    formData.append('email', fields.email);
  }
  if (fields.location != null && fields.location !== '') {
    formData.append('location', fields.location);
  }
}

export function listBillersRequest(token) {
  return tillflowFetch('/billers', { token });
}

export function createBillerRequest(token, body) {
  return tillflowFetch('/billers', { method: 'POST', token, body });
}

/** Multipart create when including an avatar image file. */
export function createBillerMultipartRequest(token, fields, avatarFile) {
  const formData = new FormData();
  appendBillerFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload('/billers', { method: 'POST', token, formData });
}

export function updateBillerRequest(token, id, body) {
  return tillflowFetch(`/billers/${id}`, { method: 'PATCH', token, body });
}

/** Multipart update when uploading a new avatar image. */
export function updateBillerMultipartRequest(token, id, fields, avatarFile) {
  const formData = new FormData();
  appendBillerFieldsToFormData(formData, fields);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }
  return tillflowUpload(`/billers/${id}`, { method: 'PATCH', token, formData });
}

export function deleteBillerRequest(token, id) {
  return tillflowFetch(`/billers/${id}`, { method: 'DELETE', token });
}
