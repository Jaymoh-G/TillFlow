import { tillflowFetch } from './client';

/**
 * @param {string} token
 * @param {object} [params]
 * @param {number} [params.invoice_id]
 * @param {string} [params.subject_type]
 * @param {number} [params.subject_id]
 * @param {string} [params.from]
 * @param {string} [params.to]
 * @param {number} [params.per_page]
 * @param {number} [params.page]
 */
export function listActivityLogsRequest(token, params = {}) {
  const sp = new URLSearchParams();
  if (params.invoice_id != null && params.invoice_id !== '') {
    sp.set('invoice_id', String(params.invoice_id));
  }
  if (params.subject_type) {
    sp.set('subject_type', params.subject_type);
  }
  if (params.subject_id != null && params.subject_id !== '') {
    sp.set('subject_id', String(params.subject_id));
  }
  if (params.from) {
    sp.set('from', params.from);
  }
  if (params.to) {
    sp.set('to', params.to);
  }
  if (params.per_page != null) {
    sp.set('per_page', String(params.per_page));
  }
  if (params.page != null) {
    sp.set('page', String(params.page));
  }
  const qs = sp.toString() ? `?${sp.toString()}` : '';
  return tillflowFetch(`/activity-logs${qs}`, { token });
}
