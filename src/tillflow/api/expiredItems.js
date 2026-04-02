import { tillflowFetch } from './client';

/**
 * @param {string} token
 * @param {{ scope?: 'expired' | 'expiring', days?: number }} [params]
 */
export function listExpiredItemsRequest(token, { scope = 'expired', days = 30 } = {}) {
  const qs = new URLSearchParams();
  qs.set('scope', scope === 'expiring' ? 'expiring' : 'expired');
  if (scope === 'expiring' && days != null) {
    qs.set('days', String(days));
  }
  const q = qs.toString();
  return tillflowFetch(`/reports/expired-items${q ? `?${q}` : ''}`, { token });
}
