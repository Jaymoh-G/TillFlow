import { tillflowFetch } from './client';

/**
 * @param {string} token
 * @param {object} params
 * @param {string} params.q
 * @param {string[]|undefined} params.entities Entity keys matching backend (e.g. `customers`, `products`).
 * @param {number|undefined} params.limit Per-entity limit (1–15).
 * @param {AbortSignal|undefined} params.signal
 * @returns {Promise<{ query: string, limit: number, groups: Array<{ type: string, label: string, total: number, items: Array<{ type: string, id: number, title: string, subtitle?: string|null, href: string, meta?: object }> }> }>}
 */
export function globalSearchRequest(token, { q, entities, limit, signal }) {
  const sp = new URLSearchParams();
  sp.set('q', q);
  if (Array.isArray(entities)) {
    for (const e of entities) {
      if (e) sp.append('entities[]', String(e));
    }
  }
  if (limit != null && limit !== '') {
    sp.set('limit', String(limit));
  }
  const qs = sp.toString();
  const path = `/search/global?${qs}`;
  return tillflowFetch(path, { token, signal });
}
