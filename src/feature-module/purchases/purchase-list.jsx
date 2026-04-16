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
import { ChevronLeft, MoreVertical, Plus, PlusCircle, Search, X } from "react-feather";
import { AutoComplete } from "primereact/autocomplete";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createPurchaseRequest,
  createPurchasePaymentRequest,
  getPurchaseRequest,
  listPurchasePaymentsRequest,
  sendPurchaseToSupplierRequest,
  updatePurchaseRequest,
  deletePurchaseRequest,
  listPurchasesRequest
} from "../../tillflow/api/purchases";
import {
  createGoodsReceiptRequest,
  listPurchaseReceiptsRequest
} from "../../tillflow/api/goodsReceipts";
import { listProductsRequest } from "../../tillflow/api/products";
import {
  createSupplierMultipartRequest,
  createSupplierRequest,
  listSuppliersRequest
} from "../../tillflow/api/suppliers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import BreezeTechLogo from "../../tillflow/components/BreezeTechLogo";
import { getCompanySettingsSnapshot } from "../../utils/companySettingsStorage";
import { downloadQuotationDetailPdfFromElement } from "../../utils/quotationExport";
import { downloadPurchasesExcel, downloadPurchasesPdf } from "../../utils/purchaseExport";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";
const TILLFLOW_PURCHASES_BASE = "/tillflow/admin/purchases";
const TILLFLOW_PURCHASE_RETURNS_BASE = "/tillflow/admin/purchase-returns";
const TILLFLOW_PURCHASES_EDIT_RE = /\/tillflow\/admin\/purchases\/(\d+)\/edit$/;

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
  return `KES ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function normalizePurchaseType(v) {
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "expense" ? "expense" : "stock";
}

function purchaseTypeLabel(v) {
  return normalizePurchaseType(v) === "expense" ? "Expense" : "Stock";
}

function normalizePurchaseStatusValue(v) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (
    raw === "draft" ||
    raw === "received" ||
    raw === "ordered" ||
    raw === "pending" ||
    raw === "partial" ||
    raw === "return"
  ) {
    return raw;
  }
  return "pending";
}

function asNonNegativeNumber(v) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function nextPurchaseRefLocal(list) {
  let max = 0;
  for (const row of list) {
    const m = /^PO-(\d+)$/i.exec(String(row?.reference ?? ""));
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `PO-${String(max + 1).padStart(3, "0")}`;
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
  const lines = Array.isArray(p.lines) ? p.lines : [];
  const orderedFromSummary =
    asNonNegativeNumber(p.ordered_qty) ??
    asNonNegativeNumber(p.total_ordered_qty) ??
    asNonNegativeNumber(p.qty_ordered);
  const receivedFromSummary =
    asNonNegativeNumber(p.received_qty) ??
    asNonNegativeNumber(p.total_received_qty) ??
    asNonNegativeNumber(p.qty_received);
  const remainingFromSummary =
    asNonNegativeNumber(p.remaining_qty) ??
    asNonNegativeNumber(p.total_remaining_qty) ??
    asNonNegativeNumber(p.qty_remaining);

  const orderedFromLines = lines.reduce((sum, line) => {
    const qty = asNonNegativeNumber(line?.qty ?? line?.ordered_qty ?? 0);
    return sum + (qty ?? 0);
  }, 0);
  const receivedFromLines = lines.reduce((sum, line) => {
    const qty = asNonNegativeNumber(line?.received_qty ?? 0);
    return sum + (qty ?? 0);
  }, 0);

  const orderedQty = orderedFromSummary ?? orderedFromLines ?? 0;
  const receivedQty = receivedFromSummary ?? receivedFromLines ?? 0;
  const remainingQty =
    remainingFromSummary ?? Math.max(0, Number(orderedQty || 0) - Number(receivedQty || 0));
  return {
    id: String(p.id),
    supplierId: p.supplier_id != null ? String(p.supplier_id) : "",
    supplierName: p.supplier_name ?? "—",
    reference: p.reference,
    date: dateStr,
    status: p.status,
    purchaseType: normalizePurchaseType(
      p.purchase_type ?? p.intent ?? p.type ?? "stock"
    ),
    orderedQty,
    receivedQty,
    remainingQty,
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
  const purchaseEditMatch = inTillflowShell
    ? purchasePathNorm.match(TILLFLOW_PURCHASES_EDIT_RE)
    : null;
  const purchaseEditId = purchaseEditMatch?.[1] ?? null;
  const purchaseEditPageActive = Boolean(purchaseEditId);
  const auth = useOptionalAuth();
  const token =
    auth?.token ??
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(TILLFLOW_TOKEN_KEY)
      : null);
  /** Same UX as quotations/new: fixed empty row 1, + commits, × on committed rows */
  const purchaseCrmLineItems = Boolean(
    token && inTillflowShell && (purchaseCreatePageActive || purchaseEditPageActive)
  );
  const purchasePathRef = useRef("");
  const viewPurchasePrintRootRef = useRef(null);

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
  const [editPurchaseLoading, setEditPurchaseLoading] = useState(false);

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
            ? `${e.message} (needs catalog items permission to load products)`
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
            ? `${e.message} (needs purchases permission)`
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
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const pendingDeletePurchaseIdRef = useRef(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [date, setDate] = useState(new Date());
  const [selectedPurchases, setSelectedPurchases] = useState([]);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveLoadBusy, setReceiveLoadBusy] = useState(false);
  const [receiveFormError, setReceiveFormError] = useState("");
  const [receivePurchase, setReceivePurchase] = useState(null);
  const [receiveDate, setReceiveDate] = useState(() => new Date());
  const [receiveNote, setReceiveNote] = useState("");
  const [receiveLines, setReceiveLines] = useState([]);
  const [receiptCount, setReceiptCount] = useState(0);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentLoadBusy, setPaymentLoadBusy] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState("");
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentCount, setPaymentCount] = useState(0);
  const [sendOrderBusyId, setSendOrderBusyId] = useState("");
  const [sendPreviewPurchase, setSendPreviewPurchase] = useState(null);
  const [sendPreviewTo, setSendPreviewTo] = useState("");
  const [sendPreviewCc, setSendPreviewCc] = useState("");
  const [sendPreviewSubject, setSendPreviewSubject] = useState("");
  const [sendPreviewMessage, setSendPreviewMessage] = useState("");
  const [sendPreviewError, setSendPreviewError] = useState("");
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewPurchase, setViewPurchase] = useState(null);
  const [viewPaymentThread, setViewPaymentThread] = useState([]);
  const [viewPaymentThreadBusy, setViewPaymentThreadBusy] = useState(false);

  const companySnapshot = useMemo(() => getCompanySettingsSnapshot(), []);

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
          purchaseTypeLabel(r.purchaseType),
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
    if (statusFilter) {
      rowsOut = rowsOut.filter((r) => String(r.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (typeFilter) {
      rowsOut = rowsOut.filter(
        (r) => normalizePurchaseType(r.purchaseType) === normalizePurchaseType(typeFilter)
      );
    }
    return rowsOut;
  }, [purchasesWithIds, searchQuery, paymentStatusFilter, statusFilter, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentStatusFilter, statusFilter, typeFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / rows));
    setCurrentPage((p) => (p > totalPages ? totalPages : p));
  }, [filteredPurchases.length, rows]);

  /** Add Purchase modal — isolated from edit/import so fields don’t clash */
  const [addSupplier, setAddSupplier] = useState("");
  const [addPurchaseDate, setAddPurchaseDate] = useState(() => new Date());
  const [addReference, setAddReference] = useState("");
  const [addPurchaseType, setAddPurchaseType] = useState("stock");
  const [addPurchaseStatus, setAddPurchaseStatus] = useState("draft");
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
  { label: "Draft", value: "draft" },
  { label: "Partial", value: "partial" },
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
    setAddReference(nextPurchaseRefLocal(listData));
    setAddPurchaseType("stock");
    setAddPurchaseStatus("draft");
    setAddDescription("");
    setAddLineItems([emptyPurchaseLine()]);
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogQuickAddKey((k) => k + 1);
    setAddPurchaseFormError("");
  }, [listData]);

  useEffect(() => {
    if (purchaseCreatePageActive && !purchaseEditPageActive && !addReference.trim()) {
      setAddReference(nextPurchaseRefLocal(listData));
    }
  }, [addReference, listData, purchaseCreatePageActive, purchaseEditPageActive]);

  const purchaseTypeOptions = [
    { label: "Stock purchase (restock)", value: "stock" },
    { label: "Expense purchase (no stock)", value: "expense" }
  ];

  useEffect(() => {
    if (!inTillflowShell) {
      return;
    }
    const norm = purchasePathNorm;
    const prev = purchasePathRef.current;
    purchasePathRef.current = norm;
    if (
      norm === `${TILLFLOW_PURCHASES_BASE}/new` &&
      prev !== `${TILLFLOW_PURCHASES_BASE}/new`
    ) {
      resetAddPurchaseForm();
    }
  }, [inTillflowShell, purchasePathNorm, resetAddPurchaseForm]);

  useEffect(() => {
    if (!token || !purchaseEditPageActive || !purchaseEditId) {
      return;
    }
    let cancelled = false;
    setEditPurchaseLoading(true);
    setAddPurchaseFormError("");
    (async () => {
      try {
        const data = await getPurchaseRequest(token, purchaseEditId);
        const purchase = data?.purchase ?? data;
        if (!purchase || cancelled) {
          return;
        }
        setAddSupplier(String(purchase.supplier_id ?? ""));
        setAddPurchaseDate(
          purchase.purchase_date ? new Date(`${String(purchase.purchase_date)}T12:00:00`) : new Date()
        );
        setAddReference(String(purchase.reference ?? ""));
        setAddPurchaseType(normalizePurchaseType(purchase.purchase_type ?? purchase.type ?? "stock"));
        setAddPurchaseStatus(normalizePurchaseStatusValue(purchase.status));
        setAddDescription(String(purchase.description ?? ""));
        const rawLines = Array.isArray(purchase.lines) ? purchase.lines : [];
        const mapped = rawLines.map((line) => ({
          id: newPurchaseRowId(),
          productId:
            line?.product_id != null && String(line.product_id).trim() !== ""
              ? String(line.product_id)
              : "",
          productName: String(line?.product_name ?? line?.name ?? ""),
          qty: String(line?.qty ?? line?.ordered_qty ?? "1"),
          price: String(line?.unit_price ?? line?.price ?? ""),
          discount: "0",
          taxPct: String(line?.tax_percent ?? line?.taxPct ?? "0")
        }));
        setAddLineItems(mapped.length ? mapped : [emptyPurchaseLine()]);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof TillFlowApiError) {
          setAddPurchaseFormError(err.message);
        } else {
          setAddPurchaseFormError("Could not load purchase for editing.");
        }
      } finally {
        if (!cancelled) {
          setEditPurchaseLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseEditId, purchaseEditPageActive, token]);

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
    const taxPct = parseMoney(line.taxPct);
    const sub = Math.max(0, qty * price);
    const taxAmt = sub * (taxPct / 100);
    const total = sub + taxAmt;
    return { taxAmt, total };
  };

  const purchaseFormSummary = useMemo(() => {
    const activeLines = addLineItems.filter(
      (l) => String(l.productName).trim() || String(l.productId ?? "").trim()
    );
    const subtotalExTax = activeLines.reduce((sum, line) => {
      const qty = parseMoney(line.qty);
      const price = parseMoney(line.price);
      return sum + Math.max(0, qty * price);
    }, 0);
    const taxTotal = activeLines.reduce((sum, line) => sum + lineAmounts(line).taxAmt, 0);
    const grandTotal = activeLines.reduce((sum, line) => sum + lineAmounts(line).total, 0);
    return {
      lineCount: activeLines.length,
      subtotalExTax,
      taxTotal,
      grandTotal
    };
  }, [addLineItems]);

  const viewPurchaseSummary = useMemo(() => {
    const lines = Array.isArray(viewPurchase?.lines) ? viewPurchase.lines : [];
    const subtotalExTax = lines.reduce((sum, line) => {
      const qty = parseMoney(line?.qty);
      const unit = parseMoney(line?.unit_price);
      return sum + Math.max(0, qty * unit);
    }, 0);
    const taxTotal = lines.reduce((sum, line) => {
      const qty = parseMoney(line?.qty);
      const unit = parseMoney(line?.unit_price);
      const taxPct = parseMoney(line?.tax_percent);
      const base = Math.max(0, qty * unit);
      return sum + base * (taxPct / 100);
    }, 0);
    return {
      subtotalExTax,
      taxTotal,
      grandTotal: subtotalExTax + taxTotal
    };
  }, [viewPurchase]);

  const updateReceiveLineQty = useCallback((lineId, value) => {
    setReceiveLines((prev) =>
      prev.map((line) => {
        if (String(line.id) !== String(lineId)) {
          return line;
        }
        return { ...line, receiveNow: value };
      })
    );
  }, []);

  const openReceiveModal = useCallback(
    async (row) => {
      if (!token || !row?.id || normalizePurchaseType(row.purchaseType) !== "stock") {
        return;
      }
      setReceiveLoadBusy(true);
      setReceiveFormError("");
      setReceiveNote("");
      setReceiveDate(new Date());
      setReceiptCount(0);
      try {
        const data = await getPurchaseRequest(token, row.id);
        const purchase = data?.purchase ?? data;
        const rawLines = Array.isArray(purchase?.lines) ? purchase.lines : [];
        const mappedLines = rawLines.map((line, idx) => {
          const orderedQty = parseMoney(line?.qty ?? line?.ordered_qty ?? 0);
          const alreadyReceived = parseMoney(line?.received_qty ?? 0);
          return {
            id: line?.id ?? `${idx}`,
            productId: line?.product_id ?? line?.product?.id ?? null,
            label: String(line?.product_name ?? line?.name ?? `Line ${idx + 1}`),
            orderedQty,
            alreadyReceived,
            remainingQty: Math.max(0, orderedQty - alreadyReceived),
            receiveNow: ""
          };
        });
        setReceivePurchase({
          id: String(purchase?.id ?? row.id),
          reference: String(purchase?.reference ?? row.reference ?? "")
        });
        setReceiveLines(mappedLines);
        try {
          const receiptsData = await listPurchaseReceiptsRequest(token, row.id);
          const receipts = Array.isArray(receiptsData?.receipts) ? receiptsData.receipts : [];
          setReceiptCount(receipts.length);
        } catch {
          setReceiptCount(0);
        }
        showBsModal("receive-purchase");
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          window.alert(err.message);
        } else {
          window.alert("Could not load purchase details.");
        }
      } finally {
        setReceiveLoadBusy(false);
      }
    },
    [showBsModal, token]
  );

  const handleSubmitReceive = useCallback(
    async (e) => {
      e.preventDefault();
      if (!token || !receivePurchase?.id) {
        return;
      }
      setReceiveFormError("");
      const payloadLines = [];
      for (const line of receiveLines) {
        const qtyNow = parseMoney(line.receiveNow);
        if (qtyNow <= 0) {
          continue;
        }
        if (qtyNow > line.remainingQty) {
          setReceiveFormError(
            `Cannot receive ${qtyNow} for ${line.label}. Remaining is ${line.remainingQty}.`
          );
          return;
        }
        const numericLineId = Number(line.id);
        payloadLines.push({
          line_id: Number.isFinite(numericLineId) ? numericLineId : line.id,
          qty_received: qtyNow
        });
      }
      if (payloadLines.length === 0) {
        setReceiveFormError("Enter a quantity to receive on at least one line.");
        return;
      }
      const remainingAfter = receiveLines.reduce((sum, line) => {
        const posted = payloadLines.find((x) => String(x.line_id) === String(line.id));
        const postedQty = posted ? Number(posted.qty_received) : 0;
        return sum + Math.max(0, Number(line.remainingQty) - postedQty);
      }, 0);
      const baseReceivedFromLines = receiveLines.reduce(
        (sum, line) => sum + Math.max(0, Number(line.alreadyReceived) || 0),
        0
      );
      const nextStatus = remainingAfter > 0 ? "Partial" : "Received";
      setReceiveBusy(true);
      try {
        const receiveDateStr =
          receiveDate instanceof Date
            ? receiveDate.toISOString().slice(0, 10)
            : String(receiveDate ?? "").slice(0, 10);
        const data = await createGoodsReceiptRequest(token, receivePurchase.id, {
          received_at: receiveDateStr || new Date().toISOString().slice(0, 10),
          note: receiveNote.trim() || null,
          lines: payloadLines
        });
        const nextReceiveLines = receiveLines.map((line) => {
          const posted = payloadLines.find((x) => String(x.line_id) === String(line.id));
          const postedQty = posted ? Number(posted.qty_received) || 0 : 0;
          const nextAlready = Math.max(0, Number(line.alreadyReceived) + postedQty);
          const nextRemain = Math.max(0, Number(line.remainingQty) - postedQty);
          return {
            ...line,
            alreadyReceived: nextAlready,
            remainingQty: nextRemain,
            receiveNow: ""
          };
        });
        setReceiveLines(nextReceiveLines);
        setReceiptCount((c) => c + 1);
        const postedTotal = payloadLines.reduce(
          (sum, entry) => sum + Math.max(0, Number(entry.qty_received) || 0),
          0
        );
        const purchase = data?.purchase ?? data;
        if (purchase?.id != null) {
          setListData((prev) =>
            prev.map((row) =>
              String(row.id) === String(purchase.id)
                ? (() => {
                    const mapped = mapApiPurchaseToRow(purchase);
                    const nextRemaining = Math.max(0, remainingAfter);
                    const nextReceived = Math.max(0, baseReceivedFromLines + postedTotal);
                    const nextOrdered = Math.max(nextReceived + nextRemaining, 0);
                    return {
                      ...mapped,
                      status: nextStatus,
                      orderedQty: Math.max(parseMoney(mapped.orderedQty), nextOrdered),
                      receivedQty: Math.max(parseMoney(mapped.receivedQty), nextReceived),
                      remainingQty: nextRemaining
                    };
                  })()
                : row
            )
          );
        } else {
          setListData((prev) =>
            prev.map((row) => {
              if (String(row.id) !== String(receivePurchase.id)) {
                return row;
              }
              const nextRemaining = Math.max(0, remainingAfter);
              const nextReceived = Math.max(0, baseReceivedFromLines + postedTotal);
              return {
                ...row,
                status: nextStatus,
                orderedQty: Math.max(nextReceived + nextRemaining, 0),
                receivedQty: nextReceived,
                remainingQty: nextRemaining
              };
            })
          );
          await loadApiPurchases();
        }
        hideBsModal("receive-purchase");
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setReceiveFormError(err.message);
        } else {
          setReceiveFormError("Could not record received stock.");
        }
      } finally {
        setReceiveBusy(false);
      }
    },
    [hideBsModal, loadApiPurchases, receiveDate, receiveLines, receiveNote, receivePurchase, token]
  );

  const openPaymentModal = useCallback(
    async (row) => {
      if (!token || !row?.id) {
        return;
      }
      setPaymentLoadBusy(true);
      setPaymentFormError("");
      setPaymentDate(new Date());
      setPaymentAmount("");
      setPaymentMethod("Cash");
      setPaymentReference("");
      setPaymentNote("");
      setPaymentCount(0);
      setPaymentPurchase({
        id: String(row.id),
        reference: String(row.reference ?? ""),
        due: parseMoney(row.due)
      });
      try {
        const data = await listPurchasePaymentsRequest(token, row.id);
        const payments = Array.isArray(data?.payments) ? data.payments : [];
        setPaymentCount(payments.length);
      } catch {
        setPaymentCount(0);
      } finally {
        setPaymentLoadBusy(false);
      }
      showBsModal("record-payment");
    },
    [showBsModal, token]
  );

  const handleSubmitPayment = useCallback(
    async (e) => {
      e.preventDefault();
      if (!token || !paymentPurchase?.id) {
        return;
      }
      setPaymentFormError("");
      const amount = parseMoney(paymentAmount);
      if (amount <= 0) {
        setPaymentFormError("Enter a payment amount greater than 0.");
        return;
      }
      if (amount - parseMoney(paymentPurchase.due) > 0.0001) {
        setPaymentFormError("Payment amount cannot exceed due amount.");
        return;
      }
      setPaymentBusy(true);
      try {
        const paidAtStr =
          paymentDate instanceof Date
            ? paymentDate.toISOString().slice(0, 10)
            : String(paymentDate ?? "").slice(0, 10);
        const data = await createPurchasePaymentRequest(token, paymentPurchase.id, {
          amount,
          paid_at: paidAtStr || new Date().toISOString().slice(0, 10),
          method: paymentMethod.trim() || "Cash",
          reference: paymentReference.trim() || null,
          note: paymentNote.trim() || null
        });
        const updatedPurchase = data?.purchase ?? null;
        if (updatedPurchase?.id != null) {
          setListData((prev) =>
            prev.map((row) =>
              String(row.id) === String(updatedPurchase.id) ? mapApiPurchaseToRow(updatedPurchase) : row
            )
          );
        } else {
          await loadApiPurchases();
        }
        setPaymentCount((c) => c + 1);
        hideBsModal("record-payment");
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setPaymentFormError(err.message);
        } else {
          setPaymentFormError("Could not record payment.");
        }
      } finally {
        setPaymentBusy(false);
      }
    },
    [
      hideBsModal,
      loadApiPurchases,
      paymentAmount,
      paymentDate,
      paymentMethod,
      paymentNote,
      paymentPurchase,
      paymentReference,
      token
    ]
  );

  const handleSendToSupplier = useCallback(
    async (row, payload = null) => {
      if (!token || !row?.id) {
        return false;
      }
      setSendOrderBusyId(String(row.id));
      try {
        const data = await sendPurchaseToSupplierRequest(token, row.id, payload || undefined);
        const updated = data?.purchase ?? data;
        if (updated?.id != null) {
          setListData((prev) =>
            prev.map((r) => (String(r.id) === String(updated.id) ? mapApiPurchaseToRow(updated) : r))
          );
        } else {
          await loadApiPurchases();
        }
        return true;
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          window.alert(err.message);
        } else {
          window.alert("Could not send purchase email.");
        }
        return false;
      } finally {
        setSendOrderBusyId("");
      }
    },
    [loadApiPurchases, token]
  );

  const supplierEmailById = useMemo(() => {
    const map = new Map();
    apiSuppliers.forEach((supplier) => {
      if (supplier?.id == null) {
        return;
      }
      const email = String(supplier.email ?? "").trim();
      if (email) {
        map.set(String(supplier.id), email);
      }
    });
    return map;
  }, [apiSuppliers]);

  const openSendPreviewModal = useCallback(
    (row) => {
      if (!row?.id) {
        return;
      }
      const defaultTo = (() => {
        const byId = supplierEmailById.get(String(row.supplierId ?? ""));
        if (byId) return byId;
        const byName = apiSuppliers.find(
          (supplier) =>
            String(supplier?.name ?? "").trim().toLowerCase() ===
            String(row.supplierName ?? "").trim().toLowerCase()
        );
        return String(byName?.email ?? "").trim();
      })();
      setSendPreviewPurchase(row);
      setSendPreviewTo(defaultTo);
      setSendPreviewCc("");
      setSendPreviewSubject(`Purchase ${row.reference || ""}`.trim());
      setSendPreviewMessage(
        `Hello ${row.supplierName || "Supplier"},\n\nPlease find our purchase ${row.reference || "—"} dated ${row.date || "—"}.\n\nTotal amount: ${row.total || "KES 0.00"}.\n\nThank you.`
      );
      setSendPreviewError("");
      showBsModal("send-purchase-preview");
    },
    [apiSuppliers, supplierEmailById]
  );

  const closeSendPreviewModal = useCallback(() => {
    hideBsModal("send-purchase-preview");
    setSendPreviewPurchase(null);
    setSendPreviewTo("");
    setSendPreviewCc("");
    setSendPreviewSubject("");
    setSendPreviewMessage("");
    setSendPreviewError("");
  }, []);

  const handleConfirmSendToSupplier = useCallback(async () => {
    if (!sendPreviewPurchase) {
      return;
    }
    const to = String(sendPreviewTo || "").trim();
    if (!isValidEmail(to)) {
      setSendPreviewError("Enter a valid recipient email address.");
      return;
    }
    const ccRaw = String(sendPreviewCc || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (ccRaw.some((value) => !isValidEmail(value))) {
      setSendPreviewError("One or more CC email addresses are invalid.");
      return;
    }
    const payload = {
      to,
      cc: ccRaw,
      subject: String(sendPreviewSubject || "").trim(),
      message: String(sendPreviewMessage || "").trim()
    };
    const ok = await handleSendToSupplier(sendPreviewPurchase, payload);
    if (ok) {
      closeSendPreviewModal();
    }
  }, [
    closeSendPreviewModal,
    handleSendToSupplier,
    sendPreviewCc,
    sendPreviewMessage,
    sendPreviewPurchase,
    sendPreviewSubject,
    sendPreviewTo
  ]);

  const openViewPurchaseModal = useCallback(
    async (row) => {
      if (!token || !row?.id) {
        return;
      }
      setViewBusy(true);
      setViewError("");
      setViewPurchase(null);
      setViewPaymentThread([]);
      setViewPaymentThreadBusy(true);
      try {
        const data = await getPurchaseRequest(token, row.id);
        const purchase = data?.purchase ?? data;
        setViewPurchase(purchase ?? null);
        try {
          const pData = await listPurchasePaymentsRequest(token, row.id);
          const payments = Array.isArray(pData?.payments) ? pData.payments : [];
          setViewPaymentThread(payments);
        } catch {
          setViewPaymentThread([]);
        } finally {
          setViewPaymentThreadBusy(false);
        }
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setViewError(err.message);
        } else {
          setViewError("Could not load purchase details.");
        }
        setViewPaymentThreadBusy(false);
      } finally {
        setViewBusy(false);
      }
      showBsModal("view-purchase");
    },
    [showBsModal, token]
  );

  const handleEditFromViewPurchase = useCallback(() => {
    if (!viewPurchase?.id) {
      return;
    }
    hideBsModal("view-purchase");
    if (inTillflowShell && isApiNumericId(viewPurchase.id)) {
      navigate(`${TILLFLOW_PURCHASES_BASE}/${viewPurchase.id}/edit`);
    }
  }, [hideBsModal, inTillflowShell, navigate, viewPurchase]);

  const handlePrintViewPurchase = useCallback(() => {
    const root = viewPurchasePrintRootRef.current;
    if (!root) {
      return;
    }
    const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!w) {
      return;
    }
    w.document.write(
      `<html><head><title>Purchase Details</title></head><body>${root.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }, []);

  const handleDownloadViewPurchase = useCallback(() => {
    const root = viewPurchasePrintRootRef.current;
    if (!root || !viewPurchase) {
      return;
    }
    const ref = String(viewPurchase.reference ?? `purchase-${viewPurchase.id}`);
    void downloadQuotationDetailPdfFromElement(root, { quoteRef: ref });
  }, [viewPurchase]);

  const handleAddPurchaseSubmit = async (e) => {
    e.preventDefault();
    setAddPurchaseFormError("");
    const supplierLabel =
      supplierOptions.find((o) => o.value === addSupplier)?.label ?? "";
    if (!addSupplier) {
      setAddPurchaseFormError("Please select a supplier.");
      return;
    }
    const nextRef = addReference.trim() || nextPurchaseRefLocal(listData);
    if (!addPurchaseStatus) {
      setAddPurchaseFormError("Please select a status.");
      return;
    }
    if (
      !purchaseEditPageActive &&
      normalizePurchaseType(addPurchaseType) === "stock" &&
      addPurchaseStatus === "received"
    ) {
      setAddPurchaseFormError(
        "Stock purchases must be received through the Receive action so inventory remains auditable."
      );
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
          reference: nextRef,
          purchase_date: purchaseDateStr || new Date().toISOString().slice(0, 10),
          purchase_type: normalizePurchaseType(addPurchaseType),
          status: statusLabel,
          order_tax: 0,
          order_discount: 0,
          shipping: 0,
          description: addDescription.trim() || null,
          lines: filledLines.map((line) => {
            const pid = String(line.productId ?? "").trim();
            return {
              product_id: pid ? Number(pid) : null,
              product_name: String(line.productName).trim() || null,
              qty: parseMoney(line.qty),
              unit_price: parseMoney(line.price),
              discount: 0,
              tax_percent: parseMoney(line.taxPct)
            };
          })
        };
        if (purchaseEditPageActive && purchaseEditId) {
          const data = await updatePurchaseRequest(token, purchaseEditId, body);
          const updated = data?.purchase ?? data;
          if (!updated?.id) {
            setAddPurchaseFormError("Unexpected response from server.");
            return;
          }
          setListData((prev) =>
            prev.map((row) =>
              String(row.id) === String(updated.id) ? mapApiPurchaseToRow(updated) : row
            )
          );
        } else {
          const data = await createPurchaseRequest(token, body);
          if (!data?.purchase) {
            setAddPurchaseFormError("Unexpected response from server.");
            return;
          }
          setListData((prev) => [mapApiPurchaseToRow(data.purchase), ...prev]);
        }
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setAddPurchaseFormError(err.message);
        } else {
          setAddPurchaseFormError(
            purchaseEditPageActive ? "Could not update purchase." : "Could not create purchase."
          );
        }
        return;
      }
    } else {
      const linesTotal = filledLines.reduce((sum, line) => sum + lineAmounts(line).total, 0);
      const grand = Math.max(0, linesTotal);
      const totalStr = `KES ${grand.toFixed(2)}`;

      const newRow = {
        id: newPurchaseRowId(),
        supplierName: supplierLabel || addSupplier,
          reference: nextRef,
        date: formatPurchaseTableDate(addPurchaseDate),
        status: statusLabel,
        purchaseType: normalizePurchaseType(addPurchaseType),
        orderedQty: filledLines.reduce((sum, line) => sum + parseMoney(line.qty), 0),
        receivedQty: 0,
        remainingQty: filledLines.reduce((sum, line) => sum + parseMoney(line.qty), 0),
        total: totalStr,
        paid: "KES 0.00",
        due: totalStr,
        paymentStatus: "Unpaid"
      };

      setListData((prev) => [newRow, ...prev]);
    }

    resetAddPurchaseForm();
    if (purchaseCreatePageActive || purchaseEditPageActive) {
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
          <div
            className={`mt-1${
              purchaseCreatePageActive || purchaseEditPageActive ? "" : " modal-body-table"
            }`}>
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
                    <th className="bg-secondary-transparent p-3">Purchase Price (KES)</th>
                    <th className="bg-secondary-transparent p-3">Tax (%)</th>
                    <th className="bg-secondary-transparent p-3">Tax Amount (KES)</th>
                    <th className="bg-secondary-transparent p-3">Unit Cost (KES)</th>
                    <th className="bg-secondary-transparent p-3">Line Total (KES)</th>
                    <th className="bg-secondary-transparent p-3 text-end w-1px">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addLineItems.map((line, lineIndex) => {
                    const qty = parseMoney(line.qty);
                    const price = parseMoney(line.price);
                    const taxPct = parseMoney(line.taxPct);
                    const sub = Math.max(0, qty * price);
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
                            type="number"
                            className="form-control form-control-sm"
                            value={line.qty}
                            onChange={(e) => updateAddLine(line.id, "qty", e.target.value)}
                            min="0"
                            step="any"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={line.price}
                            onChange={(e) => updateAddLine(line.id, "price", e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="any"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={line.taxPct}
                            onChange={(e) => updateAddLine(line.id, "taxPct", e.target.value)}
                            min="0"
                            step="any"
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
        <div className="col-12">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-3">
              <div className="d-flex flex-wrap justify-content-between gap-3">
                <div className="small text-muted">
                  {purchaseFormSummary.lineCount} line(s)
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <div className="small">
                    <span className="text-muted me-1">Sub Total:</span>
                    <strong>KES {purchaseFormSummary.subtotalExTax.toFixed(2)}</strong>
                  </div>
                  <div className="small">
                    <span className="text-muted me-1">Tax:</span>
                    <strong>KES {purchaseFormSummary.taxTotal.toFixed(2)}</strong>
                  </div>
                  <div className="small">
                    <span className="text-muted me-1">Grand Total:</span>
                    <strong>KES {purchaseFormSummary.grandTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 col-sm-12">
          <div className="mb-3">
            <label className="form-label">
              Purchase Type<span className="text-danger ms-1">*</span>
            </label>
            <CommonSelect
              className="w-100"
              options={purchaseTypeOptions}
              value={addPurchaseType}
              onChange={(e) => setAddPurchaseType(normalizePurchaseType(e.value))}
              placeholder="Select purchase type"
              filter={false}
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
  {
    header: "Reference",
    field: "reference",
    key: "reference",
    body: (row) => (
      <Link
        to="#"
        style={{ color: "#0d6efd" }}
        onClick={(e) => {
          e.preventDefault();
          void openViewPurchaseModal(row);
        }}>
        {row.reference || "—"}
      </Link>
    )
  },
  { header: "Date", field: "date", key: "date" },
  {
    header: "Type",
    field: "purchaseType",
    key: "purchaseType",
    body: (data) => (
      <span
        className={`badge purchase-type-badge ${
          normalizePurchaseType(data.purchaseType) === "expense"
            ? "bg-secondary"
            : "purchase-type-badge--stock text-white"
        }`}>
        {purchaseTypeLabel(data.purchaseType)}
      </span>
    )
  },
  {
    header: "Status",
    field: "status",
    key: "status",
    body: (data) =>
    <span
      className={`badges status-badge fs-10 p-1 px-2 rounded-1 ${
      data.status === "Draft" ?
      "bg-secondary text-white" :
      data.status === "Pending" ?
      "badge-pending" :
      data.status === "Ordered" ?
      "bg-warning" :
      data.status === "Partial" ?
      "text-primary bg-primary-transparent" :
      data.status === "Received" ?
      "text-success bg-success-transparent" :
      data.status === "Return" ?
      "text-danger bg-danger-transparent" :
      ""}`
      }>
      
          {data.status}
        </span>

  },
  { header: "Total", field: "total", key: "total" },
  { header: "Paid", field: "paid", key: "paid" },
  { header: "Due", field: "due", key: "due" },
  {
    header: "Ordered",
    field: "orderedQty",
    key: "orderedQty",
    body: (data) => {
      if (normalizePurchaseType(data.purchaseType) !== "stock") {
        return <span className="text-muted">N/A</span>;
      }
      return <span>{parseMoney(data.orderedQty).toFixed(2)}</span>;
    }
  },
  {
    header: "Remaining",
    field: "remainingQty",
    key: "remainingQty",
    body: (data) => {
      if (normalizePurchaseType(data.purchaseType) !== "stock") {
        return <span className="text-muted">N/A</span>;
      }
      return <span>{parseMoney(data.remainingQty).toFixed(2)}</span>;
    }
  },
  {
    header: "Payment",
    field: "paymentStatus",
    key: "paymentStatus",
    body: (data) =>
    <span
      className={`p-1 pe-2 rounded-1 fs-10 ${
      data.paymentStatus === "Paid" ?
      "text-success bg-success-transparent" :
      data.paymentStatus === "Refunded" ?
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
          <div className="dropdown">
            <button
              type="button"
              className="btn btn-sm btn-light p-1 d-inline-flex align-items-center justify-content-center"
              data-bs-toggle="dropdown"
              data-bs-popper-config={JSON.stringify({ strategy: "fixed" })}
              aria-expanded="false"
              title="Actions">
              <MoreVertical size={16} />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    void openViewPurchaseModal(row);
                  }}>
                  <i className="feather icon-eye me-2" />
                  View
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    if (inTillflowShell && isApiNumericId(row.id)) {
                      navigate(`${TILLFLOW_PURCHASES_BASE}/${row.id}/edit`);
                      return;
                    }
                    const el = document.getElementById("edit-purchase");
                    if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
                      const inst =
                        window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
                      inst.show();
                    }
                  }}>
                  <i className="feather icon-edit me-2" />
                  Edit
                </button>
              </li>
              {token ? (
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    disabled={sendOrderBusyId === String(row.id)}
                    onClick={() => {
                      if (sendOrderBusyId === String(row.id)) return;
                      openSendPreviewModal(row);
                    }}>
                    <i className={`feather me-2 ${sendOrderBusyId === String(row.id) ? "icon-loader" : "icon-mail"}`} />
                    {sendOrderBusyId === String(row.id) ? "Sending..." : "Send to supplier"}
                  </button>
                </li>
              ) : null}
              {token ? (
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      void openPaymentModal(row);
                    }}>
                    <i className="feather icon-credit-card me-2" />
                    Record payment
                  </button>
                </li>
              ) : null}
              {token && normalizePurchaseType(row.purchaseType) === "stock" ? (
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      void openReceiveModal(row);
                    }}>
                    <i className="feather icon-download me-2" />
                    Receive stock
                  </button>
                </li>
              ) : null}
              {token ? (
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      const pid = encodeURIComponent(String(row.id ?? ""));
                      navigate(`${TILLFLOW_PURCHASE_RETURNS_BASE}?purchaseId=${pid}`);
                    }}>
                    <i className="feather icon-corner-up-left me-2" />
                    Return to Supplier
                  </button>
                </li>
              ) : null}
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button
                  type="button"
                  className="dropdown-item text-danger"
                  data-bs-toggle="modal"
                  data-bs-target="#delete-modal"
                  onClick={() => {
                    pendingDeletePurchaseIdRef.current = row.id;
                  }}>
                  <i className="feather icon-trash-2 me-2" />
                  Delete
                </button>
              </li>
            </ul>
          </div>
        </div>

  }];

  const handleSearch = (value) => {
    setSearchQuery(typeof value === "string" ? value : "");
  };

  const handleExportPdf = useCallback(async () => {
    try {
      await downloadPurchasesPdf(filteredPurchases);
    } catch {
      setPurchasesError("Could not export PDF. Please try again.");
    }
  }, [filteredPurchases]);

  const handleExportExcel = useCallback(async () => {
    try {
      await downloadPurchasesExcel(filteredPurchases);
    } catch {
      setPurchasesError("Could not export Excel. Please try again.");
    }
  }, [filteredPurchases]);

  return (
    <>
      <div
        className={`page-wrapper purchase-list-page${
          purchaseCreatePageActive || purchaseEditPageActive
            ? " purchase-list-page--create"
            : ""
        }`}>
        <div className="content">
          {purchaseCreatePageActive || purchaseEditPageActive ? (
            <form
              className="quotation-form-sheet quotation-form-sheet--crm px-3 px-lg-4 pb-4"
              noValidate
              onSubmit={handleAddPurchaseSubmit}>
              <div className="page-header border-0 pb-2 quotation-crm-header">
                <div className="d-flex flex-wrap align-items-start gap-3 justify-content-between w-100">
                  <div className="page-title mb-0 min-w-0 flex-grow-1 pe-2">
                    <h4 className="mb-0">
                      {purchaseEditPageActive ? "Edit purchase" : "Create purchase"}
                    </h4>
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
              {editPurchaseLoading ? (
                <p className="text-muted mb-3">Loading purchase…</p>
              ) : (
                addPurchaseFormBody
              )}
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-3 pt-3 border-top border-secondary-subtle">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={leavePurchaseCreateForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {purchaseEditPageActive ? "Save changes" : "Add purchase"}
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
                  onExportPdf={handleExportPdf}
                  onExportExcel={handleExportExcel}
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
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${
                              paymentStatusFilter === "Refunded" ? " active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              setPaymentStatusFilter("Refunded");
                            }}>
                            Refunded
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                        data-bs-toggle="dropdown">
                        {statusFilter ? `Status: ${statusFilter}` : "Status"}
                      </Link>
                      <ul className="dropdown-menu dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${statusFilter === "" ? " active" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setStatusFilter("");
                            }}>
                            All
                          </Link>
                        </li>
                        {["Draft", "Ordered", "Pending", "Partial", "Received"].map((status) => (
                          <li key={status}>
                            <Link
                              to="#"
                              className={`dropdown-item rounded-1${statusFilter === status ? " active" : ""}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setStatusFilter(status);
                              }}>
                              {status}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                        data-bs-toggle="dropdown">
                        {typeFilter ? `Type: ${purchaseTypeLabel(typeFilter)}` : "Type"}
                      </Link>
                      <ul className="dropdown-menu dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${typeFilter === "" ? " active" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setTypeFilter("");
                            }}>
                            All
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${typeFilter === "stock" ? " active" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setTypeFilter("stock");
                            }}>
                            Stock
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`dropdown-item rounded-1${typeFilter === "expense" ? " active" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setTypeFilter("expense");
                            }}>
                            Expense
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
                                Purchase Price (KES){" "}
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Discount (KES){" "}
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Tax %
                              </th>
                              <th className="bg-secondary-transparent p-3">
                                Tax Amount (KES)
                              </th>
                              <th className="text-end bg-secondary-transparent p-3">
                                Unit Cost (KES)
                              </th>
                              <th className="text-end bg-secondary-transparent p-3">
                                Total Cost (KES){" "}
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
                                    type="number"
                                    className="quntity-input"
                                    min="0"
                                    step="any"
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
                          <h5>KES 0.00</h5>
                        </li>
                        <li className="border-0 border-bottom">
                          <h4 className="border-0">Discount</h4>
                          <h5>KES 0.00</h5>
                        </li>
                        <li className="border-0 border-bottom">
                          <h4 className="border-0">Shipping</h4>
                          <h5>KES 0.00</h5>
                        </li>
                        <li className="total border-0">
                          <h4 className="border-0">Grand Total</h4>
                          <h5>KES 1800.00</h5>
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
      <div className="modal fade quotation-view-modal" id="view-purchase">
        <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header border-bottom align-items-center flex-wrap gap-2 quotation-view-no-print">
              <div className="add-item d-flex flex-grow-1">
                <div className="page-title mb-0">
                  <h4 className="mb-0">Purchase Details</h4>
                </div>
              </div>
              <ul className="table-top-head mb-0">
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Download"
                    onClick={handleDownloadViewPurchase}>
                    <i className="feather icon-download" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Print"
                    onClick={handlePrintViewPurchase}>
                    <i className="feather icon-printer feather-rotate-ccw" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Edit purchase"
                    onClick={handleEditFromViewPurchase}>
                    <i className="feather icon-edit" />
                  </button>
                </li>
              </ul>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {viewBusy ? <p className="text-muted mb-0">Loading purchase…</p> : null}
              {!viewBusy && viewError ? (
                <div className="alert alert-danger mb-0" role="alert">
                  {viewError}
                </div>
              ) : null}
              {!viewBusy && !viewError && viewPurchase ? (
                <div className="row g-3">
                  <div className="col-12 quotation-view-no-print d-flex flex-wrap gap-2">
                    <Link
                      to={TILLFLOW_PURCHASES_BASE}
                      className="btn btn-primary"
                      onClick={() => hideBsModal("view-purchase")}>
                      <i className="feather icon-arrow-left me-2" />
                      Back to Purchases
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleEditFromViewPurchase}>
                      <i className="feather icon-edit me-2" />
                      Edit purchase
                    </button>
                  </div>
                  <div className="col-12">
                    <div ref={viewPurchasePrintRootRef} className="card border shadow-sm quotation-view-print-root">
                      <div className="card-body">
                        <div className="row justify-content-between align-items-center border-bottom mb-3">
                          <div className="col-md-6">
                            <div className="mb-2 invoice-logo d-flex align-items-center">
                              <BreezeTechLogo className="tf-brand-logo tf-brand-logo--bar" />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="text-end mb-3">
                              <h5 className="text-gray mb-1">
                                Purchase No <span className="text-primary">{viewPurchase.reference || "—"}</span>
                              </h5>
                              <p className="mb-0 fw-medium">
                                Date : <span className="text-dark">{viewPurchase.purchase_date || "—"}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="row border-bottom mb-3">
                          <div className="col-md-3">
                            <p className="text-dark mb-2 fw-semibold">From</p>
                            <h4 className="mb-1">{companySnapshot.companyName || "Your business"}</h4>
                            <p className="mb-1 text-muted">{companySnapshot.location || "—"}</p>
                            <p className="mb-1">Email : <span className="text-dark">{companySnapshot.email || "—"}</span></p>
                            <p className="mb-0">Phone : <span className="text-dark">{companySnapshot.phone || "—"}</span></p>
                          </div>
                          <div className="col-md-3">
                            <p className="text-dark mb-2 fw-semibold">To</p>
                            <h4 className="mb-1">{viewPurchase.supplier_name || "Supplier"}</h4>
                            <p className="mb-1 text-muted">—</p>
                            <p className="mb-1">Email : <span className="text-dark">—</span></p>
                            <p className="mb-0">Phone : <span className="text-dark">—</span></p>
                          </div>
                          <div className="col-md-3">
                            <p className="text-dark mb-2 fw-semibold">Supplier details</p>
                            <p className="mb-1"><strong>Name:</strong> {viewPurchase.supplier_name || "—"}</p>
                            <p className="mb-1"><strong>Reference:</strong> {viewPurchase.reference || "—"}</p>
                            <p className="mb-1"><strong>Date:</strong> {viewPurchase.purchase_date || "—"}</p>
                            <p className="mb-0">
                              <strong>Type:</strong> {purchaseTypeLabel(viewPurchase.purchase_type)}
                            </p>
                          </div>
                          <div className="col-md-3">
                            <p className="text-dark mb-2 fw-semibold">Purchase status</p>
                            <p className="text-title mb-1 fw-medium">Status</p>
                            <span className="badge bg-info text-dark fs-10 px-2 py-1 rounded mb-2 d-inline-block">
                              {viewPurchase.status || "—"}
                            </span>
                            <p className="mb-1"><strong>Payment:</strong> {viewPurchase.payment_status || "—"}</p>
                            <p className="mb-1"><strong>Due:</strong> {formatMoneyDisplay(viewPurchase.due_amount)}</p>
                            <p className="mb-0">
                              <strong>Email status:</strong> {viewPurchase.last_sent_at ? "Sent" : "Not sent"}
                            </p>
                          </div>
                        </div>
                        <div className="row g-3">
                  <div className="col-12">
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Received</th>
                                <th>Remaining</th>
                                <th>Unit Price (KES)</th>
                                <th>Tax (%)</th>
                                <th>Line Total (KES)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(Array.isArray(viewPurchase.lines) ? viewPurchase.lines : []).map((line) => {
                                const qty = parseMoney(line.qty);
                                const rec = parseMoney(line.received_qty);
                                const unit = parseMoney(line.unit_price);
                                const taxPct = parseMoney(line.tax_percent);
                                const sub = Math.max(0, qty * unit);
                                const lineTotal = sub + sub * (taxPct / 100);
                                return (
                                  <tr key={line.id}>
                                    <td>{line.product_name || "—"}</td>
                                    <td>{qty.toFixed(2)}</td>
                                    <td>{rec.toFixed(2)}</td>
                                    <td>{Math.max(0, qty - rec).toFixed(2)}</td>
                                    <td>{unit.toFixed(2)}</td>
                                    <td>{taxPct.toFixed(2)}</td>
                                    <td>{lineTotal.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="quotation-crm-summary-bar card border-0 shadow-sm mb-0">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-end">
                          <div className="quotation-crm-summary-bar__figures">
                            <div className="quotation-crm-summary-bar__row quotation-crm-summary-bar__row--muted">
                              <span className="quotation-crm-summary-bar__label">Sub Total :</span>
                              <span className="quotation-crm-summary-bar__amount">
                                KES {viewPurchaseSummary.subtotalExTax.toFixed(2)}
                              </span>
                            </div>
                            <div className="quotation-crm-summary-bar__row quotation-crm-summary-bar__row--muted">
                              <span className="quotation-crm-summary-bar__label">Tax :</span>
                              <span className="quotation-crm-summary-bar__amount">
                                KES {viewPurchaseSummary.taxTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="quotation-crm-summary-bar__row quotation-crm-summary-bar__row--total">
                              <span className="quotation-crm-summary-bar__label">Total :</span>
                              <span className="quotation-crm-summary-bar__amount quotation-crm-summary-bar__amount--grand">
                                KES {viewPurchaseSummary.grandTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="quotation-crm-summary-bar__row quotation-crm-summary-bar__row--muted">
                              <span className="quotation-crm-summary-bar__label">Paid :</span>
                              <span className="quotation-crm-summary-bar__amount">
                                {formatMoneyDisplay(viewPurchase.paid_amount)}
                              </span>
                            </div>
                            <div className="quotation-crm-summary-bar__row quotation-crm-summary-bar__row--muted">
                              <span className="quotation-crm-summary-bar__label">Due :</span>
                              <span className="quotation-crm-summary-bar__amount">
                                {formatMoneyDisplay(viewPurchase.due_amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="card border-0 shadow-sm mb-0">
                      <div className="card-body">
                        <h6 className="mb-3">Payment & refund thread</h6>
                        {viewPaymentThreadBusy ? (
                          <p className="text-muted mb-0">Loading transactions…</p>
                        ) : viewPaymentThread.length === 0 ? (
                          <p className="text-muted mb-0">No payment/refund transactions yet.</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm mb-0">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Method</th>
                                  <th>Reference</th>
                                  <th>Amount (KES)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {viewPaymentThread.map((tx) => {
                                  const amt = parseMoney(tx?.amount);
                                  const isRefund = amt < 0 || String(tx?.method || "").toLowerCase() === "refund";
                                  return (
                                    <tr key={String(tx?.id)}>
                                      <td>{tx?.paid_at || "—"}</td>
                                      <td>
                                        <span className={`badge ${isRefund ? "bg-danger-transparent text-danger" : "bg-success-transparent text-success"}`}>
                                          {isRefund ? "Refund" : "Payment"}
                                        </span>
                                      </td>
                                      <td>{tx?.method || "—"}</td>
                                      <td>{tx?.reference || "—"}</td>
                                      <td>{`${isRefund ? "-" : ""}KES ${Math.abs(amt).toFixed(2)}`}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="send-purchase-preview">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Email preview</h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={closeSendPreviewModal}
              />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label mb-1">To</label>
                <input
                  type="email"
                  className="form-control"
                  value={sendPreviewTo}
                  onChange={(e) => setSendPreviewTo(e.target.value)}
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="mb-2">
                <label className="form-label mb-1">Subject</label>
                <input
                  type="text"
                  className="form-control"
                  value={sendPreviewSubject}
                  onChange={(e) => setSendPreviewSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div className="mb-2">
                <label className="form-label mb-1">CC (comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  value={sendPreviewCc}
                  onChange={(e) => setSendPreviewCc(e.target.value)}
                  placeholder="manager@example.com, accounts@example.com"
                />
              </div>
              <div className="mb-0">
                <label className="form-label mb-1">Message</label>
                <textarea
                  className="form-control"
                  rows={7}
                  value={sendPreviewMessage}
                  onChange={(e) => setSendPreviewMessage(e.target.value)}
                  placeholder="Type the email message"
                />
              </div>
              {sendPreviewError ? <p className="text-danger small mt-2 mb-0">{sendPreviewError}</p> : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light me-2"
                onClick={closeSendPreviewModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={sendOrderBusyId === String(sendPreviewPurchase?.id ?? "")}
                onClick={() => {
                  void handleConfirmSendToSupplier();
                }}>
                {sendOrderBusyId === String(sendPreviewPurchase?.id ?? "") ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="record-payment">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Record Payment</h4>
                {paymentPurchase?.reference ? (
                  <p className="mb-0 small text-muted">
                    Reference: {paymentPurchase.reference}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleSubmitPayment}>
              <div className="modal-body">
                {paymentLoadBusy ? <p className="text-muted mb-2">Loading payment data…</p> : null}
                {paymentFormError ? (
                  <div className="alert alert-danger mb-3" role="alert">
                    {paymentFormError}
                  </div>
                ) : null}
                <div className="mb-2 small text-muted">
                  Previous payments: {paymentCount}
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Payment date<span className="text-danger ms-1">*</span>
                  </label>
                  <div className="input-groupicon calender-input">
                    <i className="feather icon-calendar info-img" />
                    <CommonDatePicker
                      appendTo={"self"}
                      value={paymentDate}
                      onChange={setPaymentDate}
                      className="w-100"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Amount (KES)<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0"
                    step="any"
                    placeholder="0"
                  />
                  <p className="small text-muted mb-0 mt-1">
                    Due: KES {parseMoney(paymentPurchase?.due).toFixed(2)}
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label">Method</label>
                  <input
                    type="text"
                    className="form-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Cash"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Reference</label>
                  <input
                    type="text"
                    className="form-control"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Note</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal"
                  disabled={paymentBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={paymentBusy}>
                  {paymentBusy ? "Saving..." : "Record payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal fade" id="receive-purchase">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Receive Stock</h4>
                {receivePurchase?.reference ? (
                  <p className="mb-0 small text-muted">Reference: {receivePurchase.reference}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleSubmitReceive}>
              <div className="modal-body">
                {receiveLoadBusy ? <p className="text-muted mb-2">Loading purchase lines…</p> : null}
                {receiveFormError ? (
                  <div className="alert alert-danger mb-3" role="alert">
                    {receiveFormError}
                  </div>
                ) : null}
                <div className="row">
                  <div className="col-lg-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Received date<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="input-groupicon calender-input">
                        <i className="feather icon-calendar info-img" />
                        <CommonDatePicker
                          appendTo={"self"}
                          value={receiveDate}
                          onChange={setReceiveDate}
                          className="w-100"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12">
                    <div className="mb-3">
                      <label className="form-label">Receipt history</label>
                      <p className="form-control-plaintext mb-0">
                        {receiptCount > 0 ? `${receiptCount} receipt(s) posted` : "No receipts yet"}
                      </p>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Ordered</th>
                            <th>Already received</th>
                            <th>Remaining</th>
                            <th>Receive now</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiveLines.map((line) => (
                            <tr key={line.id}>
                              <td>{line.label}</td>
                              <td>{line.orderedQty.toFixed(2)}</td>
                              <td>{line.alreadyReceived.toFixed(2)}</td>
                              <td>{line.remainingQty.toFixed(2)}</td>
                              <td style={{ minWidth: 140 }}>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={line.receiveNow}
                                  onChange={(e) => updateReceiveLineQty(line.id, e.target.value)}
                                  placeholder="0"
                                  min="0"
                                  step="any"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="mb-0">
                      <label className="form-label">Receipt note</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={receiveNote}
                        onChange={(e) => setReceiveNote(e.target.value)}
                        placeholder="Optional receiving note"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal"
                  disabled={receiveBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={receiveBusy}>
                  {receiveBusy ? "Saving..." : "Post receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
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