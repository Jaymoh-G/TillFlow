import { tillflowFetch } from "./client";
import { TillFlowApiError } from "./errors";

function normalizeStoreFromManagerLike(row) {
  return {
    id: row?.id,
    name: row?.name ?? row?.store_name ?? "",
    code: row?.code ?? "",
    location: row?.location ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null
  };
}

async function withStoresFallback(primaryCall, fallbackCall) {
  try {
    return await primaryCall();
  } catch (e) {
    if (e instanceof TillFlowApiError && e.status === 404) {
      return fallbackCall();
    }
    throw e;
  }
}

async function getStoreManagerFallbackRow(token, id) {
  const data = await tillflowFetch("/store-managers", { token });
  const rows = Array.isArray(data?.store_managers) ? data.store_managers : [];
  return rows.find((row) => String(row?.id ?? "") === String(id)) ?? null;
}

export function listStoresRequest(token) {
  return withStoresFallback(
    () => tillflowFetch("/stores", { token }),
    async () => {
      const data = await tillflowFetch("/store-managers", { token });
      const rows = Array.isArray(data?.store_managers) ? data.store_managers : [];
      return { stores: rows.map(normalizeStoreFromManagerLike) };
    }
  );
}

export function createStoreRequest(token, body) {
  return withStoresFallback(
    () => tillflowFetch("/stores", { method: "POST", token, body }),
    async () => {
      const name = String(body?.name ?? "").trim();
      if (!name) {
        throw new Error("Store name is required.");
      }
      const data = await tillflowFetch("/store-managers", {
        method: "POST",
        token,
        body: {
          store_name: name,
          code: body?.code ?? null,
          location: body?.location ?? null,
          username: `store_${Date.now().toString().slice(-6)}`,
          password: "Store@12345",
          phone: `07${(`${Date.now()}${Math.floor(Math.random() * 1000)}`).slice(-9)}`,
          status: "Active"
        }
      });
      return { store: normalizeStoreFromManagerLike(data?.store_manager ?? data?.store ?? {}) };
    }
  );
}

export function updateStoreRequest(token, id, body) {
  const normalizedBody = {
    ...body,
    name: body?.name ?? body?.store_name ?? "",
    store_name: body?.store_name ?? body?.name ?? ""
  };
  return withStoresFallback(
    () =>
      tillflowFetch(`/stores/${encodeURIComponent(String(id))}`, {
        method: "PUT",
        token,
        body: normalizedBody
      }),
    async () => {
      const current = await getStoreManagerFallbackRow(token, id);
      const data = await tillflowFetch(`/store-managers/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        token,
        body: {
          store_name: normalizedBody.store_name,
          code: normalizedBody?.code ?? null,
          location: normalizedBody?.location ?? null,
          username: current?.username ?? `store_${Date.now().toString().slice(-6)}`,
          phone: current?.phone ?? `07${(`${Date.now()}${Math.floor(Math.random() * 1000)}`).slice(-9)}`,
          status: current?.status ?? "Active",
          email: current?.email ?? null
        }
      });
      return { store: normalizeStoreFromManagerLike(data?.store_manager ?? data?.store ?? {}) };
    }
  );
}

export function deleteStoreRequest(token, id) {
  return withStoresFallback(
    () =>
      tillflowFetch(`/stores/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        token
      }),
    () =>
      tillflowFetch(`/store-managers/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        token
      })
  );
}
