import { purchaseListData } from "../../core/json/purchase-list";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonDatePicker from "../../components/date-picker/common-date-picker";
import DeleteModal from "../../components/delete-modal";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { downloadImg, stockImg02, user33 } from "../../utils/imagepath";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, PlusCircle, Search, X } from "react-feather";
import { AutoComplete } from "primereact/autocomplete";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createPurchaseRequest,
  deletePurchaseRequest,
  listPurchasesRequest
} from "../../tillflow/api/purchases";
import { listProductsRequest } from "../../tillflow/api/products";
import {
  createSupplierMultipartRequest,
  createSupplierRequest,
  listSuppliersRequest
} from "../../tillflow/api/suppliers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";
const TILLFLOW_PURCHASES_BASE = "/tillflow/admin/purchases";

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

function newPurchaseRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatMoneyDisplay(v) {
  const n = parseFloat(String(v ?? "0"), 10);
  return `$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

/** Map Laravel purchase payload to table row (matches demo JSON shape). */
function mapApiPurchaseToRow(p) {
  let dateStr = "";
  if (p.purchase_date) {
    try {
      dateStr = new Date(`${String(p.purchase_date)}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      dateStr = String(p.purchase_date);
    }
  }
  return {
    id: String(p.id),
    supplierName: p.supplier_name ?? "—",
    reference: p.reference,
    date: dateStr,
    status: p.status,
    total: formatMoneyDisplay(p.grand_total),
    paid: formatMoneyDisplay(p.paid_amount),
    due: formatMoneyDisplay(p.due_amount),
    paymentStatus: p.payment_status ?? "Unpaid"
  };
}

function isApiNumericId(id) {
  return id != null && /^\d+$/.test(String(id));
}

/** Default purchase line price from catalog: cost (buying) first, then selling. */
function purchaseDefaultUnitPriceFromProduct(p) {
  if (p?.buying_price != null && String(p.buying_price).trim() !== "") {
    return String(p.buying_price);
  }
  if (p?.selling_price != null && String(p.selling_price).trim() !== "") {
    return String(p.selling_price);
  }
  return "";
}

function emptyPurchaseLine() {
  return {
    id: newPurchaseRowId(),
    productId: "",
    productName: "",
    qty: "1",
    price: "",
    discount: "0",
    taxPct: "0"
  };
}

function purchaseLineHasCatalogId(line) {
  return line?.productId != null && String(line.productId).trim() !== "";
}

/** Row 1 “staging”: ready to commit with + when catalog product or product name is set (TillFlow create purchase). */
function purchaseStagingRowReady(line) {
  return purchaseLineHasCatalogId(line) || String(line?.productName ?? "").trim() !== "";
}

/** Demo options when the page runs outside TillFlow or there is no API token */
const FALLBACK_SUPPLIER_OPTIONS = [
  { label: "Select", value: "" },
  { label: "Apex Computers", value: "apex-computers" },
  { label: "Dazzle Shoes", value: "dazzle-shoes" },
  { label: "Best Accessories", value: "best-accessories" }
];

const PurchasesList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const purchasePathNorm = location.pathname.replace(/\/$/, "");
  const purchaseCreatePageActive =
    inTillflowShell && purchasePathNorm === `${TILLFLOW_PURCHASES_BASE}/new`;
  const auth = useOptionalAuth();
  const token =
    auth?.token ??
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(TILLFLOW_TOKEN_KEY)
      : null);
  /** Same UX as quotations/new: fixed empty row 1, + commits, × on committed rows */
  const purchaseCrmLineItems = Boolean(token && inTillflowShell && purchaseCreatePageActive);
  const purchasePathRef = useRef("");

  const [apiSuppliers, setApiSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState("");

  const loadApiSuppliers = useCallback(async () => {
    if (!token) {
      setApiSuppliers([]);
      setSuppliersError("");
      setSuppliersLoading(false);
      return;
    }
    setSuppliersLoading(true);
    setSuppliersError("");
    try {
      const data = await listSuppliersRequest(token);
      setApiSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e) {
      setApiSuppliers([]);
      if (e instanceof TillFlowApiError) {
        setSuppliersError(
          e.status === 403
            ? `${e.message} (needs permission to list suppliers)`
            : e.message
        );
      } else {
        setSuppliersError("Could not load suppliers.");
      }
    } finally {
      setSuppliersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadApiSuppliers();
  }, [loadApiSuppliers]);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogQuickAddKey, setCatalogQuickAddKey] = useState(0);
  const [catalogQuickSearchText, setCatalogQuickSearchText] = useState("");
  const [catalogQuickSuggestions, setCatalogQuickSuggestions] = useState([]);

  const loadCatalogProducts = useCallback(async () => {
    if (!token) {
      setCatalogProducts([]);
      setCatalogError("");
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const data = await listProductsRequest(token);
      setCatalogProducts(Array.isArray(data.products) ? data.products : []);
    } catch (e) {
      setCatalogProducts([]);
      if (e instanceof TillFlowApiError) {
        setCatalogError(
          e.status === 403
            ? `${e.message} (needs catalog.manage to load products)`
            : e.message
        );
      } else {
        setCatalogError("Could not load products.");
      }
    } finally {
      setCatalogLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCatalogProducts();
  }, [loadCatalogProducts]);

  const hideBsModal = useCallback((elementId) => {
    const el = document.getElementById(elementId);
    if (!el || typeof window === "undefined" || !window.bootstrap?.Modal) {
      return;
    }
    const inst =
      window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.hide();
  }, []);

  const showBsModal = useCallback((elementId) => {
    const el = document.getElementById(elementId);
    if (!el || typeof window === "undefined" || !window.bootstrap?.Modal) {
      return;
    }
    const inst =
      window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.show();
  }, []);

  /** Inline “Add supplier” from purchase flow (same fields as People → Suppliers) */
  const [addSupFirstName, setAddSupFirstName] = useState("");
  const [addSupLastName, setAddSupLastName] = useState("");
  const [addSupEmail, setAddSupEmail] = useState("");
  const [addSupPhone, setAddSupPhone] = useState("");
  const [addSupLocation, setAddSupLocation] = useState("");
  const [addSupStatusActive, setAddSupStatusActive] = useState(true);
  const [addSupError, setAddSupError] = useState("");
  const addSupAvatarInputRef = useRef(null);
  const addSupAvatarBlobRef = useRef(null);
  const [addSupAvatarFile, setAddSupAvatarFile] = useState(null);
  const [addSupAvatarPreview, setAddSupAvatarPreview] = useState(user33);

  const resetPurchaseAddSupplierForm = useCallback(() => {
    if (addSupAvatarBlobRef.current) {
      URL.revokeObjectURL(addSupAvatarBlobRef.current);
      addSupAvatarBlobRef.current = null;
    }
    if (addSupAvatarInputRef.current) {
      addSupAvatarInputRef.current.value = "";
    }
    setAddSupAvatarFile(null);
    setAddSupAvatarPreview(user33);
    setAddSupFirstName("");
    setAddSupLastName("");
    setAddSupEmail("");
    setAddSupPhone("");
    setAddSupLocation("");
    setAddSupStatusActive(true);
    setAddSupError("");
  }, []);

  const onPurchaseAddSupplierAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAddSupError("Please choose an image file.");
      return;
    }
    if (addSupAvatarBlobRef.current) {
      URL.revokeObjectURL(addSupAvatarBlobRef.current);
      addSupAvatarBlobRef.current = null;
    }
    const url = URL.createObjectURL(file);
    addSupAvatarBlobRef.current = url;
    setAddSupAvatarPreview(url);
    setAddSupAvatarFile(file);
    setAddSupError("");
  };

  const savePurchaseAddSupplier = useCallback(async () => {
    setAddSupError("");
    const fn = addSupFirstName.trim();
    const ln = addSupLastName.trim();
    const em = addSupEmail.trim();
    const ph = addSupPhone.trim();
    const loc = addSupLocation.trim();
    if (!fn || !ln || !ph) {
      setAddSupError("Please fill in first name, last name, and phone.");
      return;
    }
    if (em && !isValidEmail(em)) {
      setAddSupError("Enter a valid email address.");
      return;
    }
    if (
      em &&
      apiSuppliers.some(
        (s) => String(s.email ?? "").toLowerCase() === em.toLowerCase()
      )
    ) {
      setAddSupError("A supplier with this email already exists.");
      return;
    }
    if (apiSuppliers.some((s) => String(s.phone ?? "").trim() === ph)) {
      setAddSupError("A supplier with this phone number already exists.");
      return;
    }
    const name = `${fn} ${ln}`.trim();
    const status = addSupStatusActive ? "Active" : "Inactive";

    if (token) {
      try {
        let data;
        if (addSupAvatarFile) {
          data = await createSupplierMultipartRequest(
            token,
            {
              name,
              email: em || null,
              phone: ph,
              location: loc || null,
              status
            },
            addSupAvatarFile
          );
        } else {
          data = await createSupplierRequest(token, {
            name,
            email: em || null,
            phone: ph,
            location: loc || null,
            status,
            avatar_url: null
          });
        }
        if (!data?.supplier) {
          setAddSupError("Unexpected response from server.");
          return;
        }
        setApiSuppliers((prev) => [...prev, data.supplier]);
        setAddSupplier(String(data.supplier.id));
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setAddSupError(e.message);
        } else {
          setAddSupError("Could not create supplier.");
        }
        return;
      }
    } else {
      const localId = `local-${Date.now()}`;
      const row = {
        id: localId,
        name,
        email: em || null,
        phone: ph,
        location: loc || null,
        status,
        avatar_url: null
      };
      setApiSuppliers((prev) => [...prev, row]);
      setAddSupplier(String(localId));
    }

    resetPurchaseAddSupplierForm();
    hideBsModal("add_customer");
  }, [
    addSupFirstName,
    addSupLastName,
    addSupEmail,
    addSupPhone,
    addSupLocation,
    addSupStatusActive,
    addSupAvatarFile,
    apiSuppliers,
    resetPurchaseAddSupplierForm,
    token,
    hideBsModal
  ]);

  const handlePurchaseAddSupplierSubmit = (e) => {
    e.preventDefault();
    void savePurchaseAddSupplier();
  };

  const supplierOptions = useMemo(() => {
    const head = { label: "Select", value: "" };
    const fromApi = apiSuppliers.map((s) => ({
      label: String(s.name ?? "").trim() || `Supplier #${s.id}`,
      value: String(s.id)
    }));
    if (token) {
      return [head, ...fromApi];
    }
    /* No token: demo suppliers plus any session-added rows from the Add supplier modal */
    const fallbackRest = FALLBACK_SUPPLIER_OPTIONS.slice(1);
    const values = new Set(fromApi.map((o) => o.value));
    return [head, ...fromApi, ...fallbackRest.filter((o) => !values.has(o.value))];
  }, [apiSuppliers, token]);
  const [listData, setListData] = useState(purchaseListData);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState("");

  const loadApiPurchases = useCallback(async () => {
    if (!token) {
      setListData(purchaseListData);
      setPurchasesError("");
      setPurchasesLoading(false);
      return;
    }
    setPurchasesLoading(true);
    setPurchasesError("");
    try {
      const data = await listPurchasesRequest(token);
      const rows = Array.isArray(data.purchases) ? data.purchases.map(mapApiPurchaseToRow) : [];
      setListData(rows);
    } catch (e) {
      setListData([]);
      if (e instanceof TillFlowApiError) {
        setPurchasesError(
          e.status === 403
            ? `${e.message} (needs catalog.manage to list purchases)`
            : e.message
        );
      } else {
        setPurchasesError("Could not load purchases.");
      }
    } finally {
      setPurchasesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadApiPurchases();
  }, [loadApiPurchases]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const pendingDeletePurchaseIdRef = useRef(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [date, setDate] = useState(new Date());
  const [selectedPurchases, setSelectedPurchases] = useState([]);

  const purchasesWithIds = useMemo(
    () =>
      listData.map((row) => ({
        ...row,
        id: row.id ?? row.reference
      })),
    [listData]
  );

  const filteredPurchases = useMemo(() => {
    let rowsOut = purchasesWithIds;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rowsOut = rowsOut.filter((r) => {
        const hay = [
          r.supplierName,
          r.reference,
          r.date,
          r.status,
          r.total,
          r.paid,
          r.due,
          r.paymentStatus
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (paymentStatusFilter) {
      rowsOut = rowsOut.filter((r) => r.paymentStatus === paymentStatusFilter);
    }
    return rowsOut;
  }, [purchasesWithIds, searchQuery, paymentStatusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentStatusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / rows));
    setCurrentPage((p) => (p > totalPages ? totalPages : p));
  }, [filteredPurchases.length, rows]);

  /** Add Purchase modal — isolated from edit/import so fields don’t clash */
  const [addSupplier, setAddSupplier] = useState("");
  const [addPurchaseDate, setAddPurchaseDate] = useState(() => new Date());
  const [addReference, setAddReference] = useState("");
  const [addPurchaseStatus, setAddPurchaseStatus] = useState("");
  const [addOrderTax, setAddOrderTax] = useState("");
  const [addOrderDiscount, setAddOrderDiscount] = useState("");
  const [addShipping, setAddShipping] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addLineItems, setAddLineItems] = useState(() => [emptyPurchaseLine()]);
  const [addPurchaseFormError, setAddPurchaseFormError] = useState("");
  const addLineItemsRef = useRef(addLineItems);
  const addPurchaseFormErrorRef = useRef(null);

  useEffect(() => {
    addLineItemsRef.current = addLineItems;
  }, [addLineItems]);

  useEffect(() => {
    if (!addPurchaseFormError) {
      return;
    }
    const el = addPurchaseFormErrorRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [addPurchaseFormError]);

  const statusOptions = [
  { label: "Select", value: "" },
  { label: "Received", value: "received" },
  { label: "Pending", value: "pending" },
  { label: "Ordered", value: "ordered" }];

  const parseMoney = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const formatPurchaseTableDate = (d) => {
    if (!d) {
      return "";
    }
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  const resetAddPurchaseForm = useCallback(() => {
    setAddSupplier("");
    setAddPurchaseDate(new Date());
    setAddReference("");
    setAddPurchaseStatus("");
    setAddOrderTax("");
    setAddOrderDiscount("");
    setAddShipping("");
    setAddDescription("");
    setAddLineItems([emptyPurchaseLine()]);
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogQuickAddKey((k) => k + 1);
    setAddPurchaseFormError("");
  }, []);

  useEffect(() => {
    if (!inTillflowShell) {
      return;
    }
    const norm = purchasePathNorm;
    const prev = purchasePathRef.current;
    purchasePathRef.current = norm;
    if (norm === `${TILLFLOW_PURCHASES_BASE}/new` && prev !== `${TILLFLOW_PURCHASES_BASE}/new`) {
      resetAddPurchaseForm();
    }
  }, [inTillflowShell, purchasePathNorm, resetAddPurchaseForm]);

  const leavePurchaseCreateForm = useCallback(() => {
    if (inTillflowShell) {
      navigate(TILLFLOW_PURCHASES_BASE);
      return;
    }
    hideBsModal("add-purchase");
  }, [inTillflowShell, navigate, hideBsModal]);

  const updateAddLine = useCallback((id, field, value) => {
    setAddLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        if (field === "productName") {
          let pid = row.productId;
          if (pid != null && String(pid).trim() !== "") {
            const cat = catalogProducts.find((x) => String(x.id) === String(pid));
            const expected = String(cat?.name ?? "").trim();
            if (expected !== "" && String(value).trim() !== expected) {
              pid = "";
            }
          }
          return { ...row, productName: value, productId: pid };
        }
        return { ...row, [field]: value };
      })
    );
  }, [catalogProducts]);

  const addPurchaseLine = useCallback(() => {
    setAddLineItems((prev) => [...prev, emptyPurchaseLine()]);
  }, []);

  const appendProductFromCatalog = useCallback(
    (productIdStr) => {
      if (!productIdStr || !token) {
        return;
      }
      const pid = String(productIdStr);
      const p = catalogProducts.find((x) => String(x.id) === pid);
      const price = purchaseDefaultUnitPriceFromProduct(p);
      const productName = String(p?.name ?? "");
      setAddLineItems((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: newPurchaseRowId(),
              productId: pid,
              productName,
              qty: "1",
              price,
              discount: "0",
              taxPct: "0"
            }
          ];
        }
        const idx = prev.findIndex((l) => String(l.productId) === pid && pid !== "");
        if (idx >= 0) {
          return prev.map((l, i) => {
            if (i !== idx) {
              return l;
            }
            const q = parseFloat(String(l.qty).replace(/[^0-9.-]/g, ""));
            const qty = Number.isNaN(q) || q < 0 ? 0 : q;
            return { ...l, qty: String(qty + 1) };
          });
        }
        const line = {
          id: newPurchaseRowId(),
          productId: pid,
          productName,
          qty: "1",
          price,
          discount: "0",
          taxPct: "0"
        };
        const first = prev[0];
        const isBlankStarterRow =
          prev.length === 1 &&
          (!String(first.productId ?? "").trim() || first.productId === "") &&
          !String(first.productName ?? "").trim();
        if (isBlankStarterRow) {
          return [
            {
              ...first,
              productId: pid,
              productName,
              qty: "1",
              price,
              discount: "0",
              taxPct: "0"
            }
          ];
        }
        return [...prev, line];
      });
    },
    [catalogProducts, token]
  );

  const catalogQuickComplete = useCallback(
    (e) => {
      const raw = String(e.query ?? "").trim().toLowerCase();
      if (!catalogProducts.length) {
        setCatalogQuickSuggestions([]);
        return;
      }
      const filtered = raw
        ? catalogProducts
            .filter((p) => {
              const name = String(p.name ?? "").toLowerCase();
              const sku = String(p.sku ?? "").toLowerCase();
              return name.includes(raw) || sku.includes(raw);
            })
            .slice(0, 80)
        : catalogProducts.slice(0, 80);
      setCatalogQuickSuggestions(filtered);
    },
    [catalogProducts]
  );

  const catalogQuickOnChange = useCallback((e) => {
    const v = e.value;
    if (v != null && typeof v === "object" && !Array.isArray(v) && v.id != null) {
      return;
    }
    setCatalogQuickSearchText(typeof v === "string" || v == null ? v ?? "" : String(v));
  }, []);

  const catalogQuickOnSelect = useCallback(
    (e) => {
      const p = e.value;
      if (p && p.id != null) {
        appendProductFromCatalog(String(p.id));
        setCatalogQuickSearchText("");
        setCatalogQuickSuggestions([]);
        setCatalogQuickAddKey((k) => k + 1);
      }
    },
    [appendProductFromCatalog]
  );

  const commitPurchaseStagingRow = useCallback(() => {
    if (!purchaseCrmLineItems) {
      return;
    }
    const prev = addLineItemsRef.current;
    if (prev.length === 0) {
      setAddLineItems([emptyPurchaseLine()]);
      return;
    }
    const staging = prev[0];
    if (!purchaseStagingRowReady(staging)) {
      showBsModal("purchase-staging-commit-hint-modal");
      return;
    }
    const committed = { ...staging, id: newPurchaseRowId() };
    const fresh = emptyPurchaseLine();
    setAddPurchaseFormError("");
    setAddLineItems([fresh, ...prev.slice(1), committed]);
  }, [purchaseCrmLineItems, showBsModal]);

  const removePurchaseLine = useCallback(
    (id) => {
      setAddLineItems((prev) => {
        if (prev.length <= 1) {
          return prev;
        }
        if (purchaseCrmLineItems && prev[0]?.id === id) {
          return prev;
        }
        return prev.filter((r) => r.id !== id);
      });
    },
    [purchaseCrmLineItems]
  );

  const lineAmounts = (line) => {
    const qty = parseMoney(line.qty);
    const price = parseMoney(line.price);
    const disc = parseMoney(line.discount);
    const taxPct = parseMoney(line.taxPct);
    const sub = Math.max(0, qty * price - disc);
    const taxAmt = sub * (taxPct / 100);
    const total = sub + taxAmt;
    return { taxAmt, total };
  };

  const handleAddPurchaseSubmit = async (e) => {
    e.preventDefault();
    setAddPurchaseFormError("");
    const supplierLabel =
      supplierOptions.find((o) => o.value === addSupplier)?.label ?? "";
    if (!addSupplier) {
      setAddPurchaseFormError("Please select a supplier.");
      return;
    }
    if (!addReference.trim()) {
      setAddPurchaseFormError("Please enter a reference.");
      return;
    }
    if (!addPurchaseStatus) {
      setAddPurchaseFormError("Please select a status.");
      return;
    }
    const filledLines = addLineItems.filter(
      (l) => String(l.productName).trim() || String(l.productId ?? "").trim()
    );
    if (filledLines.length === 0) {
      setAddPurchaseFormError(
        "Add at least one line: pick a catalog product or enter a product name."
      );
      return;
    }

    const statusLabel =
      statusOptions.find((o) => o.value === addPurchaseStatus)?.label ?? "Pending";

    if (token) {
      try {
        const purchaseDateStr =
          addPurchaseDate instanceof Date
            ? addPurchaseDate.toISOString().slice(0, 10)
            : String(addPurchaseDate ?? "").slice(0, 10);
        const body = {
          supplier_id: Number(addSupplier),
          reference: addReference.trim(),
          purchase_date: purchaseDateStr || new Date().toISOString().slice(0, 10),
          status: statusLabel,
          order_tax: parseMoney(addOrderTax),
          order_discount: parseMoney(addOrderDiscount),
          shipping: parseMoney(addShipping),
          description: addDescription.trim() || null,
          lines: filledLines.map((line) => {
            const pid = String(line.productId ?? "").trim();
            return {
              product_id: pid ? Number(pid) : null,
              product_name: String(line.productName).trim() || null,
              qty: parseMoney(line.qty),
              unit_price: parseMoney(line.price),
              discount: parseMoney(line.discount),
              tax_percent: parseMoney(line.taxPct)
            };
          })
        };
        const data = await createPurchaseRequest(token, body);
        if (!data?.purchase) {
          setAddPurchaseFormError("Unexpected response from server.");
          return;
        }
        setListData((prev) => [mapApiPurchaseToRow(data.purchase), ...prev]);
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setAddPurchaseFormError(err.message);
        } else {
          setAddPurchaseFormError("Could not create purchase.");
        }
        return;
      }
    } else {
      const linesTotal = filledLines.reduce((sum, line) => sum + lineAmounts(line).total, 0);
      const tax = parseMoney(addOrderTax);
      const ship = parseMoney(addShipping);
      const ordDisc = parseMoney(addOrderDiscount);
      const grand = Math.max(0, linesTotal + tax + ship - ordDisc);
      const totalStr = `$${grand.toFixed(2)}`;

      const newRow = {
        id: newPurchaseRowId(),
        supplierName: supplierLabel || addSupplier,
        reference: addReference.trim(),
        date: formatPurchaseTableDate(addPurchaseDate),
        status: statusLabel,
        total: totalStr,
        paid: "$0.00",
        due: totalStr,
        paymentStatus: "Unpaid"
      };

      setListData((prev) => [newRow, ...prev]);
    }

    resetAddPurchaseForm();
    if (purchaseCreatePageActive) {
      navigate(TILLFLOW_PURCHASES_BASE);
      return;
    }
    hideBsModal("add-purchase");
  };

  const addPurchaseFormBody = (
    <>
      {addPurchaseFormError ? (
        <div
          ref={addPurchaseFormErrorRef}
          className="alert alert-danger alert-dismissible fade show mb-3"
          role="alert">
          {addPurchaseFormError}
          <button
            type="button"
            className="btn-close"
            aria-label="Dismiss"
            onClick={() => setAddPurchaseFormError("")}
          />
        </div>
      ) : null}
      <div className="row">
        <div className="col-lg-4 col-md-6 col-sm-12">
          <div className="mb-3 add-product">
            <label className="form-label">
              Supplier Name<span className="text-danger ms-1">*</span>
            </label>
            <div className="row">
              <div className="col-lg-10 col-sm-10 col-10">
                <CommonSelect
                  className="w-100"
                  options={supplierOptions}
                  value={addSupplier}
                  onChange={(e) => setAddSupplier(e.value)}
                  placeholder="Select Supplier"
                  filter={apiSuppliers.length > 5}
                />
              </div>
              <div className="col-lg-2 col-sm-2 col-2 ps-0">
                <div className="add-icon tab">
                  <Link to="#" data-bs-toggle="modal" data-bs-target="#add_customer">
                    <i className="feather icon-plus-circle" />
                  </Link>
                </div>
              </div>
            </div>
            {suppliersLoading ? (
              <p className="text-muted small mb-0 mt-1">Loading suppliers…</p>
            ) : null}
            {token && suppliersError ? (
              <p className="text-danger small mb-0 mt-1">{suppliersError}</p>
            ) : null}
            {token && !suppliersLoading && !suppliersError && apiSuppliers.length === 0 ? (
              <p className="text-muted small mb-0 mt-1">
                No suppliers found. Add them under People → Suppliers.
              </p>
            ) : null}
          </div>
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">
              Date<span className="text-danger ms-1">*</span>
            </label>
            <div className="input-groupicon calender-input">
              <i className="feather icon-calendar info-img" />
              <CommonDatePicker
                appendTo={"self"}
                value={addPurchaseDate}
                onChange={setAddPurchaseDate}
                className="w-100"
              />
            </div>
          </div>
        </div>
        <div className="col-lg-4 col-sm-12">
          <div className="mb-3">
            <label className="form-label">
              Reference<span className="text-danger ms-1">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={addReference}
              onChange={(e) => setAddReference(e.target.value)}
              placeholder="e.g. PO-1001"
            />
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-lg-12">
          <div className={`mt-1${purchaseCreatePageActive ? "" : " modal-body-table"}`}>
            {token ? (
              <>
                <div
                  className={`row g-2 align-items-end mb-3 pb-3 border-bottom quotation-catalog-add${
                    purchaseCrmLineItems ? " quotation-crm-items-toolbar" : ""
                  }`}>
                  <div className={purchaseCrmLineItems ? "col-12" : "col-lg-8 col-md-7"}>
                    {purchaseCrmLineItems ? (
                      <label
                        className="visually-hidden"
                        htmlFor={`catalog-quick-add-purchase-${catalogQuickAddKey}`}>
                        Search products to add purchase lines
                      </label>
                    ) : (
                      <label
                        className="form-label mb-1 fw-semibold"
                        htmlFor={`catalog-quick-add-purchase-${catalogQuickAddKey}`}>
                        Search catalog &amp; add product
                      </label>
                    )}
                    <div
                      className={
                        purchaseCrmLineItems
                          ? "row g-2 g-md-3 align-items-stretch quotation-crm-search-with-action"
                          : ""
                      }>
                      <div
                        className={
                          purchaseCrmLineItems ? "col-12 col-md min-w-0" : ""
                        }>
                        <div className="quotation-catalog-search-field">
                          <Search
                            className="quotation-catalog-search-field__icon"
                            size={18}
                            strokeWidth={2}
                            aria-hidden
                          />
                          <AutoComplete
                            key={`catalog-quick-add-purchase-${catalogQuickAddKey}`}
                            inputId={`catalog-quick-add-purchase-${catalogQuickAddKey}`}
                            value={catalogQuickSearchText}
                            suggestions={catalogQuickSuggestions}
                            completeMethod={catalogQuickComplete}
                            onChange={catalogQuickOnChange}
                            onSelect={catalogQuickOnSelect}
                            field="name"
                            placeholder={
                              purchaseCrmLineItems
                                ? "Add lines — search or list; + on row 1 commits; × removes rows; duplicate pick adds qty"
                                : "Search by name or SKU, then pick a product…"
                            }
                            className="w-100 quotation-catalog-autocomplete"
                            inputClassName="form-control"
                            appendTo={typeof document !== "undefined" ? document.body : null}
                            minLength={purchaseCrmLineItems ? 0 : 1}
                            dropdown={purchaseCrmLineItems}
                            dropdownMode="current"
                            showEmptyMessage
                            emptyMessage="No products match"
                            itemTemplate={(p) => (
                              <span>
                                {p.name}{" "}
                                <span className="text-muted">
                                  ({p.sku != null && String(p.sku) !== "" ? p.sku : "—"})
                                </span>
                              </span>
                            )}
                          />
                        </div>
                      </div>
                      {purchaseCrmLineItems && inTillflowShell ? (
                        <div className="col-12 col-md-auto d-flex justify-content-md-end align-items-center">
                          <Link
                            to="/tillflow/admin/add-product"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tf-btn tf-btn--secondary quotation-crm-add-product-link d-inline-flex align-items-center justify-content-center gap-1 w-100 text-decoration-none text-nowrap"
                            title="Opens in a new browser tab so this purchase stays open. Re-open the product list from the search field after saving if the new item does not appear.">
                            <PlusCircle size={14} strokeWidth={2} aria-hidden />
                            Add new product
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {!purchaseCrmLineItems ? (
                    <div className="col-lg-4 col-md-5">
                      <p className="text-muted small mb-2">
                        Pick a catalog product to fill a line (name and purchase price). For items not in
                        the database, type in the <strong>Product</strong> column. Picking the same product
                        again increases quantity on that line.
                      </p>
                      {inTillflowShell ? (
                        <Link
                          to="/tillflow/admin/add-product"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tf-btn tf-btn--secondary d-inline-flex align-items-center gap-1 text-decoration-none text-nowrap small">
                          <PlusCircle size={14} strokeWidth={2} aria-hidden />
                          Add new product
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {catalogLoading ? <p className="text-muted small mb-2">Loading catalog…</p> : null}
                {catalogError ? <p className="text-danger small mb-2">{catalogError}</p> : null}
              </>
            ) : null}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <label className="form-label mb-0">
                Line items<span className="text-danger ms-1">*</span>
              </label>
              {purchaseCrmLineItems ? null : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={addPurchaseLine}>
                  <i className="feather icon-plus-circle me-1" />
                  Add line
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table datatable rounded-1">
                <thead>
                  <tr>
                    <th className="bg-secondary-transparent p-3">Product</th>
                    <th className="bg-secondary-transparent p-3">Qty</th>
                    <th className="bg-secondary-transparent p-3">Purchase Price ($)</th>
                    <th className="bg-secondary-transparent p-3">Discount ($)</th>
                    <th className="bg-secondary-transparent p-3">Tax (%)</th>
                    <th className="bg-secondary-transparent p-3">Tax Amount ($)</th>
                    <th className="bg-secondary-transparent p-3">Unit Cost ($)</th>
                    <th className="bg-secondary-transparent p-3">Line Total ($)</th>
                    <th className="bg-secondary-transparent p-3 text-end w-1px">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addLineItems.map((line, lineIndex) => {
                    const qty = parseMoney(line.qty);
                    const price = parseMoney(line.price);
                    const disc = parseMoney(line.discount);
                    const taxPct = parseMoney(line.taxPct);
                    const sub = Math.max(0, qty * price - disc);
                    const { taxAmt, total } = lineAmounts(line);
                    const unitCost = qty > 0 ? sub / qty : 0;
                    return (
                      <tr key={line.id}>
                        <td className="p-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={line.productName}
                            onChange={(e) => updateAddLine(line.id, "productName", e.target.value)}
                            placeholder={
                              purchaseCrmLineItems && lineIndex === 0
                                ? "Draft: type or search, then +"
                                : "Product name"
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={line.qty}
                            onChange={(e) => updateAddLine(line.id, "qty", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={line.price}
                            onChange={(e) => updateAddLine(line.id, "price", e.target.value)}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={line.discount}
                            onChange={(e) => updateAddLine(line.id, "discount", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={line.taxPct}
                            onChange={(e) => updateAddLine(line.id, "taxPct", e.target.value)}
                          />
                        </td>
                        <td className="p-2 align-middle small">{taxAmt.toFixed(2)}</td>
                        <td className="p-2 align-middle small">{unitCost.toFixed(2)}</td>
                        <td className="p-2 align-middle small fw-medium">{total.toFixed(2)}</td>
                        <td className="p-2 align-middle text-end">
                          {purchaseCrmLineItems ? (
                            <div className="d-inline-flex align-items-center justify-content-end purchase-line-action-group">
                              {lineIndex === 0 ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0 purchase-line-action-btn"
                                  aria-label="Add line to purchase"
                                  title="Add line (requires product or name on this row)"
                                  onClick={commitPurchaseStagingRow}>
                                  <Plus size={20} strokeWidth={2} aria-hidden />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 purchase-line-action-btn"
                                  aria-label="Remove this line"
                                  title="Remove line"
                                  onClick={() => removePurchaseLine(line.id)}>
                                  <X size={20} strokeWidth={2} aria-hidden />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0"
                              onClick={() => removePurchaseLine(line.id)}
                              title="Remove line"
                              aria-label="Remove line">
                              <i className="feather icon-trash-2" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-lg-3 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">Order tax ($)</label>
            <input
              type="text"
              className="form-control"
              value={addOrderTax}
              onChange={(e) => setAddOrderTax(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="col-lg-3 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">Order discount ($)</label>
            <input
              type="text"
              className="form-control"
              value={addOrderDiscount}
              onChange={(e) => setAddOrderDiscount(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="col-lg-3 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">Shipping ($)</label>
            <input
              type="text"
              className="form-control"
              value={addShipping}
              onChange={(e) => setAddShipping(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="col-lg-3 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">
              Status<span className="text-danger ms-1">*</span>
            </label>
            <CommonSelect
              className="w-100"
              options={statusOptions}
              value={addPurchaseStatus}
              onChange={(e) => setAddPurchaseStatus(e.value)}
              placeholder="Select Status"
              filter={false}
            />
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-lg-12 mt-1">
          <div className="mb-3 summer-description-box">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              maxLength={320}
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              placeholder="Notes (optional)"
            />
            <p className="mt-1 text-muted small mb-0">
              {addDescription.trim().split(/\s+/).filter(Boolean).length} / ~60 words suggested
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const columns = [
  { header: "Supplier Name", field: "supplierName", key: "supplierName" },
  { header: "Reference", field: "reference", key: "reference" },
  { header: "Date", field: "date", key: "date" },
  {
    header: "Status",
    field: "status",
    key: "status",
    body: (data) =>
    <span
      className={`badges status-badge fs-10 p-1 px-2 rounded-1 ${
      data.status === "Pending" ?
      "badge-pending" :
      data.status === "Ordered" ?
      "bg-warning" :
      data.status === "Received" ?
      "text-success bg-success-transparent" :
      ""}`
      }>
      
          {data.status}
        </span>

  },
  { header: "Total", field: "total", key: "total" },
  { header: "Paid", field: "paid", key: "paid" },
  { header: "Due", field: "due", key: "due" },
  {
    header: "Payment Status",
    field: "paymentStatus",
    key: "paymentStatus",
    body: (data) =>
    <span
      className={`p-1 pe-2 rounded-1 fs-10 ${
      data.paymentStatus === "Paid" ?
      "text-success bg-success-transparent" :
      data.paymentStatus === "Unpaid" ?
      "text-danger bg-danger-transparent" :
      "text-warning bg-warning-transparent"}`
      }>
      
          <i className="ti ti-point-filled me-1 fs-11"></i>
          {data.paymentStatus}
        </span>

  },
  {
    header: "",
    field: "actions",
    key: "actions",
    sortable: false,
    body: (row) =>
    <div className="edit-delete-action">
          <Link className="me-2 p-2" to="#" onClick={(e) => e.preventDefault()}>
            <i className="feather icon-eye action-eye"></i>
          </Link>
          <Link
        to="#"
        className="me-2 p-2"
        data-bs-toggle="modal"
        data-bs-target="#edit-purchase"
        onClick={(e) => e.preventDefault()}>
        
            <i className="feather icon-edit"></i>
          </Link>
          <Link
        data-bs-toggle="modal"
        data-bs-target="#delete-modal"
        className="p-2"
        to="#"
        onClick={(e) => {
          e.preventDefault();
          pendingDeletePurchaseIdRef.current = row.id;
        }}>
        
            <i className="feather icon-trash-2"></i>
          </Link>
        </div>

  }];

  const handleSearch = (value) => {
    setSearchQuery(typeof value === "string" ? value : "");
  };
  return (
    <>
      <div
        className={`page-wrapper purchase-list-page${
          purchaseCreatePageActive ? " purchase-list-page--create" : ""
        }`}>
        <div className="content">
          {purchaseCreatePageActive ? (
            <form
              className="quotation-form-sheet quotation-form-sheet--crm px-3 px-lg-4 pb-4"
              noValidate
              onSubmit={handleAddPurchaseSubmit}>
              <div className="page-header border-0 pb-2 quotation-crm-header">
                <div className="d-flex flex-wrap align-items-start gap-3 justify-content-between w-100">
                  <div className="page-title mb-0 min-w-0 flex-grow-1 pe-2">
                    <h4 className="mb-0">Create purchase</h4>
                  </div>
                  <button
                    type="button"
                    className="tf-btn tf-btn--secondary quotation-crm-header-back d-inline-flex align-items-center justify-content-center gap-1 flex-shrink-0 align-self-start text-decoration-none"
                    onClick={leavePurchaseCreateForm}>
                    <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                    Back
                  </button>
                </div>
              </div>
              {addPurchaseFormBody}
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-3 pt-3 border-top border-secondary-subtle">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={leavePurchaseCreateForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add purchase
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="page-header transfer">
                <div className="add-item d-flex">
                  <div className="page-title">
                    <h4 className="fw-bold">Purchase</h4>
                    <h6>Manage your purchases</h6>
                  </div>
                </div>
                <TableTopHead
                  onRefresh={token ? () => void loadApiPurchases() : undefined}
                />
                <div className="d-flex purchase-pg-btn">
                  <div className="page-btn">
                    <Link
                      to="#"
                      className="btn btn-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        if (inTillflowShell) {
                          navigate(`${TILLFLOW_PURCHASES_BASE}/new`);
                        } else {
                          const el = document.getElementById("add-purchase");
                          if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
                            const inst =
                              window.bootstrap.Modal.getInstance(el) ??
                              new window.bootstrap.Modal(el);
                            inst.show();
                          }
                        }
                      }}>
                      <i className="me-1 feather icon-plus-circle" />
                      Add Purchase
                    </Link>
                  </div>
                  <div className="page-btn import">
                    <Link
                      to="#"
                      className="btn btn-secondary color"
                      data-bs-toggle="modal"
                      data-bs-target="#view-notes">
                      <i className="feather icon-download me-2" />
                      Import Purchase
                    </Link>
                  </div>
                </div>
              </div>
              {token && purchasesError ? (
                <p className="text-danger small mb-2 px-1">{purchasesError}</p>
              ) : null}
              {token && purchasesLoading ? (
                <p className="text-muted small mb-2 px-1">Loading purchases…</p>
              ) : null}
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <SearchFromApi callback={handleSearch} />
                  <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                        data-bs-toggle="dropdown">
                        {paymentStatusFilter
                          ? `Payment: ${paymentStatusFilter}`
                          : "Payment Status"}
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${
                              paymentStatusFilter === "" ? " active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaymentStatusFilter("");
                            }}>
                            All
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${
                              paymentStatusFilter === "Paid" ? " active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaymentStatusFilter("Paid");
                            }}>
                            Paid
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${
                              paymentStatusFilter === "Unpaid" ? " active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaymentStatusFilter("Unpaid");
                            }}>
                            Unpaid
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${
                              paymentStatusFilter === "Overdue" ? " active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaymentStatusFilter("Overdue");
                            }}>
                            Overdue
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <PrimeDataTable
                      column={columns}
                      data={filteredPurchases}
                      rows={rows}
                      setRows={setRows}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      totalRecords={filteredPurchases.length}
                      loading={Boolean(token && purchasesLoading)}
                      selectionMode="checkbox"
                      selection={selectedPurchases}
                      onSelectionChange={(e) => setSelectedPurchases(e.value)}
                      dataKey="id"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <CommonFooter />
      </div>
      {/* Add Purchase — legacy / non–TillFlow shell */}
      {!inTillflowShell ? (
      <div className="modal fade" id="add-purchase">
        <div className="modal-dialog purchase modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add Purchase</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleAddPurchaseSubmit} noValidate>
              <div className="modal-body">{addPurchaseFormBody}</div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      ) : null}
      {/* /Add Purchase */}
      {/* Add Supplier */}
      <div className="modal fade" id="add_customer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add Supplier</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handlePurchaseAddSupplierSubmit}>
              <div className="modal-body">
                <div className="new-employee-field">
                  <div className="profile-pic-upload">
                    <div className="profile-pic p-2" style={{ minHeight: 120 }}>
                      <img
                        src={addSupAvatarPreview}
                        alt=""
                        className="object-fit-cover h-100 w-100 rounded-1"
                        style={{ maxHeight: 140 }}
                      />
                    </div>
                    <div className="mb-3">
                      <div className="image-upload mb-0">
                        <input
                          ref={addSupAvatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={onPurchaseAddSupplierAvatarSelected}
                        />
                        <div className="image-uploads">
                          <h4>Upload image</h4>
                        </div>
                      </div>
                      <p className="mt-2 text-muted small">JPG, PNG, GIF or WebP — max 2 MB. Optional.</p>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      First name<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={addSupFirstName}
                      onChange={(e) => setAddSupFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Last name<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={addSupLastName}
                      onChange={(e) => setAddSupLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                  <div className="col-lg-12 mb-3">
                    <label className="form-label">
                      Phone<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      value={addSupPhone}
                      onChange={(e) => setAddSupPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="col-lg-12 mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={addSupEmail}
                      onChange={(e) => setAddSupEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-lg-12 mb-3">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={addSupLocation}
                      onChange={(e) => setAddSupLocation(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-12">
                    <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                      <span className="status-label">Status</span>
                      <input
                        type="checkbox"
                        id="pur-inline-supplier-status"
                        className="check"
                        checked={addSupStatusActive}
                        onChange={(e) => setAddSupStatusActive(e.target.checked)}
                      />
                      <label htmlFor="pur-inline-supplier-status" className="checktoggle">
                        {" "}
                      </label>
                    </div>
                  </div>
                  {addSupError ? (
                    <div className="col-12 mt-2">
                      <p className="text-danger small mb-0">{addSupError}</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary fs-13 fw-medium p-2 px-3"
                  onClick={() => void savePurchaseAddSupplier()}>
                  Add supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Supplier */}
      {/* Edit Purchase */}
      <div className="modal fade" id="edit-purchase">
        <div className="modal-dialog purchase modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Edit Purchase</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form action="purchase-list.html">
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-4 col-md-6 col-sm-12">
                    <div className="mb-3 add-product">
                      <label className="form-label">
                        Supplier Name<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="row">
                        <div className="col-lg-10 col-sm-10 col-10">
                          <CommonSelect
                            className="w-100"
                            options={supplierOptions}
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.value)}
                            placeholder="Select Supplier"
                            filter={false} />
                          
                        </div>
                        <div className="col-lg-2 col-sm-2 col-2 ps-0">
                          <div className="add-icon tab">
                            <Link to="#">
                              <i className="feather icon-plus-circle" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 col-md-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Date<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="input-groupicon calender-input">
                        <i className="feather icon-plus-calendar info-img" />
                        <CommonDatePicker
                          appendTo={"self"}
                          value={date}
                          onChange={setDate}
                          className="w-100" />
                        
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Supplier<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue="Elite Retail" />
                      
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Product<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search Product" />
                      
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="modal-body-table">
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th className="bg-secondary-transparent p-3">
                                Product Name
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                QTY
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Purchase Price($){" "}
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Discount($){" "}
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Tax %
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Tax Amount($)
                              </th>
                              <th className="text-end bg-secondary-transparent p-3">
                                Unit Cost($)
                              </th>
                              <th className="text-end bg-secondary-transparent p-3">
                                Total Cost ($){" "}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-4">
                                <div className="d-flex align-items-center">
                                  <Link
                                    to="#"
                                    className="avatar avatar-md me-2">
                                    
                                    <img src={stockImg02} alt="product" />
                                  </Link>
                                  <Link to="#">Nike Jordan</Link>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="product-quantity">
                                  <span className="quantity-btn">
                                    +
                                    <i className="plus-circle feather icon-plus-circle" />
                                  </span>
                                  <input
                                    type="text"
                                    className="quntity-input"
                                    defaultValue={10} />
                                  
                                  <span className="quantity-btn">
                                    <i className="feather icon-minus-circle feather icon-search" />
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">300</td>
                              <td className="p-4">50</td>
                              <td className="p-4">0</td>
                              <td className="p-4">0.00</td>
                              <td className="p-4">300</td>
                              <td className="p-4">600</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-12 float-md-right">
                    <div className="total-order m-2 mb-3 ms-auto">
                      <ul className="border-1 rounded-1">
                        <li className="border-0 border-bottom">
                          <h4 className="border-0">Order Tax</h4>
                          <h5>$ 0.00</h5>
                        </li>
                        <li className="border-0 border-bottom">
                          <h4 className="border-0">Discount</h4>
                          <h5>$ 0.00</h5>
                        </li>
                        <li className="border-0 border-bottom">
                          <h4 className="border-0">Shipping</h4>
                          <h5>$ 0.00</h5>
                        </li>
                        <li className="total border-0">
                          <h4 className="border-0">Grand Total</h4>
                          <h5>$1800.00</h5>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-3 col-md-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Order Tax<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue={0} />
                      
                    </div>
                  </div>
                  <div className="col-lg-3 col-md-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Discount<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue={0} />
                      
                    </div>
                  </div>
                  <div className="col-lg-3 col-md-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Shipping<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue={0} />
                      
                    </div>
                  </div>
                  <div className="col-lg-3 col-md-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Status<span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={statusOptions}
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.value)}
                        placeholder="Select Status"
                        filter={false} />
                      
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-12">
                    <div className="mb-3 summer-description-box">
                      <label className="form-label">Description</label>
                      <div id="summernote2"></div>
                      <p className="mt-1">Maximum 60 Words</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal">
                  
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes{" "}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Purchase */}
      {/* Import Purchase */}
      <div className="modal fade" id="view-notes">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content">
                <div className="modal-header">
                  <div className="page-title">
                    <h4>Import Purchase</h4>
                  </div>
                  <button
                    type="button"
                    className="close"
                    data-bs-dismiss="modal"
                    aria-label="Close">
                    
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <form action="purchase-list.html">
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-lg-6 col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Supplier Name
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <div className="row">
                            <div className="col-lg-10 col-sm-10 col-10">
                              <CommonSelect
                                className="w-100"
                                options={supplierOptions}
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.value)}
                                placeholder="Select Supplier"
                                filter={false} />
                              
                            </div>
                            <div className="col-lg-2 col-sm-2 col-2 ps-0">
                              <div className="add-icon tab">
                                <Link
                                  to="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#add_customer">
                                  
                                  <i className="feather icon-plus-circle" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            {" "}
                            Status<span className="text-danger ms-1">*</span>
                          </label>
                          <CommonSelect
                            className="w-100"
                            options={statusOptions}
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.value)}
                            placeholder="Select Status"
                            filter={false} />
                          
                        </div>
                      </div>
                      <div className="col-lg-12 col-12">
                        <div className="row">
                          <div>
                            <div className="modal-footer-btn download-file">
                              <Link
                                to="#"
                                className="btn btn-submit fs-13 fw-medium">
                                
                                Download Sample File
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-12">
                        <div className="mb-3 image-upload-down">
                          <label className="form-label"> Upload CSV File</label>
                          <div className="image-upload download">
                            <input type="file" />
                            <div className="image-uploads">
                              <img src={downloadImg} alt="img" />
                              <h4>
                                Drag and drop a <span>file to upload</span>
                              </h4>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-4 col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Order Tax<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                      </div>
                      <div className="col-lg-4 col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Discount<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                      </div>
                      <div className="col-lg-4 col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Shipping<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                      </div>
                      <div className="mb-3 summer-description-box transfer">
                        <label className="form-label">Description</label>
                        <div id="summernote3"></div>
                        <p>Maximum 60 Characters</p>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn me-2 btn-secondary"
                      data-bs-dismiss="modal">
                      
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Import Purchase */}
      <div
        className="modal fade tf-hint-modal"
        id="purchase-staging-commit-hint-modal"
        tabIndex={-1}
        aria-labelledby="purchase-staging-commit-hint-title"
        aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content tf-hint-modal__content border-0">
            <div className="modal-body tf-hint-modal__body text-center">
              <div className="tf-hint-modal__icon-wrap" aria-hidden>
                <Plus className="tf-hint-modal__icon" size={26} strokeWidth={2} />
              </div>
              <h4 className="tf-hint-modal__title" id="purchase-staging-commit-hint-title">
                Complete the line first
              </h4>
              <p className="tf-hint-modal__message mb-0">
                Fill in the first row before adding it to the purchase — pick a product from the catalog
                search or type a product name, then press <strong className="text-nowrap">+</strong> again.
              </p>
              <div className="tf-hint-modal__actions">
                <button
                  type="button"
                  className="btn btn-primary tf-hint-modal__btn fw-semibold px-4"
                  data-bs-dismiss="modal">
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteModal
        onConfirm={() => {
          void (async () => {
            const id = pendingDeletePurchaseIdRef.current;
            if (!id) {
              return;
            }
            if (token && isApiNumericId(id)) {
              try {
                await deletePurchaseRequest(token, id);
              } catch (e) {
                if (e instanceof TillFlowApiError) {
                  window.alert(e.message);
                } else {
                  window.alert("Could not delete purchase.");
                }
                pendingDeletePurchaseIdRef.current = null;
                return;
              }
            }
            setListData((prev) =>
              prev.filter((r) => (r.id ?? r.reference) !== id)
            );
            setSelectedPurchases((prev) =>
              prev.filter((r) => (r.id ?? r.reference) !== id)
            );
            pendingDeletePurchaseIdRef.current = null;
          })();
        }}
      />
    </>);

};

export default PurchasesList;