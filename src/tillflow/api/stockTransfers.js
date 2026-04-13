import { tillflowFetch } from "./client";

/**
 * @param {string} token
 * @returns {Promise<{ transfers?: unknown[] }>}
 */
export function listStockTransfersRequest(token) {
  return tillflowFetch("/stock-transfers", { token });
}

/**
 * @param {string} token
 * @param {Record<string, unknown>} body
 */
export function createStockTransferRequest(token, body) {
  return tillflowFetch("/stock-transfers", { method: "POST", token, body });
}

/**
 * @param {string} token
 * @param {number|string} id
 * @param {Record<string, unknown>} body
 */
export function updateStockTransferRequest(token, id, body) {
  return tillflowFetch(`/stock-transfers/${id}`, {
    method: "PATCH",
    token,
    body
  });
}

/**
 * @param {string} token
 * @param {number|string} id
 */
export function deleteStockTransferRequest(token, id) {
  return tillflowFetch(`/stock-transfers/${id}`, { method: "DELETE", token });
}

/**
 * Map API transfer payload to the shape used by `stock-transfer.jsx`.
 * @param {Record<string, any>} t
 */
export function apiStockTransferToRow(t) {
  if (!t || typeof t !== "object") {
    return null;
  }
  return {
    id: t.id,
    fromStoreId: t.from_store_id,
    toStoreId: t.to_store_id,
    refNumber: t.ref_number,
    notes: t.notes ?? "",
    noOfProducts: t.no_of_products,
    quantityTransferred: t.quantity_transferred,
    date: t.date,
    createdAt: t.created_at ?? null,
    lines: Array.isArray(t.lines)
      ? t.lines.map((l) => ({
          lineId: l.line_id,
          productId: l.product_id,
          name: l.name,
          sku: l.sku,
          category: l.category,
          qty: l.qty
        }))
      : []
  };
}
