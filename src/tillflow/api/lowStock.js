import { tillflowFetch } from './client';

export function listLowStockRequest(token, { onlyOut = false } = {}) {
  const qs = onlyOut ? '?only_out=1' : '';
  return tillflowFetch(`/reports/low-stock${qs}`, { token });
}

