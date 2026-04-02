import { tillflowFetch } from './client';

export function listStockAdjustmentsRequest(token) {
  return tillflowFetch('/stock-adjustments', { token });
}

export function createStockAdjustmentRequest(token, body) {
  return tillflowFetch('/stock-adjustments', { method: 'POST', token, body });
}
