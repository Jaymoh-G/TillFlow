import { TILLFLOW_API_BASE_URL } from '../config';
import { TillFlowApiError } from './errors';

/**
 * @param {string} path Path under API v1, e.g. `/health`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object|undefined} [options.body]
 * @param {string|null|undefined} [options.token]
 * @param {Record<string, string>} [options.headers]
 * @returns {Promise<any>} Unwrapped `data` from API envelope
 */
export async function tillflowFetch(path, options = {}) {
  const { method = 'GET', body, token = null, headers: extra = {} } = options;
  const url = `${TILLFLOW_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json', ...extra };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  /** @type {RequestInit} */
  const init = { method, headers };

  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new TillFlowApiError('Invalid JSON response', res.status, null);
  }

  const isEnvelope =
    json && typeof json === 'object' && 'success' in json && 'data' in json;

  if (!isEnvelope) {
    throw new TillFlowApiError(
      (json && json.message) || res.statusText || 'Unexpected response',
      res.status,
      json
    );
  }

  if (!json.success || res.ok === false) {
    const message = json.message || 'Request failed';
    throw new TillFlowApiError(message, res.status, json.data ?? null);
  }

  return json.data;
}

/**
 * Same envelope/error behavior as `tillflowFetch`, but supports multipart bodies (FormData).
 *
 * @param {string} path Path under API v1, e.g. `/health`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {FormData} options.formData
 * @param {string|null|undefined} [options.token]
 * @returns {Promise<any>}
 */
export async function tillflowUpload(path, options = {}) {
  let method = String(options.method || 'POST').toUpperCase();
  const { formData, token = null } = options;
  const url = `${TILLFLOW_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Real HTTP PATCH/PUT with multipart bodies often leaves $_FILES empty on PHP.
  // POST + method override matches HTML forms and ensures file uploads are parsed.
  let fetchMethod = method;
  if (method === 'PATCH' || method === 'PUT') {
    headers['X-HTTP-Method-Override'] = method;
    fetchMethod = 'POST';
    const hasMethodField =
      typeof formData.has === 'function' && formData.has('_method');
    if (!hasMethodField) {
      formData.append('_method', method);
    }
  }

  const res = await fetch(url, { method: fetchMethod, headers, body: formData });
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new TillFlowApiError('Invalid JSON response', res.status, null);
  }

  const isEnvelope = json && typeof json === 'object' && 'success' in json && 'data' in json;
  if (!isEnvelope) {
    throw new TillFlowApiError(
      (json && json.message) || res.statusText || 'Unexpected response',
      res.status,
      json
    );
  }

  if (!json.success || res.ok === false) {
    const message = json.message || 'Request failed';
    throw new TillFlowApiError(message, res.status, json.data ?? null);
  }

  return json.data;
}

export function fetchHealth() {
  return tillflowFetch('/health');
}

export function fetchReady() {
  return tillflowFetch('/ready');
}
