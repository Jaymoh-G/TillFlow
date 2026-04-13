import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import PosReceiptPrintDocument from "../../feature-module/sales/PosReceiptPrintDocument";
import PosModals from "../../core/modals/pos-modal/posModalstjsx";
import { card, cashIcon, deposit, points } from "../../utils/imagepath";
import { TillFlowApiError } from "../api/errors";
import { listSalesCatalogProductsRequest } from "../api/products";
import { createCustomerRequest, listCustomersRequest } from "../api/customers";
import { createPosOrderRequest, listPosOrdersRequest, showPosOrderRequest } from "../api/posOrders";
import { listStoresRequest } from "../api/stores";
import { useAuth } from "../auth/AuthContext";
import {
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import { printPosReceiptThermal } from "../utils/printPosReceiptThermal";

function formatKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "—";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

function parseMoneyish(raw) {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function normalizeCategoryLabel(p) {
  const fromApi = p?.category?.name;
  const fallback = p?.category_name;
  const name = String(fromApi ?? fallback ?? "").trim();
  return name || "Uncategorized";
}

function normalizeSku(p) {
  const sku = String(p?.sku ?? "").trim();
  return sku || null;
}

function normalizeProductName(p) {
  return String(p?.name ?? "Item").trim() || "Item";
}

function normalizeUnitPrice(p) {
  const selling = p?.selling_price ?? p?.sellingPrice;
  const n = Number(selling);
  return Number.isFinite(n) ? round2(n) : 0;
}

function qtyAtStore(p, storeId) {
  if (storeId == null || storeId === "") {
    const n = Number(p?.qty);
    return Number.isFinite(n) ? n : null;
  }
  const rows = Array.isArray(p?.store_stocks) ? p.store_stocks : [];
  if (!rows.length) {
    const n = Number(p?.qty);
    return Number.isFinite(n) ? n : null;
  }
  const hit = rows.find((r) => Number(r.store_id) === Number(storeId));
  if (hit != null) {
    return Number(hit.qty);
  }
  return 0;
}

function normalizeQtyAvailable(p, storeId) {
  return qtyAtStore(p, storeId);
}

/**
 * Decrease each product's `qty` by sold amounts (matches `product_id`, else `sku`).
 * Skips rows with unknown stock (`qty` null/NaN). Server should persist the same deduction.
 * @param {Array<Record<string, unknown>>} products
 * @param {Array<{ product_id?: number|null, sku?: string|null, quantity?: number }>} soldItems
 * @param {string|number|null|undefined} storeId
 */
function applySaleDeductionToProducts(products, soldItems, storeId) {
  if (!Array.isArray(products) || !Array.isArray(soldItems) || !soldItems.length) {
    return products;
  }
  const byPid = new Map();
  const bySku = new Map();
  for (const row of soldItems) {
    const q = round2(Number(row?.quantity) || 0);
    if (q <= 0) continue;
    const pid = row?.product_id != null ? Number(row.product_id) : null;
    if (pid != null && Number.isFinite(pid)) {
      byPid.set(pid, round2((byPid.get(pid) || 0) + q));
    } else {
      const sku = String(row?.sku ?? "").trim();
      if (sku) {
        bySku.set(sku, round2((bySku.get(sku) || 0) + q));
      }
    }
  }
  if (!byPid.size && !bySku.size) {
    return products;
  }
  return products.map((p) => {
    let sold = 0;
    if (p?.id != null && byPid.has(Number(p.id))) {
      sold = byPid.get(Number(p.id));
    } else {
      const sku = normalizeSku(p);
      if (sku && bySku.has(sku)) {
        sold = bySku.get(sku);
      }
    }
    if (sold <= 0) return p;
    if (storeId == null || storeId === "") {
      const current = qtyAtStore(p, null);
      if (current == null) return p;
      const next = Math.max(0, round2(current - sold));
      return { ...p, qty: next };
    }
    const current = qtyAtStore(p, storeId);
    if (current == null) return p;
    const next = Math.max(0, round2(current - sold));
    const rows = Array.isArray(p.store_stocks) ? p.store_stocks.map((r) => ({ ...r })) : [];
    const idx = rows.findIndex((r) => Number(r.store_id) === Number(storeId));
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], qty: next };
    } else {
      rows.push({ store_id: Number(storeId), qty: next });
    }
    const total = rows.reduce((acc, r) => acc + Number(r.qty || 0), 0);
    return { ...p, qty: total, store_stocks: rows };
  });
}

function normalizeCustomerLabel(c) {
  const name = String(c?.name ?? "").trim();
  const phone = String(c?.phone ?? "").trim();
  if (name && phone) {
    return `${name} (${phone})`;
  }
  return name || phone || "Customer";
}

export default function PosRegister() {
  const { token, user } = useAuth();
  const receiptRootRef = useRef(null);
  const queueKey = "tillflow_pos_queue_v1";
  const holdKey = "tillflow_pos_holds_v1";
  const lastReceiptKey = "tillflow_pos_last_receipt_v1";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [searchQ, setSearchQ] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCustomerBusy, setAddCustomerBusy] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  const [cart, setCart] = useState(() => /** @type {Array<{key:string, product_id:number|null, sku:string|null, product_name:string, unit_price:number, quantity:number, tax_percent:number}>} */ ([]));

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [holdReference, setHoldReference] = useState("");
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountDraft, setDiscountDraft] = useState("");
  const [emptyHoldNoticeOpen, setEmptyHoldNoticeOpen] = useState(false);
  const [lastOrderNo, setLastOrderNo] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);


  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [queueCount, setQueueCount] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const [holdCount, setHoldCount] = useState(0);
  const [heldOrdersOpen, setHeldOrdersOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState([]);

  const readQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(queueKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, []);

  const writeQueue = useCallback((rows) => {
    try {
      localStorage.setItem(queueKey, JSON.stringify(rows));
    } catch {
      /* ignore quota */
    }
    setQueueCount(Array.isArray(rows) ? rows.length : 0);
  }, []);

  const readHolds = useCallback(() => {
    try {
      const raw = localStorage.getItem(holdKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, []);

  const writeHolds = useCallback((rows) => {
    try {
      localStorage.setItem(holdKey, JSON.stringify(rows));
    } catch {
      /* ignore quota */
    }
    setHoldCount(Array.isArray(rows) ? rows.length : 0);
  }, []);

  const refreshHeldOrders = useCallback(() => {
    setHeldOrders(readHolds());
  }, [readHolds]);

  useEffect(() => {
    setQueueCount(readQueue().length);
  }, [readQueue]);

  useEffect(() => {
    setHoldCount(readHolds().length);
  }, [readHolds]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lastReceiptKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const orderNo = String(parsed?.order_no ?? "").trim();
        setLastOrder(parsed);
        setLastOrderNo(orderNo);
      }
    } catch {
      /* ignore invalid local receipt snapshot */
    }
  }, []);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError("Sign in to use POS.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [prodData, custData, storeData] = await Promise.all([
          listSalesCatalogProductsRequest(token),
          listCustomersRequest(token),
          listStoresRequest(token)
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(prodData?.products) ? prodData.products : []);
        setCustomers(Array.isArray(custData?.customers) ? custData.customers : []);
        setStores(Array.isArray(storeData?.stores) ? storeData.stores : []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof TillFlowApiError) {
          setLoadError(e.message);
        } else {
          setLoadError("Could not load POS catalog.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!displayStores.length) {
      setSelectedStoreId("");
      return;
    }
    try {
      const saved = localStorage.getItem("tillflow_pos_store_id");
      const want = saved != null ? Number(saved) : NaN;
      const match = displayStores.find((s) => Number(s.id) === want);
      setSelectedStoreId(match ? match.id : displayStores[0].id);
    } catch {
      setSelectedStoreId(displayStores[0].id);
    }
  }, [displayStores]);

  useEffect(() => {
    if (selectedStoreId == null || selectedStoreId === "") {
      return;
    }
    try {
      localStorage.setItem("tillflow_pos_store_id", String(selectedStoreId));
    } catch {
      /* ignore quota */
    }
  }, [selectedStoreId]);

  const categoryOptions = useMemo(() => {
    const names = new Set(products.map((p) => normalizeCategoryLabel(p)));
    const sorted = ["All", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
    return sorted;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return products.filter((p) => {
      const cat = normalizeCategoryLabel(p);
      if (activeCategory !== "All" && cat !== activeCategory) return false;
      if (!q) return true;
      const sku = String(p?.sku ?? "").toLowerCase();
      const name = String(p?.name ?? "").toLowerCase();
      return sku.includes(q) || name.includes(q);
    });
  }, [products, searchQ, activeCategory]);

  const selectedCustomer = useMemo(() => {
    const id = String(selectedCustomerId || "");
    if (!id) return null;
    return customers.find((c) => String(c.id) === id) ?? null;
  }, [customers, selectedCustomerId]);

  const displayStores = useMemo(() => {
    const raw = user?.allowed_store_ids;
    if (!Array.isArray(raw) || raw.length === 0) {
      return stores;
    }
    const allowed = new Set(raw.map((x) => Number(x)));
    return stores.filter((s) => allowed.has(Number(s.id)));
  }, [stores, user]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of cart) {
      const lineSub = round2(line.quantity * line.unit_price);
      const lineTax = round2(lineSub * (Number(line.tax_percent || 0) / 100));
      subtotal += lineSub;
      tax += lineTax;
    }
    subtotal = round2(subtotal);
    tax = round2(tax);
    const discount = Math.max(0, round2(parseMoneyish(discountAmount)));
    const pre = round2(subtotal + tax);
    const disc = Math.min(discount, pre);
    const total = round2(Math.max(0, pre - disc));
    const tend = Math.max(0, round2(parseMoneyish(tendered)));
    const change = round2(Math.max(0, tend - total));
    return { subtotal, tax, discount: disc, total, tendered: tend, change };
  }, [cart, tendered, discountAmount]);

  const addToCart = useCallback((p) => {
    const sid = selectedStoreId;
    if (!sid) {
      window.alert("Select a store before adding items.");
      return;
    }
    const idNum = p?.id != null ? Number(p.id) : null;
    const sku = normalizeSku(p);
    const name = normalizeProductName(p);
    const unit = normalizeUnitPrice(p);
    const avail = qtyAtStore(p, sid);
    setCart((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => (idNum != null ? x.product_id === idNum : false));
      if (idx >= 0) {
        let other = 0;
        for (const l of next) {
          if (l.key === next[idx].key) continue;
          if (idNum != null && l.product_id === idNum) {
            other += Number(l.quantity) || 0;
          }
        }
        const maxQ = avail == null ? Infinity : round2(Math.max(0, avail - other));
        const cand = round2(next[idx].quantity + 1);
        if (cand > maxQ) {
          return prev;
        }
        next[idx] = { ...next[idx], quantity: cand };
        return next;
      }
      if (avail != null && avail < 1) {
        return prev;
      }
      return [
        ...next,
        {
          key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          product_id: idNum,
          sku,
          product_name: name,
          unit_price: unit,
          quantity: 1,
          tax_percent: 0
        }
      ];
    });
  }, [selectedStoreId]);

  const setLineQty = useCallback(
    (key, qty) => {
      const q = Math.max(0, round2(qty));
      const sid = selectedStoreId;
      setCart((prev) => {
        const line = prev.find((l) => l.key === key);
        if (!line) {
          return prev;
        }
        const p = products.find((x) => x?.id != null && Number(x.id) === Number(line.product_id));
        if (!p || sid === "") {
          return prev.map((l) => (l.key === key ? { ...l, quantity: q } : l)).filter((l) => l.quantity > 0);
        }
        const avail = qtyAtStore(p, sid);
        if (avail == null) {
          return prev.map((l) => (l.key === key ? { ...l, quantity: q } : l)).filter((l) => l.quantity > 0);
        }
        let other = 0;
        for (const l of prev) {
          if (l.key === key) continue;
          if (line.product_id != null && l.product_id === line.product_id) {
            other += Number(l.quantity) || 0;
          }
        }
        const maxQ = round2(Math.max(0, avail - other));
        const useQ = Math.min(q, maxQ);
        return prev.map((l) => (l.key === key ? { ...l, quantity: useQ } : l)).filter((l) => l.quantity > 0);
      });
    },
    [selectedStoreId, products]
  );

  const removeLine = useCallback((key) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setTendered("");
    setTransactionRef("");
    setDiscountAmount("");
    setNotes("");
    setHoldReference("");
    setPayMethod("cash");
    setSelectedCustomerId("");
  }, []);

  const holdCart = useCallback(() => {
    if (!cart.length) {
      setEmptyHoldNoticeOpen(true);
      return;
    }
    const holds = readHolds();
    holds.unshift({
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      holdReference: String(holdReference || "").trim(),
      selectedCustomerId: String(selectedCustomerId || ""),
      selectedStoreId: String(selectedStoreId || ""),
      payMethod,
      tendered,
      transactionRef,
      discountAmount,
      notes,
      cart
    });
    writeHolds(holds);
    clearCart();
    setHoldModalOpen(false);
  }, [
    cart,
    clearCart,
    discountAmount,
    holdReference,
    notes,
    payMethod,
    readHolds,
    selectedCustomerId,
    selectedStoreId,
    tendered,
    transactionRef,
    writeHolds
  ]);

  const openHoldModal = useCallback(() => {
    if (!cart.length) {
      setEmptyHoldNoticeOpen(true);
      return;
    }
    setHoldModalOpen(true);
  }, [cart.length]);

  const openDiscountModal = useCallback(() => {
    setDiscountDraft(String(discountAmount || ""));
    setDiscountModalOpen(true);
  }, [discountAmount]);

  const applyDiscount = useCallback(() => {
    setDiscountAmount(String(discountDraft || "").trim());
    setDiscountModalOpen(false);
  }, [discountDraft]);

  const applyHeldDraft = useCallback((draft) => {
    if (!draft) return;
    setSelectedCustomerId(String(draft?.selectedCustomerId || ""));
    const hs = draft?.selectedStoreId;
    if (hs != null && String(hs).trim() !== "") {
      setSelectedStoreId(Number(hs));
    }
    setPayMethod(String(draft?.payMethod || "cash"));
    setTendered(String(draft?.tendered || ""));
    setTransactionRef(String(draft?.transactionRef || ""));
    setDiscountAmount(String(draft?.discountAmount || ""));
    setNotes(String(draft?.notes || ""));
    setHoldReference(String(draft?.holdReference || ""));
    setCart(Array.isArray(draft?.cart) ? draft.cart : []);
  }, []);

  const resumeHeldCartById = useCallback(
    (id) => {
      const holds = readHolds();
      const idx = holds.findIndex((h) => String(h?.id) === String(id));
      if (idx < 0) return;
      const draft = holds[idx];
      const rest = [...holds.slice(0, idx), ...holds.slice(idx + 1)];
      writeHolds(rest);
      refreshHeldOrders();
      applyHeldDraft(draft);
      setHeldOrdersOpen(false);
    },
    [applyHeldDraft, readHolds, refreshHeldOrders, writeHolds]
  );

  const deleteHeldCartById = useCallback(
    (id) => {
      const holds = readHolds();
      const rest = holds.filter((h) => String(h?.id) !== String(id));
      writeHolds(rest);
      refreshHeldOrders();
    },
    [readHolds, refreshHeldOrders, writeHolds]
  );

  const openCheckout = useCallback(() => {
    if (!cart.length) {
      return;
    }
    if (!selectedStoreId) {
      window.alert("Select a store before checkout.");
      return;
    }
    setCheckoutError("");
    setCheckoutOpen(true);
    // helpful default: exact tender
    if (!String(tendered).trim()) {
      setTendered(String(totals.total.toFixed(2)));
    }
  }, [cart.length, selectedStoreId, tendered, totals.total]);

  const openAddCustomerModal = useCallback(() => {
    setAddCustomerError("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setAddCustomerOpen(true);
  }, []);

  const closeAddCustomerModal = useCallback(() => {
    if (addCustomerBusy) return;
    setAddCustomerOpen(false);
  }, [addCustomerBusy]);

  const submitAddCustomer = useCallback(async () => {
    if (!token) return;
    const name = String(newCustomerName || "").trim();
    const phone = String(newCustomerPhone || "").trim();
    const email = String(newCustomerEmail || "").trim();
    if (!name) {
      setAddCustomerError("Customer name is required.");
      return;
    }
    if (!phone) {
      setAddCustomerError("Phone number is required.");
      return;
    }
    setAddCustomerBusy(true);
    setAddCustomerError("");
    try {
      const payload = {
        name,
        phone,
        email: email || null,
        company: null,
        location: null,
        status: "Active",
        avatar_url: null
      };
      const data = await createCustomerRequest(token, payload);
      const created = data?.customer ?? null;
      const fresh = await listCustomersRequest(token);
      const rows = Array.isArray(fresh?.customers) ? fresh.customers : [];
      setCustomers(rows);
      if (created?.id != null) {
        setSelectedCustomerId(String(created.id));
      }
      setAddCustomerOpen(false);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setAddCustomerError(e.message);
      } else {
        setAddCustomerError("Could not add customer.");
      }
    } finally {
      setAddCustomerBusy(false);
    }
  }, [token, newCustomerName, newCustomerPhone, newCustomerEmail]);

  const choosePaymentAndOpenCheckout = useCallback(
    (method) => {
      setPayMethod(method);
      openCheckout();
    },
    [openCheckout]
  );

  const closeCheckout = useCallback(() => {
    if (checkoutBusy) return;
    setCheckoutOpen(false);
    setCheckoutError("");
  }, [checkoutBusy]);

  const submitCheckout = useCallback(async () => {
    if (!token || !cart.length) return;
    if (!selectedStoreId) {
      setCheckoutError("Select a store for this sale.");
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const body = {
        store_id: Number(selectedStoreId),
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer ? null : null,
        customer_email: selectedCustomer ? null : null,
        currency: "KES",
        discount_amount: totals.discount || 0,
        notes: notes.trim() || null,
        items: cart.map((l) => ({
          product_id: l.product_id ?? null,
          sku: l.sku ?? null,
          product_name: l.product_name,
          description: null,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent || 0)
        })),
        payments: [
          {
            method: payMethod,
            amount: totals.tendered || totals.total,
            transaction_ref: transactionRef.trim() || null
          }
        ]
      };

      const data = await createPosOrderRequest(token, body);
      try {
        const prodData = await listSalesCatalogProductsRequest(token);
        if (Array.isArray(prodData?.products)) {
          setProducts(prodData.products);
        } else {
          setProducts((prev) => applySaleDeductionToProducts(prev, body.items, selectedStoreId));
        }
      } catch {
        setProducts((prev) => applySaleDeductionToProducts(prev, body.items, selectedStoreId));
      }
      const orderNo = String(data?.pos_order?.order_no ?? "").trim();
      setLastOrderNo(orderNo);
      setLastOrder(data?.pos_order ?? null);
      try {
        if (data?.pos_order) {
          localStorage.setItem(lastReceiptKey, JSON.stringify(data.pos_order));
        }
      } catch {
        /* ignore quota */
      }
      setReceiptOpen(Boolean(data?.pos_order));
      setCheckoutOpen(false);
      clearCart();
    } catch (e) {
      const offlineLike = !isOnline || (e instanceof TillFlowApiError && (e.status === 0 || e.status === 503));
      if (offlineLike) {
        const q = readQueue();
        q.push({
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
          body
        });
        writeQueue(q);
        setProducts((prev) => applySaleDeductionToProducts(prev, body.items, selectedStoreId));
        setCheckoutOpen(false);
        clearCart();
        setLastOrderNo("");
        window.alert("Offline: sale queued for sync.");
        return;
      }
      if (e instanceof TillFlowApiError) {
        setCheckoutError(e.message);
      } else {
        setCheckoutError("Checkout failed.");
      }
    } finally {
      setCheckoutBusy(false);
    }
  }, [
    token,
    cart,
    selectedCustomer,
    selectedStoreId,
    totals.discount,
    totals.tendered,
    totals.total,
    notes,
    payMethod,
    transactionRef,
    clearCart,
    isOnline,
    readQueue,
    writeQueue
  ]);

  const syncQueued = useCallback(async () => {
    if (!token) return;
    if (!isOnline) {
      window.alert("You are offline.");
      return;
    }
    const q = readQueue();
    if (!q.length) return;
    setSyncBusy(true);
    try {
      const remaining = [];
      for (const row of q) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await createPosOrderRequest(token, row.body);
        } catch {
          remaining.push(row);
        }
      }
      writeQueue(remaining);
      if (!remaining.length) {
        window.alert("POS queue synced.");
      } else {
        window.alert(`Some queued sales could not sync (${remaining.length}).`);
      }
    } finally {
      setSyncBusy(false);
    }
  }, [token, isOnline, readQueue, writeQueue]);

  useEffect(() => {
    if (isOnline && queueCount > 0) {
      void syncQueued();
    }
  }, [isOnline, queueCount, syncQueued]);

  const openLatestReceiptFromApi = useCallback(async () => {
    if (!token) {
      window.alert("Sign in to view recent receipts.");
      return;
    }
    try {
      const rows = await listPosOrdersRequest(token);
      const latestId = rows?.pos_orders?.[0]?.id;
      if (!latestId) {
        window.alert("No recent receipt found yet.");
        return;
      }
      const detail = await showPosOrderRequest(token, latestId);
      const order = detail?.pos_order ?? null;
      if (!order) {
        window.alert("No recent receipt found yet.");
        return;
      }
      const orderNo = String(order?.order_no ?? "").trim();
      setLastOrder(order);
      setLastOrderNo(orderNo);
      try {
        localStorage.setItem(lastReceiptKey, JSON.stringify(order));
      } catch {
        /* ignore quota */
      }
      setReceiptOpen(true);
    } catch {
      window.alert("Could not load latest receipt.");
    }
  }, [token]);

  useEffect(() => {
    const onOpenLatestReceipt = () => {
      if (lastOrder) {
        setReceiptOpen(true);
      } else {
        void openLatestReceiptFromApi();
      }
    };
    window.addEventListener("tillflow:open-latest-receipt", onOpenLatestReceipt);
    return () => {
      window.removeEventListener("tillflow:open-latest-receipt", onOpenLatestReceipt);
    };
  }, [lastOrder, openLatestReceiptFromApi]);

  const closeReceipt = useCallback(() => {
    setReceiptOpen(false);
  }, []);

  const openThermalPrint = useCallback(async () => {
    const root = receiptRootRef.current;
    if (!root || !(root instanceof HTMLElement) || !lastOrder) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      printPosReceiptThermal(root, lastOrder?.order_no ? `Receipt ${lastOrder.order_no}` : "Receipt");
    } catch {
      window.alert("Could not print receipt.");
    }
  }, [lastOrder]);


  return (
    <div className="tf-pos-register h-100 d-flex flex-column">
      {loadError ? <div className="alert alert-warning">{loadError}</div> : null}

      <div className="row align-items-start pos-wrapper g-3 flex-grow-1" style={{ minHeight: 0 }}>
        <div className="col-md-12 col-lg-7 col-xl-8 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="pos-categories tabs_wrapper d-flex flex-column" style={{ minHeight: 0 }}>
            <div className="d-flex align-items-center justify-content-start gap-3 mb-3 flex-nowrap">
              <div className="d-flex align-items-center gap-2">
                <div className="input-icon-start pos-search position-relative tf-pos-search-box">
                  <span className="input-icon-addon">
                    <i className="ti ti-search" />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search Product"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveCategory("All")}>
                  View All Categories
                </button>
              </div>
              <div className="tabs owl-carousel pos-category3 d-flex gap-2 flex-nowrap overflow-auto ms-auto justify-content-end">
                {categoryOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-sm text-nowrap ${activeCategory === c ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setActiveCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="pos-products flex-grow-1" style={{ minHeight: 0 }}>
              <div className="tabs_container h-100">
                <div className="tab_content active h-100">
                  <div className="row g-2" style={{ maxHeight: "100%", overflow: "auto" }}>
                    {loading ? <p className="text-muted mb-0">Loading…</p> : null}
                    {!loading && filteredProducts.length === 0 ? <p className="text-muted mb-0">No products found.</p> : null}
                    {filteredProducts.map((p) => {
                      const name = normalizeProductName(p);
                      const price = normalizeUnitPrice(p);
                      const sku = normalizeSku(p);
                      const qtyAvail = normalizeQtyAvailable(p, selectedStoreId);
                      const disabled = qtyAvail != null && qtyAvail <= 0;
                      return (
                        <div key={p.id ?? `${name}-${sku ?? ""}`} className="col-sm-6 col-md-4 col-xl-3">
                          <div className={`product-info card default-cover ${disabled ? "disabled opacity-50" : ""}`}>
                            <button type="button" className="btn w-100 text-start p-2 border-0 bg-transparent" disabled={disabled} onClick={() => addToCart(p)}>
                              <div className="product-content">
                                <h6 className="fs-14 fw-bold mb-1 text-truncate">{name}</h6>
                                <p className="text-muted small mb-1">{sku ? `SKU: ${sku}` : "—"}</p>
                                <div className="d-flex align-items-center justify-content-between">
                                  <h6 className="text-teal fs-14 fw-bold mb-0">{formatKes(price)}</h6>
                                  <p className={qtyAvail != null && qtyAvail <= 0 ? "text-danger mb-0" : "text-pink mb-0"}>
                                    {qtyAvail == null ? "" : `${qtyAvail} Pcs`}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-12 col-lg-5 col-xl-4 ps-0 theiaStickySidebar d-flex flex-column" style={{ minHeight: 0 }}>
          <aside className="product-order-list d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
            <div className="customer-info">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div className="d-flex align-items-center">
                  <h4 className="mb-0">New Order</h4>
                  <span className="badge badge-purple badge-xs fs-10 fw-medium ms-2">{lastOrderNo || "#NEW"}</span>
                </div>
                <button type="button" className="btn btn-sm btn-outline-primary shadow-primary" onClick={openAddCustomerModal}>
                  Add Customer
                </button>
                {holdCount ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      refreshHeldOrders();
                      setHeldOrdersOpen(true);
                    }}>
                    Resume Hold ({holdCount})
                  </button>
                ) : null}
              </div>
              <select className="form-select" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {normalizeCustomerLabel(c)}
                  </option>
                ))}
              </select>
              <label className="form-label small text-muted mt-2 mb-1">Store (inventory)</label>
              <select
                className="form-select"
                value={selectedStoreId === "" ? "" : String(selectedStoreId)}
                onChange={(e) => setSelectedStoreId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="" disabled={displayStores.length > 0}>
                  {displayStores.length ? "Select store" : "No stores"}
                </option>
                {displayStores.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name || `Store ${s.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="product-added block-section flex-grow-1" style={{ minHeight: 0 }}>
              <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                <h5 className="d-flex align-items-center mb-0">Order Details</h5>
                <div className="badge bg-light text-gray-9 fs-12 fw-semibold py-2 border rounded">
                  Items : <span className="text-teal">{cart.length}</span>
                </div>
              </div>
              <div className="product-wrap" style={{ maxHeight: "100%", overflow: "auto" }}>
                {!cart.length ? <div className="empty-cart"><p className="fw-bold mb-0">No Products Selected</p></div> : null}
                {!!cart.length ? (
                  <div className="product-list border-0 p-0">
                    <div className="table-responsive">
                      <table className="table table-borderless">
                        <thead>
                          <tr>
                            <th className="bg-transparent fw-bold">Product</th>
                            <th className="bg-transparent fw-bold">QTY</th>
                            <th className="bg-transparent fw-bold">Price</th>
                            <th className="bg-transparent fw-bold text-end" />
                          </tr>
                        </thead>
                        <tbody>
                          {cart.map((l) => (
                            <tr key={l.key}>
                              <td>
                                <div className="d-flex align-items-center mb-1">
                                  <h6 className="fs-16 fw-medium mb-0">{l.product_name}</h6>
                                </div>
                                Price : {formatKes(l.unit_price)}
                              </td>
                              <td>
                                <div className="qty-item m-0">
                                  <button
                                    type="button"
                                    className="dec p-0 border-0 text-decoration-none bg-transparent"
                                    aria-label="Decrease quantity"
                                    onClick={() => setLineQty(l.key, Number(l.quantity) - 1)}>
                                    <i className="ti ti-minus" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    className="form-control form-control-sm tf-pos-qty-input"
                                    value={String(l.quantity)}
                                    onChange={(e) => setLineQty(l.key, Number(e.target.value))}
                                  />
                                  <button
                                    type="button"
                                    className="inc p-0 border-0 text-decoration-none bg-transparent"
                                    aria-label="Increase quantity"
                                    onClick={() => setLineQty(l.key, Number(l.quantity) + 1)}>
                                    <i className="ti ti-plus" />
                                  </button>
                                </div>
                              </td>
                              <td className="fw-bold">{formatKes(round2(l.quantity * l.unit_price))}</td>
                              <td className="text-end">
                                <button type="button" className="btn-icon delete-icon border-0 bg-transparent" onClick={() => removeLine(l.key)}>
                                  <i className="ti ti-trash" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="block-section order-method bg-light m-0">
              <div className="order-total">
                <div className="table-responsive">
                  <table className="table table-borderless">
                    <tbody>
                      <tr>
                        <td className="text-nowrap">Amounts</td>
                        <td className="text-end text-nowrap">
                          Subtotal: {formatKes(totals.subtotal)} | Tax: {formatKes(totals.tax)} |{" "}
                          <span className="text-danger">Discount: -{formatKes(totals.discount)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>Grand Total</td>
                        <td className="text-end">{formatKes(totals.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="row gx-2 row-cols-4">
                <div className="col">
                  <button type="button" className="btn btn-teal d-flex align-items-center justify-content-center w-100 mb-2 border-0" onClick={openDiscountModal}>
                    <i className="ti ti-percentage me-2" />
                    Discount
                  </button>
                </div>
                <div className="col">
                  <button
                    type="button"
                    className="btn btn-orange d-flex align-items-center justify-content-center w-100 mb-2 border-0"
                    onClick={openHoldModal}>
                    <i className="ti ti-player-pause me-2" />
                    Hold
                  </button>
                </div>
                <div className="col">
                  <button type="button" className="btn btn-info d-flex align-items-center justify-content-center w-100 mb-2 border-0" onClick={clearCart}>
                    <i className="ti ti-trash me-2" />
                    Clear
                  </button>
                </div>
                <div className="col">
                  {queueCount ? (
                    <button type="button" className="btn btn-danger d-flex align-items-center justify-content-center w-100 mb-2 border-0" disabled={syncBusy || !isOnline} onClick={() => void syncQueued()}>
                      <i className="ti ti-refresh-dot me-2" />
                      {syncBusy ? "Syncing..." : "Sync"}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger d-flex align-items-center justify-content-center w-100 mb-2 border-0" disabled>
                      <i className="ti ti-refresh-dot me-2" />
                      Sync
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="block-section payment-method">
              <h5 className="mb-2">Select Payment</h5>
              <div className="row align-items-center justify-content-center methods g-2 mb-3">
                <div className="col-sm-6 col-md-4 col-xl d-flex">
                  <button
                    type="button"
                    className={`payment-item flex-fill border-0 ${payMethod === "cash" ? "active" : ""}`}
                    onClick={() => choosePaymentAndOpenCheckout("cash")}>
                    <img src={cashIcon} alt="Cash" />
                    <p className="fw-medium">Cash</p>
                  </button>
                </div>
                <div className="col-sm-6 col-md-4 col-xl d-flex">
                  <button
                    type="button"
                    className={`payment-item flex-fill border-0 ${payMethod === "mpesa" ? "active" : ""}`}
                    onClick={() => choosePaymentAndOpenCheckout("mpesa")}>
                    <img src={points} alt="M-Pesa" />
                    <p className="fw-medium">M-Pesa</p>
                  </button>
                </div>
                <div className="col-sm-6 col-md-4 col-xl d-flex">
                  <button
                    type="button"
                    className={`payment-item flex-fill border-0 ${payMethod === "card" ? "active" : ""}`}
                    onClick={() => choosePaymentAndOpenCheckout("card")}>
                    <img src={card} alt="Card" />
                    <p className="fw-medium">Card</p>
                  </button>
                </div>
                <div className="col-sm-6 col-md-4 col-xl d-flex">
                  <button
                    type="button"
                    className={`payment-item flex-fill border-0 ${payMethod === "bank_transfer" ? "active" : ""}`}
                    onClick={() => choosePaymentAndOpenCheckout("bank_transfer")}>
                    <img src={deposit} alt="Bank Transfer" />
                    <p className="fw-medium">Bank Transfer</p>
                  </button>
                </div>
              </div>
              <div className="btn-block m-0">
                <button type="button" className="btn btn-teal w-100 border-0" disabled={!cart.length} onClick={openCheckout}>
                  Pay : {formatKes(totals.total)}
                </button>
              </div>
            </div>

          </aside>
        </div>
      </div>
      <PosModals />
      <Modal show={checkoutOpen} onHide={closeCheckout} centered backdrop={checkoutBusy ? "static" : true}>
        <Modal.Header closeButton={!checkoutBusy}>
          <Modal.Title>Checkout</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {checkoutError ? <div className="alert alert-danger py-2">{checkoutError}</div> : null}
          <div className="mb-2">
            <label className="form-label">Payment method</label>
            <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} disabled={checkoutBusy}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label">Tendered (Ksh)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-control"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                disabled={checkoutBusy}
              />
            </div>
          </div>
          <div className="mb-0 mt-2">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={checkoutBusy}
            />
          </div>

          <div className="mt-3 p-2 border rounded bg-light-subtle">
            <div className="d-flex justify-content-between small">
              <span className="text-muted">Total</span>
              <span className="fw-semibold">{formatKes(totals.total)}</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span className="text-muted">Tendered</span>
              <span>{formatKes(totals.tendered)}</span>
            </div>
            <div className="d-flex justify-content-between small">
              <span className="text-muted">Change</span>
              <span>{formatKes(totals.change)}</span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={closeCheckout} disabled={checkoutBusy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submitCheckout()} disabled={checkoutBusy || totals.total <= 0}>
            {checkoutBusy ? "Saving…" : "Complete sale"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={addCustomerOpen} onHide={closeAddCustomerModal} centered backdrop={addCustomerBusy ? "static" : true}>
        <Modal.Header closeButton={!addCustomerBusy}>
          <Modal.Title>Add Customer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addCustomerError ? <div className="alert alert-danger py-2">{addCustomerError}</div> : null}
          <div className="mb-2">
            <label className="form-label">Name *</label>
            <input
              type="text"
              className="form-control"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              disabled={addCustomerBusy}
              autoFocus
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Phone *</label>
            <input
              type="text"
              className="form-control"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              disabled={addCustomerBusy}
            />
          </div>
          <div className="mb-0">
            <label className="form-label">Email (optional)</label>
            <input
              type="email"
              className="form-control"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              disabled={addCustomerBusy}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={closeAddCustomerModal} disabled={addCustomerBusy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submitAddCustomer()} disabled={addCustomerBusy}>
            {addCustomerBusy ? "Saving..." : "Save Customer"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={holdModalOpen} onHide={() => setHoldModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Hold Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3 text-center">
            <div className="text-muted small">Held amount</div>
            <div className="fs-1 fw-bold">{formatKes(totals.total)}</div>
          </div>
          <label className="form-label">Reference name</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Jane table 3"
            value={holdReference}
            onChange={(e) => setHoldReference(e.target.value)}
            autoFocus
          />
          <div className="form-text">Use a short label to identify this hold later.</div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={() => setHoldModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={holdCart}>
            Save Hold
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={discountModalOpen} onHide={() => setDiscountModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Apply Discount</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <label className="form-label">Discount Amount (Ksh)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-control"
            value={discountDraft}
            onChange={(e) => setDiscountDraft(e.target.value)}
            autoFocus
          />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={() => setDiscountModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={applyDiscount}>
            Apply
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={emptyHoldNoticeOpen} onHide={() => setEmptyHoldNoticeOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Nothing to hold yet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Add at least one product to the cart before using Hold.</p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-primary" onClick={() => setEmptyHoldNoticeOpen(false)}>
            Okay
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={heldOrdersOpen} onHide={() => setHeldOrdersOpen(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Held Orders</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!heldOrders.length ? (
            <p className="text-muted mb-0">No held orders.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Held At</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Customer</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {heldOrders.map((h) => {
                    const heldAt = h?.created_at ? new Date(h.created_at).toLocaleString() : "—";
                    const itemCount = Array.isArray(h?.cart) ? h.cart.length : 0;
                    const heldAmount = Array.isArray(h?.cart)
                      ? h.cart.reduce((sum, l) => sum + round2(Number(l?.quantity || 0) * Number(l?.unit_price || 0)), 0)
                      : 0;
                    const customerName =
                      customers.find((c) => String(c.id) === String(h?.selectedCustomerId || ""))?.name ||
                      "Walk-in customer";
                    return (
                      <tr key={String(h?.id)}>
                        <td>{String(h?.holdReference || "").trim() || "—"}</td>
                        <td>{heldAt}</td>
                        <td>{itemCount}</td>
                        <td>{formatKes(heldAmount)}</td>
                        <td>{customerName}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-primary me-2" onClick={() => resumeHeldCartById(h?.id)}>
                            Resume
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteHeldCartById(h?.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={receiptOpen} onHide={closeReceipt} centered scrollable dialogClassName="tf-pos-receipt-modal">
        <Modal.Header closeButton>
          <Modal.Title>Receipt</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {lastOrder ? <PosReceiptPrintDocument ref={receiptRootRef} order={lastOrder} /> : null}
        </Modal.Body>
        <Modal.Footer className="gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={openThermalPrint} disabled={!lastOrder}>
            Print
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
