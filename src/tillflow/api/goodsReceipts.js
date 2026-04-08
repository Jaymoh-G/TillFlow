import { tillflowFetch } from "./client";

export function listPurchaseReceiptsRequest(token, purchaseId) {
  return tillflowFetch(`/purchases/${purchaseId}/receipts`, { token });
}

export function createGoodsReceiptRequest(token, purchaseId, body) {
  return tillflowFetch(`/purchases/${purchaseId}/receive`, {
    method: "POST",
    token,
    body
  });
}
