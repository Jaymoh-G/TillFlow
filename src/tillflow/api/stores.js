import { tillflowFetch } from "./client";

function normalizeStoreRow(row) {
  const tq = row?.total_qty;
  return {
    id: row?.id,
    name: row?.name ?? row?.store_name ?? "",
    code: row?.code ?? "",
    location: row?.location ?? null,
    total_qty: tq != null && tq !== "" ? Number(tq) : 0,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null
  };
}

export function listStoresRequest(token) {
  return tillflowFetch("/stores", { token }).then((data) => {
    const rows = Array.isArray(data?.stores) ? data.stores : [];
    return { ...data, stores: rows.map(normalizeStoreRow) };
  });
}

/** Same payload as GET /stores; allowed with stores.view (for POS / sales flows). */
export function listSalesStoresRequest(token) {
  return tillflowFetch("/sales/stores", { token }).then((data) => {
    const rows = Array.isArray(data?.stores) ? data.stores : [];
    return { ...data, stores: rows.map(normalizeStoreRow) };
  });
}

export function createStoreRequest(token, body) {
  return tillflowFetch("/stores", { method: "POST", token, body }).then((data) => ({
    ...data,
    store: data?.store ? normalizeStoreRow(data.store) : data?.store
  }));
}

export function updateStoreRequest(token, id, body) {
  const normalizedBody = {
    ...body,
    name: body?.name ?? body?.store_name ?? "",
    store_name: body?.store_name ?? body?.name ?? ""
  };
  return tillflowFetch(`/stores/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    token,
    body: normalizedBody
  }).then((data) => ({
    ...data,
    store: data?.store ? normalizeStoreRow(data.store) : data?.store
  }));
}

export function deleteStoreRequest(token, id) {
  return tillflowFetch(`/stores/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    token
  });
}
