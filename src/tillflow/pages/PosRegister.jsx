import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import PosReceiptPrintDocument from "../../feature-module/sales/PosReceiptPrintDocument";
import PosModals from "../../core/modals/pos-modal/posModalstjsx";
import { card, cashIcon, deposit, points } from "../../utils/imagepath";
import { TillFlowApiError } from "../api/errors";
import { listSalesCatalogProductsRequest } from "../api/products";
import { listCustomersRequest } from "../api/customers";
import {
  createPosOrderRequest,
  previewPosOrderReceiptEmailRequest,
  sendPosOrderReceiptToCustomerRequest
} from "../api/posOrders";
import { useAuth } from "../auth/AuthContext";
import {
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";

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

function normalizeQtyAvailable(p) {
  const n = Number(p?.qty);
  return Number.isFinite(n) ? n : null;
}

function normalizeCustomerLabel(c) {
  const name = String(c?.name ?? "").trim();
  const phone = String(c?.phone ?? "").trim();
  if (name && phone) {
    return `${name} (${phone})`;
  }
  return name || phone || "Customer";
}

function printElementDirect(element, title = "Receipt") {
  const styleTags = Array.from(document.querySelectorAll("style"))
    .map((s) => s.outerHTML)
    .join("\n");
  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.outerHTML)
    .join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${String(title)}</title>
    ${cssLinks}
    ${styleTags}
    <style>
      html, body { background: #fff; margin: 0; padding: 0; }
      .tf-pos-receipt { margin: 0 auto; }
      @page { size: auto; margin: 8mm; }
    </style>
  </head>
  <body>${element.outerHTML}</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error("PRINT_FRAME_UNAVAILABLE");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 800);
    }
  };

  iframe.onload = runPrint;
  window.setTimeout(runPrint, 500);
}

export default function PosRegister() {
  const { token } = useAuth();
  const receiptRootRef = useRef(null);
  const queueKey = "tillflow_pos_queue_v1";
  const holdKey = "tillflow_pos_holds_v1";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [searchQ, setSearchQ] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");

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
  const [lastOrderNo, setLastOrderNo] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState("");
  const [emailPreviewTo, setEmailPreviewTo] = useState("");
  const [emailPreviewSubject, setEmailPreviewSubject] = useState("");
  const [emailPreviewMessage, setEmailPreviewMessage] = useState("");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [emailPreviewSending, setEmailPreviewSending] = useState(false);

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
        const [prodData, custData] = await Promise.all([
          listSalesCatalogProductsRequest(token),
          listCustomersRequest(token)
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(prodData?.products) ? prodData.products : []);
        setCustomers(Array.isArray(custData?.customers) ? custData.customers : []);
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
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
    []
  );

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
    const idNum = p?.id != null ? Number(p.id) : null;
    const sku = normalizeSku(p);
    const name = normalizeProductName(p);
    const unit = normalizeUnitPrice(p);
    setCart((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => (idNum != null ? x.product_id === idNum : false));
      if (idx >= 0) {
        next[idx] = { ...next[idx], quantity: round2(next[idx].quantity + 1) };
        return next;
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
  }, []);

  const setLineQty = useCallback((key, qty) => {
    const q = Math.max(0, round2(qty));
    setCart((prev) => {
      const next = prev.map((l) => (l.key === key ? { ...l, quantity: q } : l));
      return next.filter((l) => l.quantity > 0);
    });
  }, []);

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
      window.alert("Add products before holding.");
      return;
    }
    const holds = readHolds();
    holds.unshift({
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      holdReference: String(holdReference || "").trim(),
      selectedCustomerId: String(selectedCustomerId || ""),
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
  }, [cart, clearCart, discountAmount, holdReference, notes, payMethod, readHolds, selectedCustomerId, tendered, transactionRef, writeHolds]);

  const openHoldModal = useCallback(() => {
    if (!cart.length) {
      window.alert("Add products before holding.");
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
    setCheckoutError("");
    setCheckoutOpen(true);
    // helpful default: exact tender
    if (!String(tendered).trim()) {
      setTendered(String(totals.total.toFixed(2)));
    }
  }, [cart.length, tendered, totals.total]);

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
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const body = {
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
      const orderNo = String(data?.pos_order?.order_no ?? "").trim();
      setLastOrderNo(orderNo);
      setLastOrder(data?.pos_order ?? null);
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
  }, [token, cart, selectedCustomer, totals.discount, totals.tendered, totals.total, notes, payMethod, transactionRef, clearCart, isOnline, readQueue, writeQueue]);

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
      printElementDirect(root, lastOrder?.order_no ? `Receipt ${lastOrder.order_no}` : "Receipt");
    } catch {
      window.alert("Could not print receipt.");
    }
  }, [lastOrder]);

  const openEmailPreview = useCallback(async () => {
    if (!token || !lastOrder?.id) {
      return;
    }
    setEmailPreviewOpen(true);
    setEmailPreviewLoading(true);
    setEmailPreviewError("");
    setEmailPreviewTo(String(lastOrder.customer_email ?? "").trim());
    setEmailPreviewSubject("");
    setEmailPreviewMessage("");
    setEmailPreviewHtml("");
    try {
      const data = await previewPosOrderReceiptEmailRequest(token, lastOrder.id);
      setEmailPreviewTo(String(data?.to_email ?? ""));
      setEmailPreviewSubject(String(data?.subject ?? ""));
      setEmailPreviewMessage(String(data?.message_template ?? "Please find your receipt details below."));
      setEmailPreviewHtml(String(data?.html ?? ""));
    } catch (e) {
      setEmailPreviewError(e instanceof TillFlowApiError ? e.message : "Could not load email preview.");
    } finally {
      setEmailPreviewLoading(false);
    }
  }, [token, lastOrder?.id, lastOrder?.customer_email]);

  const closeEmailPreview = useCallback(() => {
    if (emailPreviewSending) return;
    setEmailPreviewOpen(false);
    setEmailPreviewLoading(false);
    setEmailPreviewError("");
    setEmailPreviewTo("");
    setEmailPreviewSubject("");
    setEmailPreviewMessage("");
    setEmailPreviewHtml("");
  }, [emailPreviewSending]);

  const sendEmail = useCallback(async () => {
    if (!token || !lastOrder?.id) return;
    setEmailPreviewSending(true);
    try {
      await sendPosOrderReceiptToCustomerRequest(token, lastOrder.id, {
        toEmail: emailPreviewTo,
        subject: emailPreviewSubject,
        message: emailPreviewMessage
      });
      closeEmailPreview();
      window.alert("Receipt email sent.");
    } catch (e) {
      window.alert(e instanceof TillFlowApiError ? e.message : "Could not send receipt email.");
    } finally {
      setEmailPreviewSending(false);
    }
  }, [token, lastOrder?.id, emailPreviewTo, emailPreviewSubject, emailPreviewMessage, closeEmailPreview]);

  return (
    <div className="tf-pos-register h-100 d-flex flex-column">
      {loadError ? <div className="alert alert-warning">{loadError}</div> : null}

      <div className="row align-items-start pos-wrapper g-3 flex-grow-1" style={{ minHeight: 0 }}>
        <div className="col-md-12 col-lg-7 col-xl-8 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="pos-categories tabs_wrapper d-flex flex-column" style={{ minHeight: 0 }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
              <div>
                <h5 className="mb-1">Welcome, Cashier</h5>
                <p className="mb-0">{todayLabel}</p>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="input-icon-start pos-search position-relative">
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
            </div>

            <div className="tabs owl-carousel pos-category3 mb-3 d-flex flex-wrap gap-2">
              {categoryOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`btn btn-sm ${activeCategory === c ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setActiveCategory(c)}>
                  {c}
                </button>
              ))}
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
                      const qtyAvail = normalizeQtyAvailable(p);
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
                <button type="button" className="btn btn-sm btn-outline-primary shadow-primary">
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
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void openEmailPreview()}
            disabled={!lastOrder?.id || !String(lastOrder?.customer_email ?? "").trim()}>
            Email receipt
          </button>
        </Modal.Footer>
      </Modal>

      <InvoiceEmailPreviewModal
        show={emailPreviewOpen}
        onHide={closeEmailPreview}
        loading={emailPreviewLoading}
        error={emailPreviewError}
        subject={emailPreviewSubject}
        html={emailPreviewHtml}
        toEmail={emailPreviewTo}
        message={emailPreviewMessage}
        onChangeToEmail={setEmailPreviewTo}
        onChangeSubject={setEmailPreviewSubject}
        onChangeMessage={setEmailPreviewMessage}
        sending={emailPreviewSending}
        sendButtonLabel="Send receipt"
        showHtmlPreview={true}
        sendDisabled={!lastOrder?.id || !String(emailPreviewTo ?? "").trim()}
        onSend={sendEmail}
      />
    </div>
  );
}
