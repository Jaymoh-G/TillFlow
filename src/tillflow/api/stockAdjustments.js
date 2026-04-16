import { tillflowFetch } from './client';

export function listStockAdjustmentsRequest(token) {
  return tillflowFetch('/stock-adjustments', { token });
}

/** Latest adjustments for one product (API returns up to 30 when product_id is set). */
export function listStockAdjustmentsForProductRequest(token, productId) {
  const q = new URLSearchParams({
    product_id: String(productId),
    limit: '30'
  });
  return tillflowFetch(`/stock-adjustments?${q.toString()}`, { token });
}

export function createStockAdjustmentRequest(token, body) {
  return tillflowFetch('/stock-adjustments', { method: 'POST', token, body });
}
