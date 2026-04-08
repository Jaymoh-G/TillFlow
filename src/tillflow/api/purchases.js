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

export function updatePurchaseRequest(token, id, body) {
  return tillflowFetch(`/purchases/${id}`, { method: "PATCH", token, body });
}

export function deletePurchaseRequest(token, id) {
  return tillflowFetch(`/purchases/${id}`, { method: "DELETE", token });
}

export function listPurchasePaymentsRequest(token, id) {
  return tillflowFetch(`/purchases/${id}/payments`, { token });
}

export function createPurchasePaymentRequest(token, id, body) {
  return tillflowFetch(`/purchases/${id}/payments`, { method: "POST", token, body });
}

export function sendPurchaseToSupplierRequest(token, id, body) {
  return tillflowFetch(`/purchases/${id}/send-to-supplier`, { method: "POST", token, body });
}
