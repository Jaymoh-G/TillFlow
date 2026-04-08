import { tillflowFetch } from "./client";

export function listPurchaseReturnsRequest(token) {
  return tillflowFetch("/purchase-returns", { token });
}

export function createPurchaseReturnRequest(token, body) {
  return tillflowFetch("/purchase-returns", { method: "POST", token, body });
}

export function updatePurchaseReturnRequest(token, id, body) {
  return tillflowFetch(`/purchase-returns/${id}`, { method: "PATCH", token, body });
}

export function deletePurchaseReturnRequest(token, id) {
  return tillflowFetch(`/purchase-returns/${id}`, { method: "DELETE", token });
}
