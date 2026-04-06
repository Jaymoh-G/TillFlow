import { tillflowFetch } from "./client";

export function listPurchasesRequest(token) {
  return tillflowFetch("/purchases", { token });
}

export function createPurchaseRequest(token, body) {
  return tillflowFetch("/purchases", { method: "POST", token, body });
}

export function getPurchaseRequest(token, id) {
  return tillflowFetch(`/purchases/${id}`, { token });
}

export function deletePurchaseRequest(token, id) {
  return tillflowFetch(`/purchases/${id}`, { method: "DELETE", token });
}
