import { tillflowFetch } from "./client";

/**
 * Legacy TillFlow API still persists stores via `store_managers` with NOT NULL `code`.
 * Until the backend assigns ST-001 server-side, send a unique code on every create.
 */
function generateClientStoreCode() {
  return `ST-${Date.now()}`;
}

/**
 * The API still writes to `store_managers`, where `email` and `phone` are NOT NULL.
 * The Manage Stores UI does not collect or display these — we only send unique values so
 * MySQL accepts the row. Remove when the Laravel endpoint uses the `stores` table (or nullable columns).
 */
function apiOnlyLegacyStoreContact() {
  const stamp = Date.now();
  return {
    email: `store.${stamp}@noreply.local`,
    phone: String(stamp).replace(/\D/g, "").slice(-15) || "0"
  };
}

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
  const name = String(body?.name ?? body?.store_name ?? "").trim();
  const location = body?.location != null ? String(body.location).trim() : "";
  const code =
    String(body?.code ?? body?.store_code ?? "").trim() || generateClientStoreCode();
  const payload = {
    name,
    store_name: name,
    code,
    store_code: code,
    ...apiOnlyLegacyStoreContact(),
    ...(location ? { location } : {})
  };
  return tillflowFetch("/stores", { method: "POST", token, body: payload }).then((data) => ({
    ...data,
    store: data?.store ? normalizeStoreRow(data.store) : data?.store
  }));
}

export function updateStoreRequest(token, id, body) {
  const name = String(body?.name ?? body?.store_name ?? "").trim();
  const location = body?.location != null ? String(body.location).trim() : "";
  const normalizedBody = {
    name,
    store_name: name,
    ...(location ? { location } : { location: null })
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
