/**
 * Inventory stores (stock locations) — persisted locally for the SPA.
 * Used by Manage Stores and Transfer Stock.
 *
 * loadStores() is used as getSnapshot for useSyncExternalStore: it must stay
 * pure during React render and return the same array reference when data is
 * unchanged (see React docs).
 */

const LS_KEY = "retailpos_inventory_stores_v1";

/** @type {Set<() => void>} */
const listeners = new Set();

export const STORES_SEED = [
  { id: 1, name: "Lavish Store", code: "LVH" },
  { id: 2, name: "North Zone Store", code: "NZS" },
  { id: 3, name: "Lobar Handy", code: "LBH" },
  { id: 4, name: "Nova Storage Hub", code: "NSH" },
  { id: 5, name: "Quaint Store", code: "QUI" },
  { id: 6, name: "Cool Store", code: "COO" },
  { id: 7, name: "Traditional Store", code: "TRD" },
  { id: 8, name: "Retail Supply Hub", code: "RSH" },
  { id: 9, name: "EdgeWare Solutions", code: "EWS" },
  { id: 10, name: "Overflow Store", code: "OVF" },
  { id: 11, name: "Fulfillment Hub", code: "FUL" }
];

function seedWithMeta(list) {
  const t = new Date().toISOString();
  return list.map((s) => ({
    ...s,
    createdAt: s.createdAt ?? t,
    updatedAt: s.updatedAt ?? t
  }));
}

/** Stable snapshot for SSR / getServerSnapshot */
const SERVER_SNAPSHOT = Object.freeze(
  seedWithMeta(STORES_SEED.map((s) => ({ ...s })))
);
const EMPTY_SNAPSHOT = Object.freeze([]);

/** @type {string | null} */
let snapshotJson = null;
/** @type {readonly { id: number; name: string; code: string; createdAt?: string; updatedAt?: string }[] | null} */
let snapshotCache = null;

function parse(raw) {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Run once in the browser before any component reads the store.
 * Avoids writing localStorage inside useSyncExternalStore's getSnapshot.
 */
function ensureLocalStorageSeed() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname.includes("/admin")) {
    return;
  }
  const existing = parse(localStorage.getItem(LS_KEY));
  if (existing?.length) {
    return;
  }
  const seeded = seedWithMeta(STORES_SEED.map((s) => ({ ...s })));
  localStorage.setItem(LS_KEY, JSON.stringify(seeded));
}

if (typeof window !== "undefined") {
  ensureLocalStorageSeed();
}

function commitSnapshotFromParsed(list) {
  const json = JSON.stringify(list);
  if (json === snapshotJson && snapshotCache) {
    return snapshotCache;
  }
  snapshotJson = json;
  snapshotCache = Object.freeze(list.map((s) => ({ ...s })));
  return snapshotCache;
}

export function loadStores() {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT;
  }
  const list = parse(localStorage.getItem(LS_KEY));
  if (!list?.length) {
    if (window.location.pathname.includes("/admin")) {
      return EMPTY_SNAPSHOT;
    }
    ensureLocalStorageSeed();
    const again = parse(localStorage.getItem(LS_KEY));
    if (!again?.length) {
      return SERVER_SNAPSHOT;
    }
    return commitSnapshotFromParsed(again);
  }
  return commitSnapshotFromParsed(list);
}

export function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function subscribeStores(onStoreChange) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function saveStores(list) {
  if (typeof window === "undefined") {
    return;
  }
  const serialized = JSON.stringify(list);
  localStorage.setItem(LS_KEY, serialized);
  snapshotJson = serialized;
  snapshotCache = Object.freeze(list.map((s) => ({ ...s })));
  notify();
}

export function storeLabel(stores, id) {
  if (id == null || id === "") {
    return "—";
  }
  const n = Number(id);
  const s = stores.find((x) => x.id === n);
  return s?.name ?? `Store #${id}`;
}

export function addStore({ name, code }) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required." };
  }
  const list = [...loadStores()];
  const nextId = Math.max(0, ...list.map((x) => x.id)) + 1;
  const c = (code || "").trim() || `S${nextId}`;
  const now = new Date().toISOString();
  const row = {
    id: nextId,
    name: trimmed,
    code: c,
    createdAt: now,
    updatedAt: now
  };
  saveStores([...list, row]);
  return { ok: true };
}

export function updateStore(id, { name, code }) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required." };
  }
  const n = Number(id);
  const list = [...loadStores()];
  const idx = list.findIndex((x) => x.id === n);
  if (idx < 0) {
    return { ok: false, error: "Store not found." };
  }
  const c = (code || "").trim() || list[idx].code;
  const now = new Date().toISOString();
  const next = [...list];
  next[idx] = { ...next[idx], name: trimmed, code: c, updatedAt: now };
  saveStores(next);
  return { ok: true };
}

export function deleteStore(id) {
  const n = Number(id);
  const list = [...loadStores()];
  saveStores(list.filter((x) => x.id !== n));
  return { ok: true };
}
