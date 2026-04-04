import { ChevronLeft, Edit2, Eye, Move, Plus, PlusCircle, Trash2, X } from "react-feather";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import { AutoComplete } from "primereact/autocomplete";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PrimeDataTable from "../../components/data-table";
import { quotationlistdata } from "../../core/json/quotationlistdata";
import { all_routes } from "../../routes/all_routes";
import { Link, useLocation } from "react-router-dom";
import {
  createQuotationRequest,
  deleteQuotationRequest,
  listQuotationsRequest,
  updateQuotationRequest
} from "../../tillflow/api/quotations";
import { TILLFLOW_API_BASE_URL } from "../../tillflow/config";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { Modal } from "bootstrap";
import { downloadQuotationsExcel, downloadQuotationsPdf } from "../../utils/quotationExport";
import { stockImg01, user33 } from "../../utils/imagepath";
import { listCustomersRequest } from "../../tillflow/api/customers";
import { listSalesCatalogProductsRequest } from "../../tillflow/api/products";

const ALL = { label: "All", value: "" };
const PICK_PLACEHOLDER = { label: "Select…", value: "" };

/** Line items table: drag, product, description, qty, unit, tax, amount, actions */
const QUOTE_LINE_ITEMS_COL_WIDTHS_DEFAULT = [40, 220, 200, 110, 100, 88, 130, 96];

const STORAGE_KEY = "retailpos_quotations_v1";
/** Same key as TillFlow `AuthContext` — legacy `/quotation-list` has no AuthProvider, so read token here. */
const TILLFLOW_SESSION_TOKEN_KEY = "tillflow_sanctum_token";

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return String(n ?? "");
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
}

function cleanupStaleModalUi() {
  if (document.querySelector(".modal.show")) {
    return;
  }
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.querySelectorAll(".modal-backdrop").forEach((node) => node.remove());
}

function hideBsModal(id) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  const inst = Modal.getInstance(el) ?? Modal.getOrCreateInstance(el);
  const onHidden = () => {
    cleanupStaleModalUi();
  };
  el.addEventListener("hidden.bs.modal", onHidden, { once: true });
  inst.hide();
  window.setTimeout(cleanupStaleModalUi, 450);
}

function loadStoredQuotations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getInitialQuotationRows() {
  try {
    if (typeof window !== "undefined" && window.location.pathname.includes("/tillflow/admin")) {
      return [];
    }
  } catch {
    /* ignore */
  }
  const stored = loadStoredQuotations();
  if (stored) {
    return stored;
  }
  return quotationlistdata.map((r) => {
    const d = new Date(r.quotedDate);
    const quotedAtIso = Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    const up = parseMoneyish(r.Total);
    return {
      ...r,
      apiId: null,
      quotedAtIso,
      product_id: null,
      customer_id: null,
      product_image_url: null,
      customer_image_url: null,
      items: [
        {
          key: `seed-${r.id}`,
          productName: r.Product_Name,
          quantity: "1",
          unitPrice: String(up),
          productImg: r.productImg,
          line_total: up
        }
      ],
      productsExportLabel: r.Product_Name
    };
  });
}

function resolveMediaUrl(url, fallback) {
  if (!url) {
    return fallback;
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  try {
    const origin = new URL(TILLFLOW_API_BASE_URL).origin;
    return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
  } catch {
    return url;
  }
}

function formatQuotedDisplay(isoDate) {
  if (!isoDate) {
    return "";
  }
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return String(isoDate);
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isoDateOnly(v) {
  if (v == null || v === "") {
    return null;
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function apiQuotationToRow(q) {
  const items = normalizeApiItemsForRow(q.items);
  const { label, imgSrc, exportLabel } = productSummaryFromItems(items, resolveMediaUrl);
  return {
    id: String(q.id),
    apiId: q.id,
    quoteRef: q.quote_ref,
    quotedDate: formatQuotedDisplay(q.quoted_at),
    quotedAtIso: q.quoted_at,
    expiresAtIso: isoDateOnly(q.expires_at),
    customer_id: q.customer_id ?? null,
    customer_image_url: q.customer_image_url ?? null,
    productImg: imgSrc,
    Product_Name: label,
    productsExportLabel: exportLabel,
    items,
    customerImg: resolveMediaUrl(q.customer_image_url, user33),
    Custmer_Name: q.customer_name,
    Status: q.status,
    Total: Number(q.total_amount),
    clientNote: q.client_note ?? "",
    termsAndConditions: q.terms_and_conditions ?? ""
  };
}

function parseRowDate(row) {
  if (row == null) {
    return null;
  }
  if (row.quotedAtIso) {
    const d = new Date(`${row.quotedAtIso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = row.quotedDate;
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nextQuoteRefLocal(list) {
  let max = 0;
  for (const r of list) {
    const m = /^QT-(\d+)$/i.exec(String(r.quoteRef ?? ""));
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `QT-${String(max + 1).padStart(3, "0")}`;
}

function newLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyApiLine() {
  return {
    key: newLineKey(),
    productId: "",
    quantity: "1",
    unitPrice: "",
    taxPercent: "0",
    isCustom: false,
    customLabel: "",
    description: ""
  };
}

function emptyLocalLine() {
  return {
    key: newLineKey(),
    productName: "",
    quantity: "1",
    unitPrice: "",
    taxPercent: "0",
    productImg: stockImg01,
    description: ""
  };
}

function parseMoneyish(s) {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** @param {Array<{ product_name?: string, product_id?: number|null, product_image_url?: string|null, description?: string|null, quantity?: string|number, unit_price?: string|number, tax_percent?: string|number, line_total?: string|number }>} rawItems */
function normalizeApiItemsForRow(rawItems) {
  const list = Array.isArray(rawItems) ? rawItems : [];
  return list.map((it, idx) => ({
    key: it.id != null ? `api-item-${it.id}` : `api-idx-${idx}`,
    product_id: it.product_id ?? null,
    product_name: it.product_name ?? "",
    product_image_url: it.product_image_url ?? null,
    description: it.description != null ? String(it.description) : "",
    quantity: String(it.quantity ?? 1),
    unit_price: String(it.unit_price ?? 0),
    tax_percent:
      it.tax_percent != null && String(it.tax_percent) !== "" ? String(it.tax_percent) : "0",
    line_total: Number(it.line_total ?? 0)
  }));
}

function productSummaryFromItems(items, resolveImg) {
  const arr = Array.isArray(items) ? items : [];
  const names = arr.map((i) => i.product_name || i.productName).filter(Boolean);
  const label =
    names.length === 0 ? "—" : names.length === 1 ? names[0] : `${names[0]} (+${names.length - 1} more)`;
  const first = arr[0];
  const imgSrc = first
    ? resolveImg(first.product_image_url ?? first.productImg, stockImg01)
    : stockImg01;
  const exportLabel = names.join("; ");
  return { label, imgSrc, exportLabel, lineCount: arr.length };
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseTaxPercentFromLine(line) {
  const t = parseFloat(String(line.taxPercent ?? line.tax_percent ?? "0").replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(t) || t < 0) {
    return 0;
  }
  return Math.min(t, 100);
}

/** Subtotal before tax: qty × unit (unit from catalog default when applicable). */
function lineSubtotalExTax(line, catalogProducts, useCatalogDefaultUnitPrice) {
  const q = parseFloat(String(line.quantity).replace(/[^0-9.-]/g, ""));
  const qty = Number.isNaN(q) || q < 0 ? 0 : q;
  let unit = parseFloat(String(line.unitPrice).replace(/[^0-9.-]/g, ""));
  if (line.isCustom) {
    if (Number.isNaN(unit) || unit < 0) {
      unit = 0;
    }
    return roundMoney(qty * unit);
  }
  if (useCatalogDefaultUnitPrice && line.productId != null && line.productId !== "") {
    if (Number.isNaN(unit) || String(line.unitPrice).trim() === "") {
      const p = catalogProducts.find((x) => String(x.id) === String(line.productId));
      if (p?.selling_price != null) {
        unit = Number(p.selling_price);
      }
    }
  }
  if (Number.isNaN(unit) || unit < 0) {
    unit = 0;
  }
  return roundMoney(qty * unit);
}

/** Amount including line tax (%). */
function displayLineAmount(line, catalogProducts, useCatalogDefaultUnitPrice) {
  const subtotal = lineSubtotalExTax(line, catalogProducts, useCatalogDefaultUnitPrice);
  const pct = parseTaxPercentFromLine(line);
  return roundMoney(subtotal * (1 + pct / 100));
}

const QuotationList = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");

  const auth = useOptionalAuth();
  const tokenFromSession =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(TILLFLOW_SESSION_TOKEN_KEY)
      : null;
  const token = auth?.token ?? tokenFromSession ?? null;

  const [quotations, setQuotations] = useState(getInitialQuotationRows);
  const [listLoading, setListLoading] = useState(() => Boolean(token));
  const [listError, setListError] = useState("");
  const listLoadGenRef = useRef(0);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCustomers, setCatalogCustomers] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const catalogLoadGenRef = useRef(0);

  const loadCatalog = useCallback(async () => {
    if (!token) {
      return;
    }
    const gen = ++catalogLoadGenRef.current;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const [prodData, custData] = await Promise.all([
        listSalesCatalogProductsRequest(token),
        listCustomersRequest(token)
      ]);
      if (gen !== catalogLoadGenRef.current) {
        return;
      }
      setCatalogProducts(prodData.products ?? []);
      setCatalogCustomers(custData.customers ?? []);
    } catch (e) {
      if (gen !== catalogLoadGenRef.current) {
        return;
      }
      setCatalogProducts([]);
      setCatalogCustomers([]);
      if (e instanceof TillFlowApiError) {
        setCatalogError(
          e.status === 403
            ? `${e.message} (needs sales.manage for customers / catalog)`
            : e.message
        );
      } else {
        setCatalogError("Could not load products or customers for quotations.");
      }
    } finally {
      if (gen === catalogLoadGenRef.current) {
        setCatalogLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadCatalog();
  }, [token, loadCatalog]);

  const loadQuotations = useCallback(async () => {
    if (!token) {
      return;
    }
    const gen = ++listLoadGenRef.current;
    setListLoading(true);
    setListError("");
    try {
      const data = await listQuotationsRequest(token);
      if (gen !== listLoadGenRef.current) {
        return;
      }
      setQuotations((data.quotations ?? []).map(apiQuotationToRow));
    } catch (e) {
      if (gen !== listLoadGenRef.current) {
        return;
      }
      setQuotations([]);
      if (e instanceof TillFlowApiError) {
        setListError(
          e.status === 403 ? `${e.message} (needs sales.manage)` : e.message
        );
      } else {
        setListError("Failed to load quotations.");
      }
    } finally {
      if (gen === listLoadGenRef.current) {
        setListLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadQuotations();
  }, [token, loadQuotations]);

  useEffect(() => {
    if (inTillflowShell) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quotations));
    } catch {
      /* ignore quota */
    }
  }, [quotations, inTillflowShell]);

  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedQuotations, setSelectedQuotations] = useState([]);

  const [addQuotedAt, setAddQuotedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [addExpiresAt, setAddExpiresAt] = useState("");
  const [addCustomerId, setAddCustomerId] = useState("");
  const [addLines, setAddLines] = useState([emptyApiLine()]);
  const [addCustomerName, setAddCustomerName] = useState("");
  const [addStatus, setAddStatus] = useState("Pending");
  const [addProductImgUrl, setAddProductImgUrl] = useState("");
  const [addCustomerImgUrl, setAddCustomerImgUrl] = useState("");
  const [addClientNote, setAddClientNote] = useState("");
  const [addTermsAndConditions, setAddTermsAndConditions] = useState("");
  const [addError, setAddError] = useState("");

  const [editingRowId, setEditingRowId] = useState(null);
  const [editingApiId, setEditingApiId] = useState(null);
  const [editQuoteRef, setEditQuoteRef] = useState("");
  const [editQuotedAt, setEditQuotedAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editLines, setEditLines] = useState([emptyApiLine()]);
  const [editStatus, setEditStatus] = useState("Pending");
  const [editProductImgUrl, setEditProductImgUrl] = useState("");
  const [editCustomerImgUrl, setEditCustomerImgUrl] = useState("");
  const [editClientNote, setEditClientNote] = useState("");
  const [editTermsAndConditions, setEditTermsAndConditions] = useState("");
  const [editError, setEditError] = useState("");

  const [viewRow, setViewRow] = useState(null);
  const [quotationFormMode, setQuotationFormMode] = useState("list");
  const [catalogQuickAddKey, setCatalogQuickAddKey] = useState(0);
  const [catalogQuickSearchText, setCatalogQuickSearchText] = useState("");
  const [catalogQuickSuggestions, setCatalogQuickSuggestions] = useState([]);
  const [customQuickAddText, setCustomQuickAddText] = useState("");
  const [lineItemsColWidths, setLineItemsColWidths] = useState(
    () => [...QUOTE_LINE_ITEMS_COL_WIDTHS_DEFAULT]
  );
  const [deleteQuoteRef, setDeleteQuoteRef] = useState(null);
  const [deleteRowId, setDeleteRowId] = useState(null);
  const [deleteApiId, setDeleteApiId] = useState(null);

  useEffect(() => {
    if (quotationFormMode === "list") {
      setLineItemsColWidths([...QUOTE_LINE_ITEMS_COL_WIDTHS_DEFAULT]);
    }
  }, [quotationFormMode]);

  const addQuoteTotal = useMemo(
    () => roundMoney(addLines.reduce((s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token)), 0)),
    [addLines, catalogProducts, token]
  );

  const editQuoteTotal = useMemo(
    () =>
      roundMoney(
        editLines.reduce(
          (s, l) =>
            s + displayLineAmount(l, catalogProducts, Boolean(token && editingApiId != null)),
          0
        )
      ),
    [editLines, catalogProducts, token, editingApiId]
  );

  const productOptions = useMemo(() => {
    const names = new Set();
    for (const r of quotations) {
      for (const it of r.items ?? []) {
        const n = it.product_name ?? it.productName;
        if (n) {
          names.add(n);
        }
      }
      if ((r.items ?? []).length === 0 && r.Product_Name) {
        names.add(r.Product_Name);
      }
    }
    const sorted = [...names].sort((a, b) => String(a).localeCompare(String(b)));
    return [ALL, ...sorted.map((n) => ({ label: n, value: n }))];
  }, [quotations]);

  const customerOptions = useMemo(() => {
    const names = [...new Set(quotations.map((r) => r.Custmer_Name))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return [ALL, ...names.map((n) => ({ label: n, value: n }))];
  }, [quotations]);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Sent", value: "Sent" },
      { label: "Pending", value: "Pending" },
      { label: "Ordered", value: "Ordered" }
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: "Recently quoted", value: "recent" },
      { label: "Quote ref A–Z", value: "refAsc" },
      { label: "Quote ref Z–A", value: "refDesc" },
      { label: "Last month", value: "lastMonth" },
      { label: "Last 7 days", value: "last7" }
    ],
    []
  );

  const catalogProductPickOptions = useMemo(
    () => [
      PICK_PLACEHOLDER,
      ...catalogProducts.map((p) => ({
        label: `${p.name} (${p.sku != null && String(p.sku) !== "" ? p.sku : "—"})`,
        value: String(p.id)
      }))
    ],
    [catalogProducts]
  );

  const catalogCustomerPickOptions = useMemo(
    () => [
      PICK_PLACEHOLDER,
      ...catalogCustomers.map((c) => ({
        label: `${c.name} (${c.code})`,
        value: String(c.id)
      }))
    ],
    [catalogCustomers]
  );

  const displayRows = useMemo(() => {
    let list = [...quotations];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const inItems = (r.items ?? []).some((it) =>
          String(it.product_name ?? it.productName ?? "")
            .toLowerCase()
            .includes(q)
        );
        return (
          inItems ||
          String(r.Product_Name).toLowerCase().includes(q) ||
          String(r.productsExportLabel ?? "").toLowerCase().includes(q) ||
          String(r.Custmer_Name).toLowerCase().includes(q) ||
          String(r.quoteRef || "").toLowerCase().includes(q) ||
          String(r.expiresAtIso ?? "").toLowerCase().includes(q) ||
          String(r.Status).toLowerCase().includes(q)
        );
      });
    }
    if (filterProduct) {
      list = list.filter((r) =>
        (r.items ?? []).some((it) => (it.product_name ?? it.productName) === filterProduct)
      );
    }
    if (filterCustomer) {
      list = list.filter((r) => r.Custmer_Name === filterCustomer);
    }
    if (filterStatus) {
      list = list.filter((r) => r.Status === filterStatus);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);

    if (sortMode === "lastMonth") {
      list = list.filter((r) => {
        const d = parseRowDate(r);
        return d && d >= startOfMonth;
      });
    } else if (sortMode === "last7") {
      list = list.filter((r) => {
        const d = parseRowDate(r);
        return d && d >= last7;
      });
    }

    if (sortMode === "refAsc") {
      list.sort((a, b) => String(a.quoteRef || "").localeCompare(String(b.quoteRef || "")));
    } else if (sortMode === "refDesc") {
      list.sort((a, b) => String(b.quoteRef || "").localeCompare(String(a.quoteRef || "")));
    } else {
      list.sort((a, b) => {
        const da = parseRowDate(a);
        const db = parseRowDate(b);
        if (!da && !db) {
          return 0;
        }
        if (!da) {
          return 1;
        }
        if (!db) {
          return -1;
        }
        return db - da;
      });
    }

    return list;
  }, [quotations, searchQuery, filterProduct, filterCustomer, filterStatus, sortMode]);

  const totalRecords = displayRows.length;

  const tableRowSignature = useMemo(
    () => displayRows.map((r) => r.id).join("|"),
    [displayRows]
  );

  useEffect(() => {
    setCurrentPage((p) => {
      const totalPages = Math.max(1, Math.ceil(totalRecords / rows) || 1);
      return p > totalPages ? totalPages : p;
    });
  }, [totalRecords, rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterProduct, filterCustomer, filterStatus, sortMode]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterProduct("");
    setFilterCustomer("");
    setFilterStatus("");
    setSortMode("recent");
    setCurrentPage(1);
    if (token) {
      loadQuotations();
      loadCatalog();
    }
  }, [token, loadQuotations, loadCatalog]);

  const handleExportPdf = useCallback(async () => {
    try {
      await downloadQuotationsPdf(displayRows);
    } catch {
      setListError("Could not export PDF. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const handleExportExcel = useCallback(async () => {
    try {
      await downloadQuotationsExcel(displayRows);
    } catch {
      setListError("Could not export Excel. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const resetAddForm = useCallback(() => {
    setAddQuotedAt(new Date().toISOString().slice(0, 10));
    setAddExpiresAt("");
    setAddCustomerId("");
    setAddLines(token ? [emptyApiLine()] : [emptyLocalLine()]);
    setAddCustomerName("");
    setAddStatus("Pending");
    setAddProductImgUrl("");
    setAddCustomerImgUrl("");
    setAddClientNote("");
    setAddTermsAndConditions("");
    setCustomQuickAddText("");
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogQuickAddKey((k) => k + 1);
    setAddError("");
  }, [token]);

  const openCreateQuotationForm = useCallback(() => {
    resetAddForm();
    setQuotationFormMode("create");
  }, [resetAddForm]);

  const leaveQuotationForm = useCallback(() => {
    setQuotationFormMode("list");
    resetAddForm();
    setEditExpiresAt("");
    setEditClientNote("");
    setEditTermsAndConditions("");
    setCustomQuickAddText("");
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogQuickAddKey((k) => k + 1);
    setEditingRowId(null);
    setEditingApiId(null);
    setEditError("");
  }, [resetAddForm]);

  const openEditQuotation = useCallback(
    (row) => {
      setEditingRowId(row.id);
      setEditingApiId(row.apiId ?? null);
      setEditQuoteRef(String(row.quoteRef ?? ""));
      setEditQuotedAt(row.quotedAtIso || new Date().toISOString().slice(0, 10));
      setEditExpiresAt(row.expiresAtIso ?? "");
      setEditCustomerId(
        row.customer_id != null && row.customer_id !== "" ? String(row.customer_id) : ""
      );
      if (token && row.apiId != null) {
        setEditCustomerName("");
        const src = row.items ?? [];
        setEditLines(
          src.length > 0
            ? src.map((it) => {
                const custom = it.product_id == null || it.product_id === "";
                return {
                  key: it.key ?? newLineKey(),
                  productId: custom ? "" : String(it.product_id),
                  quantity: String(it.quantity ?? 1),
                  unitPrice:
                    it.unit_price != null && String(it.unit_price) !== ""
                      ? String(it.unit_price)
                      : "",
                  isCustom: Boolean(custom),
                  customLabel: custom ? String(it.product_name ?? "") : "",
                  description: String(it.description ?? ""),
                  taxPercent:
                    it.tax_percent != null && String(it.tax_percent) !== ""
                      ? String(it.tax_percent)
                      : "0"
                };
              })
            : [emptyApiLine()]
        );
      } else {
        const src = row.items ?? [];
        setEditLines(
          src.length > 0
            ? src.map((it) => ({
                key: it.key ?? newLineKey(),
                productName: String(it.productName ?? it.product_name ?? ""),
                quantity: String(it.quantity ?? 1),
                unitPrice: String(it.unitPrice ?? it.unit_price ?? ""),
                productImg: it.productImg ?? stockImg01,
                description: String(it.description ?? ""),
                taxPercent:
                  it.tax_percent != null && String(it.tax_percent) !== ""
                    ? String(it.tax_percent)
                    : String(it.taxPercent ?? "0")
              }))
            : [emptyLocalLine()]
        );
        setEditCustomerName(String(row.Custmer_Name ?? ""));
      }
      setEditStatus(String(row.Status ?? "Pending"));
      setEditProductImgUrl(row.product_image_url ? String(row.product_image_url) : "");
      setEditCustomerImgUrl(row.customer_image_url ? String(row.customer_image_url) : "");
      setEditClientNote(String(row.clientNote ?? ""));
      setEditTermsAndConditions(String(row.termsAndConditions ?? ""));
      setEditError("");
      setQuotationFormMode("edit");
    },
    [token]
  );

  const openViewQuotation = useCallback((row) => {
    setViewRow(row);
  }, []);

  const openDeleteQuotation = useCallback((row) => {
    setDeleteQuoteRef(row.quoteRef);
    setDeleteRowId(row.id);
    setDeleteApiId(row.apiId ?? null);
  }, []);

  const appendProductFromCatalogSearch = useCallback(
    (productIdStr) => {
      if (!productIdStr) {
        return;
      }
      const pid = String(productIdStr);
      const p = catalogProducts.find((x) => String(x.id) === pid);
      const price = p?.selling_price != null ? String(p.selling_price) : "";
      const merge = (prev) => {
        const idx = prev.findIndex((l) => String(l.productId) === pid);
        if (idx >= 0) {
          return prev.map((l, i) => {
            if (i !== idx) {
              return l;
            }
            const q = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
            const qty = Number.isNaN(q) || q < 0 ? 0 : q;
            return { ...l, quantity: String(qty + 1) };
          });
        }
        const first = prev[0];
        const isBlankCatalogRow =
          prev.length === 1 &&
          !first.isCustom &&
          (!String(first.productId ?? "").trim() || first.productId === "");
        if (isBlankCatalogRow) {
          return [
            {
              ...first,
              productId: pid,
              quantity: "1",
              unitPrice: price,
              isCustom: false,
              customLabel: "",
              description: "",
              taxPercent: "0"
            }
          ];
        }
        return [
          ...prev,
          {
            key: newLineKey(),
            productId: pid,
            quantity: "1",
            unitPrice: price,
            isCustom: false,
            customLabel: "",
            description: "",
            taxPercent: "0"
          }
        ];
      };
      if (quotationFormMode === "create") {
        setAddLines(merge);
      } else {
        setEditLines(merge);
      }
    },
    [catalogProducts, quotationFormMode]
  );

  const appendCustomLineFromQuickAdd = useCallback(() => {
    const t = customQuickAddText.trim();
    if (!t) {
      return;
    }
    const line = {
      key: newLineKey(),
      productId: "",
      quantity: "1",
      unitPrice: "",
      isCustom: true,
      customLabel: t,
      description: "",
      taxPercent: "0"
    };
    if (quotationFormMode === "create") {
      setAddLines((p) => [...p, line]);
    } else {
      setEditLines((p) => [...p, line]);
    }
    setCustomQuickAddText("");
  }, [customQuickAddText, quotationFormMode]);

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
        appendProductFromCatalogSearch(String(p.id));
        setCatalogQuickSearchText("");
        setCatalogQuickSuggestions([]);
        setCatalogQuickAddKey((k) => k + 1);
      }
    },
    [appendProductFromCatalogSearch]
  );

  const saveNewQuotation = useCallback(async () => {
    setAddError("");
    if (!addQuotedAt) {
      setAddError("Please choose a quote date.");
      return;
    }
    if (!["Sent", "Pending", "Ordered"].includes(addStatus)) {
      setAddError("Invalid status.");
      return;
    }
    if (addExpiresAt && addQuotedAt && addExpiresAt < addQuotedAt) {
      setAddError("Expiry date must be on or after the quote date.");
      return;
    }

    const productUrl = addProductImgUrl.trim() || null;
    const customerUrl = addCustomerImgUrl.trim() || null;

    if (token) {
      if (!addCustomerId) {
        setAddError("Choose a customer.");
        return;
      }
      const lines = addLines.filter((l) =>
        l.isCustom ? String(l.customLabel ?? "").trim() !== "" : l.productId != null && l.productId !== ""
      );
      if (lines.length === 0) {
        setAddError("Add at least one catalog product or a custom item with a description.");
        return;
      }
      const totalFilled = roundMoney(
        lines.reduce((s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token)), 0)
      );
      if (totalFilled <= 0) {
        setAddError("Enter valid quantities and prices for each line.");
        return;
      }
      const items = lines.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (l.isCustom) {
          if (Number.isNaN(unit) || unit < 0) {
            unit = 0;
          }
          const desc = String(l.description ?? "").trim();
          const tp = parseTaxPercentFromLine(l);
          return {
            product_id: null,
            product_name: String(l.customLabel).trim(),
            quantity,
            unit_price: unit,
            tax_percent: tp,
            ...(desc !== "" ? { description: desc } : {})
          };
        }
        if (Number.isNaN(unit) || String(l.unitPrice).trim() === "") {
          const p = catalogProducts.find((x) => String(x.id) === String(l.productId));
          unit = p?.selling_price != null ? Number(p.selling_price) : 0;
        }
        const desc = String(l.description ?? "").trim();
        const tp = parseTaxPercentFromLine(l);
        return {
          product_id: Number(l.productId),
          quantity,
          unit_price: unit,
          tax_percent: tp,
          ...(desc !== "" ? { description: desc } : {})
        };
      });
      try {
        const body = {
          quoted_at: addQuotedAt,
          customer_id: Number(addCustomerId),
          status: addStatus,
          items
        };
        if (addExpiresAt) {
          body.expires_at = addExpiresAt;
        }
        const cn = addClientNote.trim();
        const tc = addTermsAndConditions.trim();
        if (cn) {
          body.client_note = cn;
        }
        if (tc) {
          body.terms_and_conditions = tc;
        }
        await createQuotationRequest(token, body);
        await loadQuotations();
        setSelectedQuotations([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setAddError(e.message);
        } else {
          setAddError("Could not create quotation.");
        }
        return;
      }
    } else {
      const cust = addCustomerName.trim();
      const lineRows = addLines.filter((l) => String(l.productName ?? "").trim() !== "");
      if (!cust) {
        setAddError("Please enter customer name.");
        return;
      }
      if (lineRows.length === 0) {
        setAddError("Add at least one product line.");
        return;
      }
      const quoteRef = nextQuoteRefLocal(quotations);
      if (quotations.some((r) => String(r.quoteRef).toLowerCase() === quoteRef.toLowerCase())) {
        setAddError("That quote reference is already in use.");
        return;
      }
      const builtItems = lineRows.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(unit) || unit < 0) {
          unit = 0;
        }
        const taxPct = parseTaxPercentFromLine(l);
        const subtotal = roundMoney(quantity * unit);
        const lt = roundMoney(subtotal * (1 + taxPct / 100));
        return {
          key: l.key,
          productName: String(l.productName).trim(),
          quantity: String(quantity),
          unitPrice: String(unit),
          tax_percent: taxPct,
          line_total: lt,
          productImg: l.productImg ?? stockImg01,
          description: String(l.description ?? "").trim()
        };
      });
      const totalNum = roundMoney(builtItems.reduce((s, x) => s + x.line_total, 0));
      const names = builtItems.map((x) => x.productName);
      const productLabel =
        names.length <= 1 ? names[0] || "—" : `${names[0]} (+${names.length - 1} more)`;
      const row = {
        id: String(Date.now()),
        apiId: null,
        quoteRef,
        quotedDate: formatQuotedDisplay(addQuotedAt),
        quotedAtIso: addQuotedAt,
        expiresAtIso: addExpiresAt || null,
        product_image_url: productUrl,
        customer_image_url: customerUrl,
        product_id: null,
        customer_id: null,
        productImg: builtItems[0]?.productImg ?? resolveMediaUrl(productUrl, stockImg01),
        Product_Name: productLabel,
        productsExportLabel: names.join("; "),
        items: builtItems,
        customerImg: resolveMediaUrl(customerUrl, user33),
        Custmer_Name: cust,
        Status: addStatus,
        Total: totalNum,
        clientNote: addClientNote,
        termsAndConditions: addTermsAndConditions
      };
      setQuotations((prev) => [...prev, row]);
    }

    resetAddForm();
    setQuotationFormMode("list");
  }, [
    addQuotedAt,
    addExpiresAt,
    addLines,
    addCustomerId,
    addCustomerName,
    addQuoteTotal,
    addStatus,
    addProductImgUrl,
    addCustomerImgUrl,
    addClientNote,
    addTermsAndConditions,
    quotations,
    resetAddForm,
    token,
    loadQuotations,
    catalogProducts
  ]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    saveNewQuotation();
  };

  const saveQuotationEdits = useCallback(async () => {
    setEditError("");
    if (!editingRowId) {
      return;
    }
    if (!editQuotedAt) {
      setEditError("Please choose a quote date.");
      return;
    }
    if (!["Sent", "Pending", "Ordered"].includes(editStatus)) {
      setEditError("Invalid status.");
      return;
    }
    const ref = editQuoteRef.trim();
    if (!ref) {
      setEditError("Quote reference is required.");
      return;
    }
    if (editExpiresAt && editQuotedAt && editExpiresAt < editQuotedAt) {
      setEditError("Expiry date must be on or after the quote date.");
      return;
    }

    const productUrl = editProductImgUrl.trim() || null;
    const customerUrl = editCustomerImgUrl.trim() || null;

    if (token && editingApiId != null) {
      if (!editCustomerId) {
        setEditError("Choose a customer.");
        return;
      }
      const lines = editLines.filter((l) =>
        l.isCustom ? String(l.customLabel ?? "").trim() !== "" : l.productId != null && l.productId !== ""
      );
      if (lines.length === 0) {
        setEditError("Add at least one catalog product or a custom item with a description.");
        return;
      }
      const totalFilled = roundMoney(
        lines.reduce(
          (s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token && editingApiId != null)),
          0
        )
      );
      if (totalFilled <= 0) {
        setEditError("Enter valid quantities and prices for each line.");
        return;
      }
      const items = lines.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (l.isCustom) {
          if (Number.isNaN(unit) || unit < 0) {
            unit = 0;
          }
          const desc = String(l.description ?? "").trim();
          const tp = parseTaxPercentFromLine(l);
          return {
            product_id: null,
            product_name: String(l.customLabel).trim(),
            quantity,
            unit_price: unit,
            tax_percent: tp,
            ...(desc !== "" ? { description: desc } : {})
          };
        }
        if (Number.isNaN(unit) || String(l.unitPrice).trim() === "") {
          const p = catalogProducts.find((x) => String(x.id) === String(l.productId));
          unit = p?.selling_price != null ? Number(p.selling_price) : 0;
        }
        const desc = String(l.description ?? "").trim();
        const tp = parseTaxPercentFromLine(l);
        return {
          product_id: Number(l.productId),
          quantity,
          unit_price: unit,
          tax_percent: tp,
          ...(desc !== "" ? { description: desc } : {})
        };
      });
      try {
        await updateQuotationRequest(token, editingApiId, {
          quote_ref: ref,
          quoted_at: editQuotedAt,
          expires_at: editExpiresAt || null,
          customer_id: Number(editCustomerId),
          status: editStatus,
          items,
          client_note: editClientNote.trim() || null,
          terms_and_conditions: editTermsAndConditions.trim() || null
        });
        await loadQuotations();
        setSelectedQuotations([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setEditError(e.message);
        } else {
          setEditError("Could not save changes.");
        }
        return;
      }
    } else {
      const cust = editCustomerName.trim();
      const lineRows = editLines.filter((l) => String(l.productName ?? "").trim() !== "");
      if (!cust) {
        setEditError("Please enter customer name.");
        return;
      }
      if (lineRows.length === 0) {
        setEditError("Add at least one product line.");
        return;
      }
      const refDup = quotations.some(
        (r) => r.id !== editingRowId && String(r.quoteRef).toLowerCase() === ref.toLowerCase()
      );
      if (refDup) {
        setEditError("Another row already uses this quote reference.");
        return;
      }
      const builtItems = lineRows.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(unit) || unit < 0) {
          unit = 0;
        }
        const taxPct = parseTaxPercentFromLine(l);
        const subtotal = roundMoney(quantity * unit);
        const lt = roundMoney(subtotal * (1 + taxPct / 100));
        return {
          key: l.key,
          productName: String(l.productName).trim(),
          quantity: String(quantity),
          unitPrice: String(unit),
          tax_percent: taxPct,
          line_total: lt,
          productImg: l.productImg ?? stockImg01,
          description: String(l.description ?? "").trim()
        };
      });
      const totalNum = roundMoney(builtItems.reduce((s, x) => s + x.line_total, 0));
      const names = builtItems.map((x) => x.productName);
      const productLabel =
        names.length <= 1 ? names[0] || "—" : `${names[0]} (+${names.length - 1} more)`;
      setQuotations((prev) =>
        prev.map((r) =>
          r.id === editingRowId
            ? {
                ...r,
                quoteRef: ref,
                quotedDate: formatQuotedDisplay(editQuotedAt),
                quotedAtIso: editQuotedAt,
                expiresAtIso: editExpiresAt || null,
                clientNote: editClientNote,
                termsAndConditions: editTermsAndConditions,
                Product_Name: productLabel,
                productsExportLabel: names.join("; "),
                items: builtItems,
                Custmer_Name: cust,
                Status: editStatus,
                Total: totalNum,
                product_image_url: productUrl,
                customer_image_url: customerUrl,
                productImg: builtItems[0]?.productImg ?? resolveMediaUrl(productUrl, r.productImg || stockImg01),
                customerImg: resolveMediaUrl(customerUrl, r.customerImg || user33)
              }
            : r
        )
      );
    }

    setEditingRowId(null);
    setEditingApiId(null);
    setQuotationFormMode("list");
  }, [
    editingRowId,
    editingApiId,
    editQuoteRef,
    editQuotedAt,
    editExpiresAt,
    editLines,
    editCustomerId,
    editCustomerName,
    editQuoteTotal,
    editStatus,
    editProductImgUrl,
    editCustomerImgUrl,
    editClientNote,
    editTermsAndConditions,
    quotations,
    token,
    loadQuotations,
    catalogProducts
  ]);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    saveQuotationEdits();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRowId) {
      return;
    }
    if (token && deleteApiId != null) {
      try {
        await deleteQuotationRequest(token, deleteApiId);
        await loadQuotations();
        setSelectedQuotations([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setListError(e.message);
        } else {
          setListError("Could not delete quotation.");
        }
        return;
      }
    } else {
      setQuotations((prev) => prev.filter((r) => r.id !== deleteRowId));
      setSelectedQuotations((sel) => sel.filter((r) => r.id !== deleteRowId));
    }
    setDeleteQuoteRef(null);
    setDeleteRowId(null);
    setDeleteApiId(null);
    hideBsModal("delete-quotation-modal");
  };

  const columns = useMemo(
    () => [
      { header: "Quote #", field: "quoteRef", sortable: true },
      { header: "Date", field: "quotedDate", sortable: true },
      {
        header: "Expiry",
        field: "expiresAtIso",
        sortable: true,
        body: (rowData) =>
          rowData.expiresAtIso ? formatQuotedDisplay(rowData.expiresAtIso) : "—"
      },
      {
        header: "Product Name",
        field: "Product_Name",
        sortable: true,
        body: (rowData) => (
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.productImg} alt="" />
            </Link>
            <Link to="#">{rowData.Product_Name}</Link>
          </div>
        )
      },
      {
        header: "Customer",
        field: "Custmer_Name",
        sortable: true,
        body: (rowData) => (
          <div className="d-flex align-items-center me-2">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={rowData.customerImg} alt="" />
            </Link>
            <Link to="#">{rowData.Custmer_Name}</Link>
          </div>
        )
      },
      {
        header: "Total",
        field: "Total",
        sortable: true,
        body: (rowData) =>
          typeof rowData.Total === "number" ? formatMoney(rowData.Total) : rowData.Total
      },
      {
        header: "Status",
        field: "Status",
        sortable: true,
        body: (rowData) => (
          <span
            className={`badge ${
              rowData.Status === "Sent"
                ? "badge-success"
                : rowData.Status === "Ordered"
                  ? "badge-warning"
                  : "badge-cyan"
            }`}>
            {rowData.Status}
          </span>
        )
      },
      {
        header: "Actions",
        field: "actions",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action d-flex align-items-center">
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#view-quotation-modal"
              onClick={(e) => {
                e.preventDefault();
                openViewQuotation(row);
              }}>
              <Eye size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              onClick={(e) => {
                e.preventDefault();
                openEditQuotation(row);
              }}>
              <Edit2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-quotation-modal"
              onClick={(e) => {
                e.preventDefault();
                openDeleteQuotation(row);
              }}>
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        )
      }
    ],
    [openDeleteQuotation, openEditQuotation, openViewQuotation]
  );

  const formIsCreate = quotationFormMode === "create";
  const formLines = formIsCreate ? addLines : editLines;
  const setFormLines = formIsCreate ? setAddLines : setEditLines;
  const useApiProductLines = formIsCreate
    ? Boolean(token)
    : Boolean(token && editingApiId != null);
  const formQuoteTotal = formIsCreate ? addQuoteTotal : editQuoteTotal;
  const formError = formIsCreate ? addError : editError;

  const handleQuoteLineColResizeMouseDown = useCallback(
    (colIndex) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = lineItemsColWidths[colIndex];
      const minW = colIndex === 0 ? 32 : 56;
      const onMove = (ev) => {
        const d = ev.clientX - startX;
        setLineItemsColWidths((prev) => {
          const n = [...prev];
          n[colIndex] = Math.max(minW, startW + d);
          return n;
        });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [lineItemsColWidths]
  );

  const onQuoteLineRowDragStart = useCallback((lineKey) => (e) => {
    if (!e.target.closest(".qt-line-row-drag")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", lineKey);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onQuoteLineRowDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onQuoteLineRowDrop = useCallback(
    (targetKey) => (e) => {
      e.preventDefault();
      const fromKey = e.dataTransfer.getData("text/plain");
      if (!fromKey || fromKey === targetKey) {
        return;
      }
      setFormLines((prev) => {
        const from = prev.findIndex((x) => x.key === fromKey);
        const to = prev.findIndex((x) => x.key === targetKey);
        if (from < 0 || to < 0) {
          return prev;
        }
        const copy = [...prev];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
      });
    },
    [setFormLines]
  );

  return (
    <>
      <div
        className={`page-wrapper quotation-list-page${
          inTillflowShell ? " quotation-list-page--tillflow" : ""
        }`}>
        <div className="content">
          {quotationFormMode === "list" ? (
            <>
              <div className="page-header">
                <div className="add-item d-flex">
                  <div className="page-title">
                    <h4>Quotations</h4>
                    <h6>Create, track, and convert quotes — filter by product, customer, or status.</h6>
                  </div>
                </div>
                <TableTopHead
                  onRefresh={resetFilters}
                  onExportPdf={handleExportPdf}
                  onExportExcel={handleExportExcel}
                />
                {listError ? (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    {listError}
                  </div>
                ) : null}
                {catalogError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {catalogError}
                  </div>
                ) : null}
                <div className="page-btn d-flex flex-wrap gap-2">
                  <Link
                    to="#"
                    className="btn btn-primary text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      openCreateQuotationForm();
                    }}>
                    <PlusCircle size={18} strokeWidth={1.75} className="me-1" aria-hidden />
                    Add quotation
                  </Link>
                  {inTillflowShell ? (
                    <Link to="/tillflow/admin/invoices" className="btn btn-outline-primary">
                      <i className="ti ti-file-invoice me-1" />
                      Invoices
                    </Link>
                  ) : (
                    <Link to={all_routes.invoice} className="btn btn-outline-primary">
                      <i className="ti ti-file-invoice me-1" />
                      Invoices
                    </Link>
                  )}
                </div>
              </div>
              <div className="card table-list-card manage-stock">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <SearchFromApi
                    callback={(v) => setSearchQuery(v ?? "")}
                    rows={rows}
                    setRows={setRows}
                  />
                  <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3 gap-2">
                    <div style={{ minWidth: "10rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={productOptions}
                        value={filterProduct === "" ? "" : filterProduct}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterProduct(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Product"
                        filter
                      />
                    </div>
                    <div style={{ minWidth: "10rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={customerOptions}
                        value={filterCustomer === "" ? "" : filterCustomer}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterCustomer(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Customer"
                        filter
                      />
                    </div>
                    <div style={{ minWidth: "10rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={statusOptions}
                        value={filterStatus === "" ? "" : filterStatus}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterStatus(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Status"
                        filter={false}
                      />
                    </div>
                    <div style={{ minWidth: "11rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={sortOptions}
                        value={sortMode}
                        onChange={(e) =>
                          setSortMode(e.value != null ? String(e.value) : "recent")
                        }
                        placeholder="Sort"
                        filter={false}
                      />
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="custom-datatable-filter table-responsive">
                    <PrimeDataTable
                      key={tableRowSignature}
                      column={columns}
                      data={displayRows}
                      totalRecords={totalRecords}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      rows={rows}
                      setRows={setRows}
                      loading={listLoading}
                      selectionMode="checkbox"
                      selection={selectedQuotations}
                      onSelectionChange={(e) => setSelectedQuotations(e.value)}
                      dataKey="id"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <form
              className="quotation-form-sheet"
              noValidate
              onSubmit={formIsCreate ? handleAddSubmit : handleEditSubmit}>
              <div className="page-header border-0 pb-2">
                <div className="d-flex flex-wrap align-items-start gap-3 justify-content-between">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                      onClick={leaveQuotationForm}>
                      <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
                      Back to list
                    </button>
                    <div className="page-title mb-0">
                      <h4 className="mb-0">
                        {formIsCreate ? "Create quotation" : "Edit quotation"}
                      </h4>
                      <h6 className="text-muted mb-0 fw-normal mt-1">
                        Customer, dates, line items, and totals — same fields as before, full page layout.
                      </h6>
                    </div>
                  </div>
                </div>
                {catalogError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {catalogError}
                  </div>
                ) : null}
              </div>

              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-lg-6">
                      {token ? (
                        formIsCreate ? (
                          <div className="mb-3">
                            <label className="form-label">
                              Customer<span className="text-danger ms-1">*</span>
                            </label>
                            <CommonSelect
                              className="w-100"
                              options={catalogCustomerPickOptions}
                              value={addCustomerId === "" ? "" : addCustomerId}
                              onChange={(e) => {
                                const v = e.value;
                                setAddCustomerId(v == null || v === "" ? "" : String(v));
                              }}
                              placeholder="Customer"
                              filter
                            />
                          </div>
                        ) : editingApiId != null ? (
                          <div className="mb-3">
                            <label className="form-label">
                              Customer<span className="text-danger ms-1">*</span>
                            </label>
                            <CommonSelect
                              className="w-100"
                              options={catalogCustomerPickOptions}
                              value={editCustomerId === "" ? "" : editCustomerId}
                              onChange={(e) => {
                                const v = e.value;
                                setEditCustomerId(v == null || v === "" ? "" : String(v));
                              }}
                              placeholder="Customer"
                              filter
                            />
                          </div>
                        ) : (
                          <div className="mb-3">
                            <label className="form-label">
                              Customer name<span className="text-danger ms-1">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              value={editCustomerName}
                              onChange={(e) => setEditCustomerName(e.target.value)}
                            />
                          </div>
                        )
                      ) : (
                        <div className="mb-3">
                          <label className="form-label">
                            Customer name<span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={formIsCreate ? addCustomerName : editCustomerName}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddCustomerName(e.target.value)
                                : setEditCustomerName(e.target.value)
                            }
                          />
                        </div>
                      )}

                      <div className="row g-3">
                        <div className="col-md-6 col-lg-4">
                          <label className="form-label">
                            Quote date<span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={formIsCreate ? addQuotedAt : editQuotedAt}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddQuotedAt(e.target.value)
                                : setEditQuotedAt(e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-6 col-lg-4">
                          <label className="form-label">
                            Expiry date<span className="text-muted fw-normal ms-1">(optional)</span>
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={formIsCreate ? addExpiresAt : editExpiresAt}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddExpiresAt(e.target.value)
                                : setEditExpiresAt(e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-6 col-lg-4">
                          <label className="form-label">
                            Status<span className="text-danger ms-1">*</span>
                          </label>
                          <select
                            className="form-select"
                            value={formIsCreate ? addStatus : editStatus}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddStatus(e.target.value)
                                : setEditStatus(e.target.value)
                            }>
                            <option value="Pending">Pending</option>
                            <option value="Sent">Sent</option>
                            <option value="Ordered">Ordered</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="col-lg-6">
                      <div className="mb-3">
                        <label className="form-label">Quote total</label>
                        <div className="form-control bg-light fw-medium">{formatMoney(formQuoteTotal)}</div>
                      </div>
                      {!token || (!formIsCreate && editingApiId == null) ? (
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">Product image URL</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Optional"
                              value={formIsCreate ? addProductImgUrl : editProductImgUrl}
                              onChange={(e) =>
                                formIsCreate
                                  ? setAddProductImgUrl(e.target.value)
                                  : setEditProductImgUrl(e.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Customer image URL</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Optional"
                              value={formIsCreate ? addCustomerImgUrl : editCustomerImgUrl}
                              onChange={(e) =>
                                formIsCreate
                                  ? setAddCustomerImgUrl(e.target.value)
                                  : setEditCustomerImgUrl(e.target.value)
                              }
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  {useApiProductLines ? (
                    <div className="row g-2 align-items-end mb-3 pb-3 border-bottom quotation-catalog-add">
                      <div className="col-lg-8 col-md-7">
                        <label className="form-label mb-1 fw-semibold" htmlFor={`catalog-quick-add-${catalogQuickAddKey}`}>
                          Search catalog &amp; add item
                        </label>
                        <AutoComplete
                          key={`catalog-quick-add-${catalogQuickAddKey}`}
                          inputId={`catalog-quick-add-${catalogQuickAddKey}`}
                          value={catalogQuickSearchText}
                          suggestions={catalogQuickSuggestions}
                          completeMethod={catalogQuickComplete}
                          onChange={catalogQuickOnChange}
                          onSelect={catalogQuickOnSelect}
                          field="name"
                          placeholder="Search by name or SKU, then pick a product…"
                          className="w-100 quotation-catalog-autocomplete"
                          inputClassName="form-control"
                          appendTo={typeof document !== "undefined" ? document.body : null}
                          minLength={1}
                          dropdown={false}
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
                      <div className="col-lg-4 col-md-5">
                        <p className="text-muted small mb-0">
                          Type in the search field (no dropdown button), choose a product, or add a{" "}
                          <strong>custom line</strong> below. Catalog picks bump quantity if the product
                          is already on the quote.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {useApiProductLines ? (
                    <div className="row g-2 align-items-end mb-3 pb-3 border-bottom">
                      <div className="col-lg-8 col-md-7">
                        <label className="form-label mb-1 fw-semibold">Custom item (not in catalog)</label>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Delivery, labour, one-off parts"
                            value={customQuickAddText}
                            onChange={(e) => setCustomQuickAddText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                appendCustomLineFromQuickAdd();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={appendCustomLineFromQuickAdd}>
                            Add custom line
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {catalogLoading && token ? (
                    <p className="text-muted small mb-2">Loading catalog…</p>
                  ) : null}
                  <div className="mb-3">
                    <h5 className="mb-0 fw-semibold">Line items</h5>
                    <p className="text-muted small mb-0 mt-1">
                      Drag the grip to reorder rows. Drag the right edge of each header cell to resize
                      columns.
                    </p>
                  </div>
                  <div className="table-responsive quotation-line-items-scroll">
                    <table className="table table-hover align-middle mb-0 quotation-line-items-table">
                      <colgroup>
                        {lineItemsColWidths.map((w, i) => (
                          <col key={i} style={{ width: w }} />
                        ))}
                      </colgroup>
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="user-select-none position-relative py-2">
                            <span className="visually-hidden">Reorder rows</span>
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(0)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Product / item
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(1)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Long description
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(2)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Qty
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(3)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Unit price
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(4)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Tax %
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(5)}
                            />
                          </th>
                          <th scope="col" className="text-end position-relative">
                            Amount
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(6)}
                            />
                          </th>
                          <th scope="col" className="text-end">
                            <span className="visually-hidden">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody onDragOver={onQuoteLineRowDragOver}>
                        {formLines.map((line) => (
                          <tr
                            key={line.key}
                            draggable
                            onDragStart={onQuoteLineRowDragStart(line.key)}
                            onDragOver={onQuoteLineRowDragOver}
                            onDrop={onQuoteLineRowDrop(line.key)}
                            className="quotation-line-item-row">
                            <td className="qt-line-row-drag align-middle text-center p-1">
                              <span className="visually-hidden">Drag to reorder row</span>
                              <Move size={18} strokeWidth={1.75} className="text-secondary" aria-hidden />
                            </td>
                            <td>
                              {useApiProductLines ? (
                                <div className="d-flex flex-column gap-2">
                                  {line.isCustom ? (
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Custom item (not in catalog)"
                                      value={line.customLabel ?? ""}
                                      onChange={(e) =>
                                        setFormLines((prev) =>
                                          prev.map((l) =>
                                            l.key === line.key
                                              ? { ...l, customLabel: e.target.value }
                                              : l
                                          )
                                        )
                                      }
                                    />
                                  ) : (
                                    <CommonSelect
                                      className="w-100"
                                      options={catalogProductPickOptions}
                                      value={line.productId === "" ? "" : line.productId}
                                      onChange={(e) => {
                                        const v =
                                          e.value == null || e.value === "" ? "" : String(e.value);
                                        setFormLines((prev) =>
                                          prev.map((l) =>
                                            l.key === line.key
                                              ? {
                                                  ...l,
                                                  isCustom: false,
                                                  customLabel: "",
                                                  productId: v,
                                                  unitPrice:
                                                    v &&
                                                    (!String(l.unitPrice).trim() || l.unitPrice === "")
                                                      ? String(
                                                          catalogProducts.find((p) => String(p.id) === v)
                                                            ?.selling_price ?? ""
                                                        )
                                                      : l.unitPrice
                                                }
                                              : l
                                          )
                                        );
                                      }}
                                      placeholder="Product"
                                      filter
                                      appendTo="body"
                                    />
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Product name"
                                  value={line.productName ?? ""}
                                  onChange={(e) =>
                                    setFormLines((prev) =>
                                      prev.map((l) =>
                                        l.key === line.key
                                          ? { ...l, productName: e.target.value }
                                          : l
                                      )
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td>
                              <label className="visually-hidden" htmlFor={`qt-line-desc-${line.key}`}>
                                Long description for line
                              </label>
                              <textarea
                                id={`qt-line-desc-${line.key}`}
                                className="form-control"
                                rows={4}
                                placeholder="Optional — extra detail for this line…"
                                value={line.description ?? ""}
                                onChange={(e) =>
                                  setFormLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key
                                        ? { ...l, description: e.target.value }
                                        : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                className="form-control"
                                value={line.quantity}
                                onChange={(e) =>
                                  setFormLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, quantity: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={line.unitPrice}
                                onChange={(e) =>
                                  setFormLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, unitPrice: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                title="Tax % applied to line subtotal (qty × unit price)"
                                value={line.taxPercent ?? "0"}
                                onChange={(e) =>
                                  setFormLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, taxPercent: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="text-end">
                              <span className="fw-medium">
                                {formatMoney(
                                  displayLineAmount(
                                    line,
                                    catalogProducts,
                                    useApiProductLines
                                  )
                                )}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex align-items-center justify-content-end gap-1">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center p-0"
                                  style={{ width: "36px", height: "36px" }}
                                  aria-label="Add line after this row"
                                  title="Add blank line"
                                  onClick={() =>
                                    setFormLines((p) => {
                                      const idx = p.findIndex((l) => l.key === line.key);
                                      const next = useApiProductLines
                                        ? emptyApiLine()
                                        : emptyLocalLine();
                                      if (idx < 0) {
                                        return [...p, next];
                                      }
                                      return [...p.slice(0, idx + 1), next, ...p.slice(idx + 1)];
                                    })
                                  }>
                                  <Plus size={22} strokeWidth={2} className="text-white" aria-hidden />
                                </button>
                                {formLines.length > 1 ? (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm text-danger p-0 d-inline-flex align-items-center justify-content-center"
                                    style={{ width: "34px", height: "34px" }}
                                    aria-label="Remove line"
                                    title="Remove line"
                                    onClick={() =>
                                      setFormLines((p) => p.filter((l) => l.key !== line.key))
                                    }>
                                    <X size={18} strokeWidth={1.75} aria-hidden />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {formError ? (
                    <p className="text-danger small mb-0 mt-3">{formError}</p>
                  ) : null}
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="quotation-client-note">
                      Client note
                    </label>
                    <textarea
                      id="quotation-client-note"
                      className="form-control"
                      rows={4}
                      placeholder="Shown to the customer on the quote (optional)"
                      value={formIsCreate ? addClientNote : editClientNote}
                      onChange={(e) =>
                        formIsCreate
                          ? setAddClientNote(e.target.value)
                          : setEditClientNote(e.target.value)
                      }
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="quotation-terms">
                      Terms &amp; conditions
                    </label>
                    <textarea
                      id="quotation-terms"
                      className="form-control"
                      rows={4}
                      placeholder="Payment terms, validity, etc. (optional)"
                      value={formIsCreate ? addTermsAndConditions : editTermsAndConditions}
                      onChange={(e) =>
                        formIsCreate
                          ? setAddTermsAndConditions(e.target.value)
                          : setEditTermsAndConditions(e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex flex-wrap justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary fs-13 fw-medium px-3 shadow-none"
                    onClick={leaveQuotationForm}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fs-13 fw-medium px-3">
                    {formIsCreate ? "Save quotation" : "Save changes"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="view-quotation-modal">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Quotation</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {viewRow ? (
                <dl className="row mb-0">
                  <dt className="col-sm-4">Quote #</dt>
                  <dd className="col-sm-8">{viewRow.quoteRef}</dd>
                  <dt className="col-sm-4">Date</dt>
                  <dd className="col-sm-8">{viewRow.quotedDate}</dd>
                  <dt className="col-sm-4">Expiry</dt>
                  <dd className="col-sm-8">
                    {viewRow.expiresAtIso ? formatQuotedDisplay(viewRow.expiresAtIso) : "—"}
                  </dd>
                  <dt className="col-sm-4">Items</dt>
                  <dd className="col-sm-8">
                    {(viewRow.items ?? []).length === 0 ? (
                      viewRow.Product_Name
                    ) : (
                      <ul className="list-unstyled mb-0 small">
                        {(viewRow.items ?? []).map((it, ix) => {
                          const qty = Number(it.quantity ?? 1);
                          const unit = Number(it.unit_price ?? it.unitPrice ?? 0);
                          const taxP = Number(it.tax_percent ?? it.taxPercent ?? 0);
                          const lt =
                            it.line_total != null || it.lineTotal != null
                              ? Number(it.line_total ?? it.lineTotal)
                              : roundMoney(qty * unit * (1 + (Number.isNaN(taxP) ? 0 : taxP) / 100));
                          const longDesc = String(it.description ?? "").trim();
                          return (
                            <li key={it.key ?? it.id ?? `${ix}-${it.product_name ?? it.productName}`}>
                              <span className="fw-medium">{it.product_name ?? it.productName}</span>
                              {" · "}
                              Qty {it.quantity ?? 1} × {formatMoney(unit)}
                              {taxP > 0 && !Number.isNaN(taxP) ? (
                                <span className="text-muted"> ({taxP}% tax)</span>
                              ) : null}
                              {" = "}
                              {formatMoney(lt)}
                              {longDesc ? (
                                <div
                                  className="text-muted mt-1 small text-break"
                                  style={{ whiteSpace: "pre-wrap" }}>
                                  {longDesc}
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </dd>
                  <dt className="col-sm-4">Customer</dt>
                  <dd className="col-sm-8">{viewRow.Custmer_Name}</dd>
                  <dt className="col-sm-4">Total</dt>
                  <dd className="col-sm-8">
                    {typeof viewRow.Total === "number" ? formatMoney(viewRow.Total) : viewRow.Total}
                  </dd>
                  <dt className="col-sm-4">Status</dt>
                  <dd className="col-sm-8">{viewRow.Status}</dd>
                  <dt className="col-sm-4">Client note</dt>
                  <dd className="col-sm-8">
                    {viewRow.clientNote?.trim() ? (
                      <span className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                        {viewRow.clientNote}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="col-sm-4">Terms &amp; conditions</dt>
                  <dd className="col-sm-8">
                    {viewRow.termsAndConditions?.trim() ? (
                      <span className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                        {viewRow.termsAndConditions}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </dl>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete-quotation-modal">
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Delete quotation</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                Delete quotation <strong>{deleteQuoteRef}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuotationList;
