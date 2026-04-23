import { tillflowFetch, tillflowUpload } from './client';

function token() {
  return localStorage.getItem('tillflow_sanctum_token');
}

export async function fetchTenantContacts() {
  return tillflowFetch('/tenant/contacts', { token: token() });
}

export async function fetchPlatformTenantContacts(tenantId) {
  return tillflowFetch(`/platform/tenants/${tenantId}/contacts`, { token: token() });
}

/**
 * @param {FormData} formData
 */
export async function createTenantContact(formData) {
  return tillflowUpload('/tenant/contacts', { method: 'POST', formData, token: token() });
}

/**
 * @param {FormData} formData
 */
export async function createPlatformTenantContact(tenantId, formData) {
  return tillflowUpload(`/platform/tenants/${tenantId}/contacts`, {
    method: 'POST',
    formData,
    token: token()
  });
}

/**
 * @param {number|string} tenantId
 * @param {number|string} contactId
 * @param {FormData} formData
 */
export async function updatePlatformTenantContact(tenantId, contactId, formData) {
  return tillflowUpload(`/platform/tenants/${tenantId}/contacts/${contactId}`, {
    method: 'PATCH',
    formData,
    token: token()
  });
}

export async function deletePlatformTenantContact(tenantId, contactId) {
  return tillflowFetch(`/platform/tenants/${tenantId}/contacts/${contactId}`, {
    method: 'DELETE',
    token: token()
  });
}

/**
 * @param {number|string} contactId
 * @param {FormData} formData
 */
export async function updateTenantContact(contactId, formData) {
  return tillflowUpload(`/tenant/contacts/${contactId}`, {
    method: 'PATCH',
    formData,
    token: token()
  });
}

export async function deleteTenantContact(contactId) {
  return tillflowFetch(`/tenant/contacts/${contactId}`, {
    method: 'DELETE',
    token: token()
  });
}
