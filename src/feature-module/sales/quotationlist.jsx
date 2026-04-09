import { Modal } from "bootstrap";
import { AutoComplete } from "primereact/autocomplete";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
    ChevronLeft,
    Edit2,
    MoreVertical,
    Move,
    Plus,
    PlusCircle,
    Search,
    X
} from "react-feather";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import DocumentFormActions from "../../components/DocumentFormActions";
import CommonFooter from "../../components/footer/commonFooter";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import { quotationlistdata } from "../../core/json/quotationlistdata";
import { all_routes } from "../../routes/all_routes";
import { listBillersRequest } from "../../tillflow/api/billers";
import { listCustomersRequest } from "../../tillflow/api/customers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { listSalesCatalogProductsRequest } from "../../tillflow/api/products";
import {
    convertQuotationToInvoiceRequest,
    createQuotationRequest,
    deleteQuotationRequest,
    listQuotationsRequest,
    sendQuotationToCustomerRequest,
    updateQuotationRequest
} from "../../tillflow/api/quotations";
import { getTenantCompanyProfileRequest } from "../../tillflow/api/tenantCompany";
import { getTenantUiSettingsRequest } from "../../tillflow/api/tenantUiSettings";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { TILLFLOW_API_BASE_URL } from "../../tillflow/config";
import {
    getCompanySettingsSnapshot,
    profileApiToForm,
    resolveQuotationFooterFromSnapshot,
    saveCompanySettings
} from "../../utils/companySettingsStorage";
import { pdf, stockImg01, user33 } from "../../utils/imagepath";
import {
    downloadQuotationDetailPdf,
    downloadQuotationDetailPdfFromElement,
    downloadQuotationsExcel,
    downloadQuotationsPdf,
    quotationDetailPdfBlobFromElement,
    waitForPrintRootImages
} from "../../utils/quotationExport";
import QuotationPrintDocument from "./QuotationPrintDocument";

const ALL = { label: "All", value: "" };

/** Kenyan standard VAT rate — prefilled on new / incomplete quotation lines */
const DEFAULT_QUOTATION_LINE_TAX_PERCENT = "16";

/** Matches CRM-style discount mode (amount entry can follow later). */
const DISCOUNT_TYPE_OPTIONS = [
  { label: "No discount", value: "none" },
  { label: "Before tax", value: "before_tax" },
  { label: "After tax", value: "after_tax" }
];

const DISCOUNT_BASIS_OPTIONS = [
  { label: "Percentage", value: "percent" },
  { label: "Fixed amount (Ksh)", value: "fixed" }
];

function discountTypeLabel(value) {
  const v = value == null || value === "" ? "none" : String(value);
  const hit = DISCOUNT_TYPE_OPTIONS.find((o) => o.value === v);
  return hit ? hit.label : v;
}

function discountBasisLabel(value) {
  return value === "fixed" ? "Fixed amount (Ksh)" : "Percentage";
}

/** CRM-style quotation statuses (same labels as Breezetech estimates). */
const QUOTATION_CRM_STATUSES = ["Draft", "Sent", "Expired", "Declined", "Accepted"];

const LEGACY_QUOTATION_STATUS_MAP = {
  Pending: "Draft",
  Ordered: "Accepted"
};

function normalizeQuotationStatus(s) {
  if (s == null || s === "") {
    return "Draft";
  }
  const str = String(s);
  if (LEGACY_QUOTATION_STATUS_MAP[str]) {
    return LEGACY_QUOTATION_STATUS_MAP[str];
  }
  return QUOTATION_CRM_STATUSES.includes(str) ? str : "Draft";
}

function quotationStatusBadgeClass(status) {
  switch (status) {
    case "Draft":
      return "badge-secondary";
    case "Sent":
      return "badge-primary";
    case "Expired":
      return "badge-warning text-dark";
    case "Declined":
      return "badge-danger";
    case "Accepted":
      return "badge-success";
    default:
      return "badge-secondary";
  }
}

const PICK_PLACEHOLDER = { label: "Select…", value: "" };

/** Line items table: drag, #, item, description, qty, rate, tax, amount, actions */
const QUOTE_LINE_ITEMS_COL_WIDTHS_DEFAULT = [28, 44, 120, 300, 52, 136, 52, 72, 50];

const TILLFLOW_QUOTATIONS_BASE = "/tillflow/admin/quotations";

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

/** TillFlow quotation summary: KES-style label (no narrow space after Ksh). */
function formatQuoteMoneyKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return String(n ?? "");
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

function parseDiscountPercent(raw) {
  const x = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return Math.min(100, x);
}

function parseDiscountValueFixed(raw) {
  const x = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return x;
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

function showBsModal(id) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  Modal.getOrCreateInstance(el).show();
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
  const raw = String(isoDate).trim();
  const hasTime = raw.includes("T");
  const normalized = hasTime
    ? raw.replace(/\.(\d{3})\d+Z$/, ".$1Z")
    : `${raw}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
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
    customer_email: q.customer_email ?? null,
    customer_phone: q.customer_phone ?? null,
    customer_location: q.customer_location ?? null,
    Status: normalizeQuotationStatus(q.status),
    Total: Number(q.total_amount),
    clientNote: q.client_note ?? "",
    termsAndConditions: q.terms_and_conditions ?? "",
    quoteTitle: q.quote_title != null ? String(q.quote_title) : "",
    biller_id: q.biller_id ?? null,
    Biller_Name: q.biller_name ?? "",
    discount_type: q.discount_type ?? "none",
    discount_basis: q.discount_basis === "fixed" ? "fixed" : "percent",
    discount_value:
      q.discount_value != null && String(q.discount_value) !== ""
        ? String(q.discount_value)
        : "0"
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
    taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT,
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
    taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT,
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
      it.tax_percent != null && String(it.tax_percent) !== ""
        ? String(it.tax_percent)
        : DEFAULT_QUOTATION_LINE_TAX_PERCENT,
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

/** Line rows + summary figures for quotation “view” (invoice-style layout). */
function buildQuotationViewTableModel(viewRow) {
  if (!viewRow) {
    return {
      rows: [],
      subEx: 0,
      taxAmt: 0,
      discountAmt: 0,
      discountLabel: "Discount",
      grandTotal: 0,
      dtype: "none",
      showDiscountColumn: false
    };
  }
  const items = viewRow.items ?? [];
  const rows = [];
  if (items.length === 0) {
    const total = typeof viewRow.Total === "number" ? viewRow.Total : 0;
    rows.push({
      key: "legacy-line",
      title: String(viewRow.Product_Name ?? "—"),
      qty: 1,
      unit: total,
      disc: 0,
      lineTotal: total,
      desc: "",
      taxP: 0
    });
  } else {
    items.forEach((it, ix) => {
      const qty = Number(it.quantity ?? 1);
      const unit = Number(it.unit_price ?? it.unitPrice ?? 0);
      const rawTax = it.tax_percent ?? it.taxPercent;
      let taxP =
        rawTax != null && String(rawTax).trim() !== ""
          ? Number(rawTax)
          : Number(DEFAULT_QUOTATION_LINE_TAX_PERCENT);
      const safeTax = Number.isNaN(taxP) ? Number(DEFAULT_QUOTATION_LINE_TAX_PERCENT) : taxP;
      const sub = roundMoney(qty * unit);
      const lt =
        it.line_total != null || it.lineTotal != null
          ? Number(it.line_total ?? it.lineTotal)
          : roundMoney(sub * (1 + safeTax / 100));
      rows.push({
        key: String(it.key ?? it.id ?? `ix-${ix}`),
        title: String(it.product_name ?? it.productName ?? "—"),
        qty,
        unit,
        disc: 0,
        lineTotal: lt,
        desc: String(it.description ?? "").trim(),
        taxP: safeTax
      });
    });
  }
  let subEx = 0;
  let taxAmt = 0;
  for (const r of rows) {
    const sub = roundMoney(r.qty * r.unit);
    subEx += sub;
    taxAmt += roundMoney(sub * (r.taxP / 100));
  }
  subEx = roundMoney(subEx);
  taxAmt = roundMoney(taxAmt);
  const dtype = viewRow.discount_type ?? "none";
  const basis = viewRow.discount_basis === "fixed" ? "fixed" : "percent";
  const valStr = viewRow.discount_value ?? "0";
  let discountAmt = 0;
  let discountLabel = "Discount";
  if (dtype !== "none") {
    if (basis === "fixed") {
      discountAmt = roundMoney(parseDiscountValueFixed(valStr));
    } else {
      const p = parseDiscountPercent(valStr);
      discountAmt = roundMoney(subEx * (p / 100));
      discountLabel = `Discount (${p}%)`;
    }
  }
  const grandTotal =
    typeof viewRow.Total === "number" ? viewRow.Total : roundMoney(subEx + taxAmt - discountAmt);
  /* Line-level discount column removed; quote discount only in footer totals. */
  const showDiscountColumn = false;
  return { rows, subEx, taxAmt, discountAmt, discountLabel, grandTotal, dtype, showDiscountColumn };
}

function parseTaxPercentFromLine(line) {
  const t = parseFloat(
    String(line.taxPercent ?? line.tax_percent ?? DEFAULT_QUOTATION_LINE_TAX_PERCENT).replace(
      /[^0-9.-]/g,
      ""
    )
  );
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
  const hasCatalogProductId = line.productId != null && String(line.productId).trim() !== "";
  if (!hasCatalogProductId) {
    if (Number.isNaN(unit) || unit < 0) {
      unit = 0;
    }
    return roundMoney(qty * unit);
  }
  if (useCatalogDefaultUnitPrice && hasCatalogProductId) {
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

function apiQuoteLineHasCatalogId(line) {
  return line.productId != null && String(line.productId).trim() !== "";
}

/** First row is “staging”: ready to commit with + when catalog product or item name is set. */
function stagingRowCommitReadyApi(line) {
  return apiQuoteLineHasCatalogId(line) || String(line.customLabel ?? "").trim() !== "";
}

function stagingRowCommitReadyLocal(line) {
  return String(line.productName ?? "").trim() !== "";
}

/** Valid API form line: linked catalog product or free-text item label. */
function filterValidApiQuoteFormLines(lines) {
  return lines.filter((l) => {
    const label = String(l.customLabel ?? "").trim();
    return apiQuoteLineHasCatalogId(l) || label !== "";
  });
}

function apiFormLineToSavedItem(l, catalogProducts) {
  const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
  const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
  let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
  const desc = String(l.description ?? "").trim();
  const tp = parseTaxPercentFromLine(l);
  if (!apiQuoteLineHasCatalogId(l)) {
    if (Number.isNaN(unit) || unit < 0) {
      unit = 0;
    }
    return {
      product_id: null,
      product_name: String(l.customLabel ?? "").trim(),
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
  return {
    product_id: Number(l.productId),
    quantity,
    unit_price: unit,
    tax_percent: tp,
    ...(desc !== "" ? { description: desc } : {})
  };
}

/**
 * Show "+" when the row has any real input so user can insert a blank line above without losing data.
 * New line is always empty; the current row stays as-is in state.
 */
function quoteLineEligibleForAddAbove(line, useApiProductLines) {
  if (String(line.description ?? "").trim() !== "") {
    return true;
  }
  if (String(line.unitPrice ?? "").trim() !== "") {
    return true;
  }
  const tax = String(line.taxPercent ?? DEFAULT_QUOTATION_LINE_TAX_PERCENT).trim();
  if (tax !== "" && tax !== DEFAULT_QUOTATION_LINE_TAX_PERCENT) {
    return true;
  }
  const qty = String(line.quantity ?? "").trim();
  if (qty !== "" && qty !== "1") {
    return true;
  }
  if (useApiProductLines) {
    return (
      String(line.customLabel ?? "").trim() !== "" || apiQuoteLineHasCatalogId(line)
    );
  }
  return String(line.productName ?? "").trim() !== "";
}

const QuotationList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");

  const auth = useOptionalAuth();
  const tokenFromSession =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(TILLFLOW_SESSION_TOKEN_KEY)
      : null;
  const token = auth?.token ?? tokenFromSession ?? null;
  const tenantFromAuth = auth?.user?.tenant;

  const [quotations, setQuotations] = useState(getInitialQuotationRows);
  const [listLoading, setListLoading] = useState(() => Boolean(token));
  const [listError, setListError] = useState("");
  const listLoadGenRef = useRef(0);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCustomers, setCatalogCustomers] = useState([]);
  const [catalogBillers, setCatalogBillers] = useState([]);
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
      const [prodData, custData, billerData] = await Promise.all([
        listSalesCatalogProductsRequest(token),
        listCustomersRequest(token),
        listBillersRequest(token)
      ]);
      if (gen !== catalogLoadGenRef.current) {
        return;
      }
      setCatalogProducts(prodData.products ?? []);
      setCatalogCustomers(custData.customers ?? []);
      setCatalogBillers(billerData.billers ?? []);
    } catch (e) {
      if (gen !== catalogLoadGenRef.current) {
        return;
      }
      setCatalogProducts([]);
      setCatalogCustomers([]);
      setCatalogBillers([]);
      if (e instanceof TillFlowApiError) {
        setCatalogError(
          e.status === 403
            ? `${e.message} (needs sales.manage for customers / catalog / billers)`
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
  const [addLines, setAddLines] = useState([]);
  const [addCustomerName, setAddCustomerName] = useState("");
  const [addStatus, setAddStatus] = useState("Draft");
  const [addProductImgUrl, setAddProductImgUrl] = useState("");
  const [addCustomerImgUrl, setAddCustomerImgUrl] = useState("");
  const [addClientNote, setAddClientNote] = useState("");
  const [addTermsAndConditions, setAddTermsAndConditions] = useState("");
  const [addQuoteTitle, setAddQuoteTitle] = useState("");
  const [addError, setAddError] = useState("");

  const [editingRowId, setEditingRowId] = useState(null);
  const [editingApiId, setEditingApiId] = useState(null);
  const [editQuoteRef, setEditQuoteRef] = useState("");
  const [editQuotedAt, setEditQuotedAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editLines, setEditLines] = useState([]);
  const [editStatus, setEditStatus] = useState("Draft");
  const [editProductImgUrl, setEditProductImgUrl] = useState("");
  const [editCustomerImgUrl, setEditCustomerImgUrl] = useState("");
  const [editClientNote, setEditClientNote] = useState("");
  const [editTermsAndConditions, setEditTermsAndConditions] = useState("");
  const [editQuoteTitle, setEditQuoteTitle] = useState("");
  const [editError, setEditError] = useState("");
  const [addBillerId, setAddBillerId] = useState("");
  const [addDiscountType, setAddDiscountType] = useState("none");
  const [addDiscountBasis, setAddDiscountBasis] = useState("percent");
  const [addDiscountValue, setAddDiscountValue] = useState("0");
  const [addSalesAgentName, setAddSalesAgentName] = useState("");
  const [editBillerId, setEditBillerId] = useState("");
  const [editDiscountType, setEditDiscountType] = useState("none");
  const [editDiscountBasis, setEditDiscountBasis] = useState("percent");
  const [editDiscountValue, setEditDiscountValue] = useState("0");
  const [editSalesAgentName, setEditSalesAgentName] = useState("");

  const [viewRow, setViewRow] = useState(null);
  const [companyProfileFromApi, setCompanyProfileFromApi] = useState(null);
  const [companyLogosFromApi, setCompanyLogosFromApi] = useState({
    logo: null,
    darkLogo: null
  });

  useEffect(() => {
    if (!token || !inTillflowShell) {
      setCompanyProfileFromApi(null);
      setCompanyLogosFromApi({ logo: null, darkLogo: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [data, uiData] = await Promise.all([
          getTenantCompanyProfileRequest(token),
          getTenantUiSettingsRequest(token)
        ]);
        if (cancelled) {
          return;
        }
        const f = profileApiToForm(data.profile);
        setCompanyProfileFromApi(f);
        saveCompanySettings(f);
        const logos = uiData?.settings?.website?.companyLogos ?? {};
        setCompanyLogosFromApi({
          logo: typeof logos.logo === "string" && logos.logo.trim() ? logos.logo : null,
          darkLogo:
            typeof logos.darkLogo === "string" && logos.darkLogo.trim() ? logos.darkLogo : null
        });
      } catch {
        if (!cancelled) {
          setCompanyProfileFromApi(null);
          setCompanyLogosFromApi({ logo: null, darkLogo: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, inTillflowShell]);

  const companySnapshot = useMemo(() => {
    if (companyProfileFromApi && (companyProfileFromApi.companyName || companyProfileFromApi.email)) {
      return companyProfileFromApi;
    }
    if (tenantFromAuth && (tenantFromAuth.name || tenantFromAuth.company_email)) {
      return profileApiToForm(tenantFromAuth);
    }
    return getCompanySettingsSnapshot();
  }, [companyProfileFromApi, tenantFromAuth, location.pathname, viewRow]);

  const quotationFooter = useMemo(
    () => resolveQuotationFooterFromSnapshot(companySnapshot),
    [companySnapshot]
  );
  const quotationLogoSrc = companyLogosFromApi.logo || "/src/assets/img/logo.svg";
  const quotationLogoDarkSrc = companyLogosFromApi.darkLogo || "/src/assets/img/logo-white.svg";
  const quotationViewPrintRootRef = useRef(null);
  const [quotationFormMode, setQuotationFormMode] = useState("list");
  const [catalogQuickAddKey, setCatalogQuickAddKey] = useState(0);
  const [catalogQuickSearchText, setCatalogQuickSearchText] = useState("");
  const [catalogQuickSuggestions, setCatalogQuickSuggestions] = useState([]);
  const [lineItemsColWidths, setLineItemsColWidths] = useState(
    () => [...QUOTE_LINE_ITEMS_COL_WIDTHS_DEFAULT]
  );
  const [deleteQuoteRef, setDeleteQuoteRef] = useState(null);
  const [deleteRowId, setDeleteRowId] = useState(null);
  const [deleteApiId, setDeleteApiId] = useState(null);
  const [sendPreviewQuote, setSendPreviewQuote] = useState(null);
  const [sendPreviewTo, setSendPreviewTo] = useState("");
  const [sendPreviewCc, setSendPreviewCc] = useState("");
  const [sendPreviewSubject, setSendPreviewSubject] = useState("");
  const [sendPreviewMessage, setSendPreviewMessage] = useState("");
  const [sendPreviewError, setSendPreviewError] = useState("");
  const [sendQuoteBusyId, setSendQuoteBusyId] = useState("");
  const [convertQuoteBusyId, setConvertQuoteBusyId] = useState("");
  /** When true, `/quotations/new` route effect must not call `resetAddForm()` (avoids wiping clone data). */
  const quotationClonePopulateRef = useRef(false);

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
    () => [ALL, ...QUOTATION_CRM_STATUSES.map((s) => ({ label: s, value: s }))],
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

  const catalogBillerPickOptions = useMemo(
    () => [
      PICK_PLACEHOLDER,
      ...catalogBillers.map((b) => ({
        label: `${b.name} (${b.code})`,
        value: String(b.id)
      }))
    ],
    [catalogBillers]
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
          String(r.quoteTitle ?? "").toLowerCase().includes(q) ||
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
    setAddStatus("Draft");
    setAddProductImgUrl("");
    setAddCustomerImgUrl("");
    setAddClientNote("");
    setAddTermsAndConditions("");
    setAddQuoteTitle("");
    setAddBillerId("");
    setAddDiscountType("none");
    setAddDiscountBasis("percent");
    setAddDiscountValue("0");
    setAddSalesAgentName("");
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
    if (inTillflowShell) {
      navigate(TILLFLOW_QUOTATIONS_BASE);
      return;
    }
    setQuotationFormMode("list");
    resetAddForm();
    setEditExpiresAt("");
    setEditClientNote("");
    setEditTermsAndConditions("");
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogQuickAddKey((k) => k + 1);
    setEditingRowId(null);
    setEditingApiId(null);
    setEditError("");
    setEditBillerId("");
    setEditDiscountType("none");
    setEditDiscountBasis("percent");
    setEditDiscountValue("0");
    setEditSalesAgentName("");
    setEditQuoteTitle("");
  }, [inTillflowShell, navigate, resetAddForm]);

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
        const mapped =
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
                  customLabel: String(it.product_name ?? ""),
                  description: String(it.description ?? ""),
                  taxPercent:
                    it.tax_percent != null && String(it.tax_percent) !== ""
                      ? String(it.tax_percent)
                      : DEFAULT_QUOTATION_LINE_TAX_PERCENT
                };
              })
            : [];
        setEditLines(
          inTillflowShell
            ? mapped.length > 0
              ? [emptyApiLine(), ...mapped]
              : [emptyApiLine()]
            : mapped
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
                    : String(it.taxPercent ?? DEFAULT_QUOTATION_LINE_TAX_PERCENT)
              }))
            : []
        );
        setEditCustomerName(String(row.Custmer_Name ?? ""));
      }
      setEditBillerId(
        row.biller_id != null && row.biller_id !== "" ? String(row.biller_id) : ""
      );
      const rowDt = row.discount_type;
      setEditDiscountType(
        rowDt === "before_tax" || rowDt === "after_tax" || rowDt === "none" ? rowDt : "none"
      );
      const rowDb = row.discount_basis;
      setEditDiscountBasis(rowDb === "fixed" ? "fixed" : "percent");
      const rowDv = row.discount_value;
      setEditDiscountValue(
        rowDv != null && String(rowDv) !== "" ? String(rowDv) : "0"
      );
      setEditSalesAgentName(String(row.Biller_Name ?? ""));
      setEditStatus(normalizeQuotationStatus(row.Status));
      setEditProductImgUrl(row.product_image_url ? String(row.product_image_url) : "");
      setEditCustomerImgUrl(row.customer_image_url ? String(row.customer_image_url) : "");
      setEditClientNote(String(row.clientNote ?? ""));
      setEditTermsAndConditions(String(row.termsAndConditions ?? ""));
      setEditQuoteTitle(String(row.quoteTitle ?? ""));
      setEditError("");
      setQuotationFormMode("edit");
    },
    [token, inTillflowShell]
  );

  const openCloneQuotation = useCallback(
    (row) => {
      quotationClonePopulateRef.current = true;
      resetAddForm();
      setAddQuotedAt(new Date().toISOString().slice(0, 10));
      setAddExpiresAt(row.expiresAtIso ?? "");
      setAddCustomerId(
        row.customer_id != null && row.customer_id !== "" ? String(row.customer_id) : ""
      );
      setAddCustomerName(String(row.Custmer_Name ?? ""));
      const src = row.items ?? [];
      if (token) {
        let mapped =
          src.length > 0
            ? src.map((it) => {
                const custom = it.product_id == null || it.product_id === "";
                return {
                  key: it.key ?? newLineKey(),
                  productId: custom ? "" : String(it.product_id),
                  quantity: String(it.quantity ?? 1),
                  unitPrice:
                    it.unit_price != null && String(it.unit_price) !== "" ? String(it.unit_price) : "",
                  customLabel: String(it.product_name ?? ""),
                  description: String(it.description ?? ""),
                  taxPercent:
                    it.tax_percent != null && String(it.tax_percent) !== ""
                      ? String(it.tax_percent)
                      : DEFAULT_QUOTATION_LINE_TAX_PERCENT
                };
              })
            : [];
        if (mapped.length === 0 && String(row.Product_Name ?? "").trim() !== "") {
          mapped = [
            {
              key: newLineKey(),
              productId: "",
              quantity: "1",
              unitPrice:
                typeof row.Total === "number" && row.Total > 0 ? String(row.Total) : "",
              taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT,
              customLabel: String(row.Product_Name ?? "").trim(),
              description: ""
            }
          ];
        }
        setAddLines(
          inTillflowShell
            ? mapped.length > 0
              ? [...mapped, emptyApiLine()]
              : [emptyApiLine()]
            : mapped.length > 0
              ? mapped
              : [emptyApiLine()]
        );
      } else {
        let localMapped =
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
                    : String(it.taxPercent ?? DEFAULT_QUOTATION_LINE_TAX_PERCENT)
              }))
            : [];
        if (localMapped.length === 0 && String(row.Product_Name ?? "").trim() !== "") {
          localMapped = [
            {
              key: newLineKey(),
              productName: String(row.Product_Name ?? "").trim(),
              quantity: "1",
              unitPrice:
                typeof row.Total === "number" && row.Total > 0 ? String(row.Total) : "",
              taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT,
              productImg: stockImg01,
              description: ""
            }
          ];
        }
        setAddLines(localMapped.length > 0 ? localMapped : [emptyLocalLine()]);
      }
      setAddStatus("Draft");
      setAddProductImgUrl(row.product_image_url ? String(row.product_image_url) : "");
      setAddCustomerImgUrl(row.customer_image_url ? String(row.customer_image_url) : "");
      setAddClientNote(String(row.clientNote ?? ""));
      setAddTermsAndConditions(String(row.termsAndConditions ?? ""));
      setAddQuoteTitle(String(row.quoteTitle ?? ""));
      setAddBillerId(
        row.biller_id != null && row.biller_id !== "" ? String(row.biller_id) : ""
      );
      const rowDt = row.discount_type;
      setAddDiscountType(
        rowDt === "before_tax" || rowDt === "after_tax" || rowDt === "none" ? rowDt : "none"
      );
      const rowDb = row.discount_basis;
      setAddDiscountBasis(rowDb === "fixed" ? "fixed" : "percent");
      const rowDv = row.discount_value;
      setAddDiscountValue(
        rowDv != null && String(rowDv) !== "" ? String(rowDv) : "0"
      );
      setAddSalesAgentName(String(row.Biller_Name ?? ""));
      setQuotationFormMode("create");
      if (inTillflowShell) {
        navigate(`${TILLFLOW_QUOTATIONS_BASE}/new`);
      }
    },
    [inTillflowShell, navigate, resetAddForm, token]
  );

  useEffect(() => {
    if (!inTillflowShell) {
      return;
    }
    const norm = location.pathname.replace(/\/$/, "");

    if (norm === `${TILLFLOW_QUOTATIONS_BASE}/new`) {
      if (quotationClonePopulateRef.current) {
        quotationClonePopulateRef.current = false;
        return;
      }
      setQuotationFormMode((m) => {
        if (m === "list") {
          resetAddForm();
          return "create";
        }
        return m;
      });
      return;
    }

    const editRe = new RegExp(
      `^${TILLFLOW_QUOTATIONS_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/edit$`
    );
    const editMatch = norm.match(editRe);
    if (editMatch) {
      const targetId = editMatch[1];
      if (listLoading) {
        return;
      }
      const row = quotations.find((r) => String(r.apiId ?? r.id) === targetId);
      if (!row) {
        navigate(TILLFLOW_QUOTATIONS_BASE, { replace: true });
        return;
      }
      if (quotationFormMode !== "edit" || editingRowId !== row.id) {
        openEditQuotation(row);
      }
      return;
    }

    if (norm === TILLFLOW_QUOTATIONS_BASE) {
      if (quotationFormMode !== "list") {
        setQuotationFormMode("list");
        resetAddForm();
        setEditExpiresAt("");
        setEditClientNote("");
        setEditTermsAndConditions("");
        setCatalogQuickSearchText("");
        setCatalogQuickSuggestions([]);
        setCatalogQuickAddKey((k) => k + 1);
        setEditingRowId(null);
        setEditingApiId(null);
        setEditError("");
        setEditBillerId("");
        setEditDiscountType("none");
        setEditDiscountBasis("percent");
        setEditDiscountValue("0");
        setEditSalesAgentName("");
        setEditQuoteTitle("");
      }
    }
  }, [
    inTillflowShell,
    location.pathname,
    quotations,
    listLoading,
    quotationFormMode,
    editingRowId,
    navigate,
    resetAddForm,
    openEditQuotation
  ]);

  const openViewQuotation = useCallback((row) => {
    setViewRow(row);
  }, []);

  const openDeleteQuotation = useCallback((row) => {
    setDeleteQuoteRef(row.quoteRef);
    setDeleteRowId(row.id);
    setDeleteApiId(row.apiId ?? null);
  }, []);

  const saveNewQuotation = useCallback(async () => {
    setAddError("");
    if (!addQuotedAt) {
      setAddError("Please choose a quote date.");
      return;
    }
    if (addExpiresAt && addQuotedAt && addExpiresAt < addQuotedAt) {
      setAddError("Valid until date must be on or after the quote date.");
      return;
    }

    const productUrl = addProductImgUrl.trim() || null;
    const customerUrl = addCustomerImgUrl.trim() || null;

    if (token) {
      if (!addCustomerId) {
        setAddError("Choose a customer.");
        return;
      }
      const lines = filterValidApiQuoteFormLines(addLines);
      if (lines.length === 0) {
        setAddError("Add at least one line with an item name or pick a product from catalog search.");
        return;
      }
      const totalFilled = roundMoney(
        lines.reduce((s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token)), 0)
      );
      if (totalFilled <= 0) {
        setAddError("Enter valid quantities and prices for each line.");
        return;
      }
      const items = lines.map((l) => apiFormLineToSavedItem(l, catalogProducts));
      try {
        const body = {
          quoted_at: addQuotedAt,
          customer_id: Number(addCustomerId),
          status: "Draft",
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
        body.quote_title = addQuoteTitle.trim() || null;
        body.discount_type = addDiscountType;
        body.discount_basis = addDiscountType === "none" ? "percent" : addDiscountBasis;
        body.discount_value =
          addDiscountType === "none"
            ? null
            : addDiscountBasis === "percent"
              ? parseDiscountPercent(addDiscountValue)
              : roundMoney(parseDiscountValueFixed(addDiscountValue));
        body.biller_id = addBillerId ? Number(addBillerId) : null;
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
        Status: "Draft",
        Total: totalNum,
        clientNote: addClientNote,
        termsAndConditions: addTermsAndConditions,
        quoteTitle: addQuoteTitle.trim() || "",
        biller_id: null,
        Biller_Name: addSalesAgentName.trim(),
        discount_type: addDiscountType,
        discount_basis: addDiscountType === "none" ? "percent" : addDiscountBasis,
        discount_value:
          addDiscountType === "none"
            ? "0"
            : addDiscountBasis === "percent"
              ? String(parseDiscountPercent(addDiscountValue))
              : String(roundMoney(parseDiscountValueFixed(addDiscountValue)))
      };
      setQuotations((prev) => [...prev, row]);
    }

    if (inTillflowShell) {
      navigate(TILLFLOW_QUOTATIONS_BASE);
    } else {
      resetAddForm();
      setQuotationFormMode("list");
    }
  }, [
    addQuotedAt,
    addExpiresAt,
    addLines,
    addCustomerId,
    addCustomerName,
    addQuoteTotal,
    addProductImgUrl,
    addCustomerImgUrl,
    addClientNote,
    addTermsAndConditions,
    addQuoteTitle,
    addBillerId,
    addDiscountType,
    addDiscountBasis,
    addDiscountValue,
    addSalesAgentName,
    quotations,
    resetAddForm,
    token,
    loadQuotations,
    catalogProducts,
    inTillflowShell,
    navigate
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
    if (!QUOTATION_CRM_STATUSES.includes(editStatus)) {
      setEditError("Invalid status.");
      return;
    }
    if (editExpiresAt && editQuotedAt && editExpiresAt < editQuotedAt) {
      setEditError("Valid until date must be on or after the quote date.");
      return;
    }

    const productUrl = editProductImgUrl.trim() || null;
    const customerUrl = editCustomerImgUrl.trim() || null;

    if (token && editingApiId != null) {
      if (!editCustomerId) {
        setEditError("Choose a customer.");
        return;
      }
      const lines = filterValidApiQuoteFormLines(editLines);
      if (lines.length === 0) {
        setEditError("Add at least one line with an item name or pick a product from catalog search.");
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
      const items = lines.map((l) => apiFormLineToSavedItem(l, catalogProducts));
      try {
        await updateQuotationRequest(token, editingApiId, {
          quoted_at: editQuotedAt,
          expires_at: editExpiresAt || null,
          customer_id: Number(editCustomerId),
          status: editStatus,
          items,
          client_note: editClientNote.trim() || null,
          terms_and_conditions: editTermsAndConditions.trim() || null,
          quote_title: editQuoteTitle.trim() || null,
          discount_type: editDiscountType,
          discount_basis: editDiscountType === "none" ? "percent" : editDiscountBasis,
          discount_value:
            editDiscountType === "none"
              ? null
              : editDiscountBasis === "percent"
                ? parseDiscountPercent(editDiscountValue)
                : roundMoney(parseDiscountValueFixed(editDiscountValue)),
          biller_id: editBillerId ? Number(editBillerId) : null
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
      const ref = editQuoteRef.trim();
      if (!ref) {
        setEditError("Quote reference is required.");
        return;
      }
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
                quoteTitle: editQuoteTitle.trim() || "",
                Product_Name: productLabel,
                productsExportLabel: names.join("; "),
                items: builtItems,
                Custmer_Name: cust,
                Status: editStatus,
                Total: totalNum,
                product_image_url: productUrl,
                customer_image_url: customerUrl,
                productImg: builtItems[0]?.productImg ?? resolveMediaUrl(productUrl, r.productImg || stockImg01),
                customerImg: resolveMediaUrl(customerUrl, r.customerImg || user33),
                biller_id: null,
                Biller_Name: editSalesAgentName.trim(),
                discount_type: editDiscountType,
                discount_basis: editDiscountType === "none" ? "percent" : editDiscountBasis,
                discount_value:
                  editDiscountType === "none"
                    ? "0"
                    : editDiscountBasis === "percent"
                      ? String(parseDiscountPercent(editDiscountValue))
                      : String(roundMoney(parseDiscountValueFixed(editDiscountValue)))
              }
            : r
        )
      );
    }

    setEditingRowId(null);
    setEditingApiId(null);
    if (inTillflowShell) {
      navigate(TILLFLOW_QUOTATIONS_BASE);
    } else {
      setQuotationFormMode("list");
    }
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
    editQuoteTitle,
    editBillerId,
    editDiscountType,
    editDiscountBasis,
    editDiscountValue,
    editSalesAgentName,
    quotations,
    token,
    loadQuotations,
    catalogProducts,
    inTillflowShell,
    navigate
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

  const handleSendQuotationToCustomer = useCallback(
    async (row, payload, attachOptions = {}) => {
      if (!token || row?.apiId == null) {
        setListError("Send to email is available for saved quotations only.");
        return;
      }
      setListError("");
      setSendQuoteBusyId(String(row.id ?? row.apiId ?? ""));
      try {
        await sendQuotationToCustomerRequest(token, row.apiId, payload || undefined, attachOptions);
        await loadQuotations();
        return true;
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setListError(e.message);
        } else {
          setListError("Could not send quotation email.");
        }
        return false;
      } finally {
        setSendQuoteBusyId("");
      }
    },
    [token, loadQuotations]
  );

  const handleConvertQuotationToInvoice = useCallback(
    async (row) => {
      if (!token || row?.apiId == null) {
        setListError("Convert to invoice is available for saved quotations only.");
        return;
      }
      const rowKey = String(row.id ?? row.apiId ?? "");
      if (convertQuoteBusyId === rowKey) {
        return;
      }
      setListError("");
      setConvertQuoteBusyId(rowKey);
      try {
        const data = await convertQuotationToInvoiceRequest(token, row.apiId);
        await loadQuotations();
        const invoiceId = data?.invoice?.id;
        if (invoiceId != null) {
          navigate(`/tillflow/admin/invoices/${encodeURIComponent(String(invoiceId))}`);
        } else {
          setListError("Quotation converted, but invoice link is missing.");
        }
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setListError(e.message);
        } else {
          setListError("Could not convert quotation to invoice.");
        }
      } finally {
        setConvertQuoteBusyId("");
      }
    },
    [token, convertQuoteBusyId, loadQuotations, navigate]
  );

  const openSendQuotationPreviewModal = useCallback(
    (row) => {
      const customer = catalogCustomers.find((c) => String(c.id) === String(row.customer_id ?? ""));
      const customerName = String(row.Custmer_Name || customer?.name || "Customer");
      const defaultTo = String(customer?.email || "").trim();
      setSendPreviewQuote(row);
      setSendPreviewTo(defaultTo);
      setSendPreviewCc("");
      setSendPreviewSubject(`Quotation ${row.quoteRef || ""}`.trim());
      setSendPreviewMessage(
        `Hello ${customerName},\n\nPlease find your quotation ${row.quoteRef || "—"} dated ${row.quotedDate || "—"}.\n\nTotal amount: ${typeof row.Total === "number" ? formatQuoteMoneyKes(row.Total) : "Ksh0.00"}.\n\nThank you.`
      );
      setSendPreviewError("");
      showBsModal("send-quotation-preview-modal");
    },
    [catalogCustomers]
  );

  const handleConfirmSendQuotation = useCallback(async () => {
    if (!sendPreviewQuote) {
      return;
    }
    const to = String(sendPreviewTo || "").trim();
    if (!to) {
      setSendPreviewError("Recipient email is required.");
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(to)) {
      setSendPreviewError("Recipient email is invalid.");
      return;
    }
    const ccRaw = String(sendPreviewCc || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (ccRaw.some((mail) => !emailRe.test(mail))) {
      setSendPreviewError("One or more CC email addresses are invalid.");
      return;
    }
    setSendPreviewError("");
    const payload = {
      to,
      cc: ccRaw,
      subject: String(sendPreviewSubject || "").trim(),
      message: String(sendPreviewMessage || "").trim()
    };

    /** Same html2canvas + jsPDF output as modal “Download PDF” (not server Dompdf). */
    let pdfBlob = null;
    if (typeof document !== "undefined") {
      try {
        const vm = buildQuotationViewTableModel(sendPreviewQuote);
        const fmt = inTillflowShell ? formatQuoteMoneyKes : formatMoney;
        const host = document.createElement("div");
        host.setAttribute("aria-hidden", "true");
        Object.assign(host.style, {
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "794px",
          zIndex: "-1",
          pointerEvents: "none",
          opacity: "0",
          overflow: "hidden"
        });
        document.body.appendChild(host);
        const root = createRoot(host);
        let printEl = null;
        flushSync(() => {
          root.render(
            <QuotationPrintDocument
              ref={(el) => {
                printEl = el;
              }}
              viewRow={sendPreviewQuote}
              quotationViewModel={vm}
              companySnapshot={companySnapshot}
              quotationFooter={quotationFooter}
              quotationLogoSrc={quotationLogoSrc}
              quotationLogoDarkSrc={quotationLogoDarkSrc}
              formatMoney={fmt}
            />
          );
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (printEl) {
          await waitForPrintRootImages(printEl);
          await new Promise((r) => setTimeout(r, 120));
          pdfBlob = await quotationDetailPdfBlobFromElement(printEl, {
            quoteRef: sendPreviewQuote.quoteRef
          });
        }
        root.unmount();
        document.body.removeChild(host);
      } catch (e) {
        console.warn("Client PDF for email failed; server Dompdf will be used.", e);
        pdfBlob = null;
      }
    }

    const attachFilename = `quotation-${String(sendPreviewQuote.quoteRef ?? sendPreviewQuote.apiId ?? "quote").replace(/[^\w.-]+/g, "_")}.pdf`;
    const ok = await handleSendQuotationToCustomer(sendPreviewQuote, payload, {
      pdfBlob: pdfBlob instanceof Blob ? pdfBlob : undefined,
      attachmentFilename: attachFilename
    });
    if (ok) {
      hideBsModal("send-quotation-preview-modal");
      setSendPreviewQuote(null);
    }
  }, [
    companySnapshot,
    handleSendQuotationToCustomer,
    inTillflowShell,
    quotationFooter,
    quotationLogoDarkSrc,
    quotationLogoSrc,
    sendPreviewCc,
    sendPreviewMessage,
    sendPreviewQuote,
    sendPreviewSubject,
    sendPreviewTo
  ]);

  const columns = useMemo(
    () => [
      {
        header: "Quote #",
        field: "quoteRef",
        sortable: true,
        body: (row) => (
          <Link
            to="#"
            style={{ color: "#0d6efd" }}
            onClick={(e) => {
              e.preventDefault();
              openViewQuotation(row);
              showBsModal("view-quotation-modal");
            }}>
            {row.quoteRef}
          </Link>
        )
      },
      {
        header: "Title",
        field: "quoteTitle",
        sortable: true,
        body: (rowData) => {
          const t = String(rowData.quoteTitle ?? "").trim();
          return t ? (
            <span className="text-truncate d-inline-block" style={{ maxWidth: 220 }} title={t}>
              {t}
            </span>
          ) : (
            "—"
          );
        }
      },
      { header: "Date", field: "quotedDate", sortable: true },
      {
        header: "Valid until",
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
          typeof rowData.Total === "number"
            ? formatQuoteMoneyKes(rowData.Total)
            : rowData.Total
      },
      {
        header: "Status",
        field: "Status",
        sortable: true,
        body: (rowData) => (
          <span className={`badge ${quotationStatusBadgeClass(rowData.Status)}`}>
            {normalizeQuotationStatus(rowData.Status)}
          </span>
        )
      },
      {
        header: "",
        field: "actions",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action">
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-sm btn-light p-1 d-inline-flex align-items-center justify-content-center dropdown-toggle quotation-list__row-actions-toggle"
                data-bs-toggle="dropdown"
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
                      openViewQuotation(row);
                      showBsModal("view-quotation-modal");
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
                      if (inTillflowShell) {
                        navigate(
                          `${TILLFLOW_QUOTATIONS_BASE}/${encodeURIComponent(String(row.apiId ?? row.id))}/edit`
                        );
                      } else {
                        openEditQuotation(row);
                      }
                    }}>
                    <i className="feather icon-edit me-2" />
                    Edit
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      openCloneQuotation(row);
                    }}>
                    <i className="feather icon-copy me-2" />
                    Clone
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    disabled={convertQuoteBusyId === String(row.id ?? row.apiId ?? "")}
                    onClick={() => {
                      void handleConvertQuotationToInvoice(row);
                    }}>
                    <i className="ti ti-file-invoice me-2" />
                    {convertQuoteBusyId === String(row.id ?? row.apiId ?? "") ? "Converting..." : "Convert to invoice"}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    disabled={sendQuoteBusyId === String(row.id ?? row.apiId ?? "")}
                    onClick={() => {
                      if (sendQuoteBusyId === String(row.id ?? row.apiId ?? "")) return;
                      openSendQuotationPreviewModal(row);
                    }}>
                    <i className="feather icon-mail me-2" />
                    {sendQuoteBusyId === String(row.id ?? row.apiId ?? "") ? "Sending..." : "Send to email"}
                  </button>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item text-danger"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-quotation-modal"
                    onClick={() => {
                      openDeleteQuotation(row);
                    }}>
                    <i className="feather icon-trash-2 me-2" />
                    Delete
                  </button>
                </li>
              </ul>
            </div>
          </div>
        )
      }
    ],
    [
      handleSendQuotationToCustomer,
      handleConfirmSendQuotation,
      handleConvertQuotationToInvoice,
      openCloneQuotation,
      openDeleteQuotation,
      openEditQuotation,
      openSendQuotationPreviewModal,
      openViewQuotation,
      inTillflowShell,
      navigate,
      sendQuoteBusyId,
      convertQuoteBusyId
    ]
  );

  const formIsCreate = quotationFormMode === "create";
  const formLines = formIsCreate ? addLines : editLines;
  const setFormLines = formIsCreate ? setAddLines : setEditLines;
  const useApiProductLines = formIsCreate
    ? Boolean(token)
    : Boolean(token && editingApiId != null);
  const formQuoteTotal = formIsCreate ? addQuoteTotal : editQuoteTotal;
  const formError = formIsCreate ? addError : editError;
  const crmQuotationForm = inTillflowShell && quotationFormMode !== "list";
  const discountFieldsActive =
    (formIsCreate ? addDiscountType : editDiscountType) !== "none";

  const formSubtotalBreakdown = useMemo(() => {
    let subEx = 0;
    let taxAmt = 0;
    for (const l of formLines) {
      const sub = lineSubtotalExTax(l, catalogProducts, useApiProductLines);
      const pct = parseTaxPercentFromLine(l);
      subEx += sub;
      taxAmt += roundMoney(sub * (pct / 100));
    }
    return {
      subtotalExTax: roundMoney(subEx),
      taxTotal: roundMoney(taxAmt)
    };
  }, [formLines, catalogProducts, useApiProductLines]);

  const quotationKesSummary = useMemo(() => {
    const subEx = formSubtotalBreakdown.subtotalExTax;
    const tax = formSubtotalBreakdown.taxTotal;
    const lineTotal = formQuoteTotal;
    const dtype = formIsCreate ? addDiscountType : editDiscountType;
    const basis = formIsCreate ? addDiscountBasis : editDiscountBasis;
    const valStr = formIsCreate ? addDiscountValue : editDiscountValue;

    if (dtype === "none") {
      return {
        subtotalExTax: subEx,
        taxTotal: tax,
        discountPct: 0,
        discountAmt: 0,
        grandTotal: roundMoney(lineTotal),
        discountBasis: "percent"
      };
    }

    if (basis === "fixed") {
      const fix = roundMoney(parseDiscountValueFixed(valStr));
      const discountAmt =
        dtype === "before_tax"
          ? roundMoney(Math.min(fix, subEx))
          : roundMoney(Math.min(fix, lineTotal));
      return {
        subtotalExTax: subEx,
        taxTotal: tax,
        discountPct: null,
        discountAmt,
        grandTotal: roundMoney(Math.max(0, lineTotal - discountAmt)),
        discountBasis: "fixed"
      };
    }

    const pct = parseDiscountPercent(valStr);
    let discountAmt = 0;
    if (dtype === "before_tax") {
      discountAmt = roundMoney(subEx * (pct / 100));
    } else {
      discountAmt = roundMoney(lineTotal * (pct / 100));
    }
    return {
      subtotalExTax: subEx,
      taxTotal: tax,
      discountPct: pct,
      discountAmt,
      grandTotal: roundMoney(Math.max(0, lineTotal - discountAmt)),
      discountBasis: "percent"
    };
  }, [
    formSubtotalBreakdown,
    formQuoteTotal,
    formIsCreate,
    addDiscountType,
    editDiscountType,
    addDiscountBasis,
    editDiscountBasis,
    addDiscountValue,
    editDiscountValue
  ]);

  const quotationViewModel = useMemo(
    () => (viewRow ? buildQuotationViewTableModel(viewRow) : null),
    [viewRow]
  );

  const viewFormatMoney = useCallback(
    (n) => (inTillflowShell ? formatQuoteMoneyKes(n) : formatMoney(n)),
    [inTillflowShell]
  );

  const handleDownloadViewQuotationPdf = useCallback(async () => {
    if (!viewRow || !quotationViewModel) {
      return;
    }
    const root = quotationViewPrintRootRef.current;
    try {
      if (root && root.offsetHeight > 0) {
        await downloadQuotationDetailPdfFromElement(root, { quoteRef: viewRow.quoteRef });
        return;
      }
    } catch (e) {
      console.error("Quotation PDF (layout capture) failed, falling back:", e);
    }
    try {
      await downloadQuotationDetailPdf(viewRow, quotationViewModel, { useKes: inTillflowShell });
    } catch (e2) {
      console.error(e2);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewRow, quotationViewModel, inTillflowShell]);

  const handlePrintViewQuotation = useCallback(() => {
    window.print();
  }, []);

  const handleEditFromViewQuotation = useCallback(() => {
    if (!viewRow) {
      return;
    }
    const row = viewRow;
    hideBsModal("view-quotation-modal");
    if (inTillflowShell) {
      navigate(
        `${TILLFLOW_QUOTATIONS_BASE}/${encodeURIComponent(String(row.apiId ?? row.id))}/edit`
      );
    } else {
      openEditQuotation(row);
    }
  }, [viewRow, inTillflowShell, navigate, openEditQuotation]);

  const handleQuoteLineColResizeMouseDown = useCallback(
    (colIndex) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = lineItemsColWidths[colIndex];
      const minW = colIndex === 0 ? 26 : 48;
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
        if (crmQuotationForm && (from === 0 || to === 0)) {
          return prev;
        }
        const copy = [...prev];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
      });
    },
    [setFormLines, crmQuotationForm]
  );

  /** Legacy / non-CRM: prepend an empty row. CRM uses fixed staging row + commit. */
  const prependFormLine = useCallback(() => {
    setFormLines((p) => [useApiProductLines ? emptyApiLine() : emptyLocalLine(), ...p]);
  }, [setFormLines, useApiProductLines]);

  const appendProductFromCatalogSearch = useCallback(
    (productIdStr) => {
      if (!productIdStr) {
        return;
      }
      const pid = String(productIdStr);
      const p = catalogProducts.find((x) => String(x.id) === pid);
      const price = p?.selling_price != null ? String(p.selling_price) : "";
      const productName = String(p?.name ?? "");
      const useInsertAfterStaging =
        inTillflowShell &&
        quotationFormMode !== "list" &&
        token &&
        (quotationFormMode === "create" || editingApiId != null);
      const merge = (prev) => {
        if (prev.length === 0) {
          return [
            {
              key: newLineKey(),
              productId: pid,
              quantity: "1",
              unitPrice: price,
              customLabel: productName,
              description: "",
              taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT
            }
          ];
        }
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
        const line = {
          key: newLineKey(),
          productId: pid,
          quantity: "1",
          unitPrice: price,
          customLabel: productName,
          description: "",
          taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT
        };
        const first = prev[0];
        const isBlankStarterRow =
          prev.length === 1 &&
          (!String(first.productId ?? "").trim() || first.productId === "") &&
          !String(first.customLabel ?? "").trim() &&
          !String(first.productName ?? "").trim();
        if (isBlankStarterRow) {
          return [
            {
              ...first,
              productId: pid,
              quantity: "1",
              unitPrice: price,
              customLabel: productName,
              description: "",
              taxPercent: DEFAULT_QUOTATION_LINE_TAX_PERCENT
            }
          ];
        }
        if (useInsertAfterStaging) {
          return [...prev, line];
        }
        return [line, ...prev];
      };
      if (quotationFormMode === "create") {
        setAddLines(merge);
      } else {
        setEditLines(merge);
      }
    },
    [
      catalogProducts,
      quotationFormMode,
      inTillflowShell,
      token,
      editingApiId,
      setAddLines,
      setEditLines
    ]
  );

  const commitStagingRow = useCallback(() => {
    if (!crmQuotationForm) {
      return;
    }
    const prev = quotationFormMode === "create" ? addLines : editLines;
    if (prev.length === 0) {
      return;
    }
    const staging = prev[0];
    const ready = useApiProductLines
      ? stagingRowCommitReadyApi(staging)
      : stagingRowCommitReadyLocal(staging);
    if (!ready) {
      showBsModal("quotation-staging-commit-hint-modal");
      return;
    }
    const committed = { ...staging, key: newLineKey() };
    const fresh = useApiProductLines ? emptyApiLine() : emptyLocalLine();
    const next = [fresh, ...prev.slice(1), committed];
    if (quotationFormMode === "create") {
      setAddLines(next);
    } else {
      setEditLines(next);
    }
  }, [
    crmQuotationForm,
    quotationFormMode,
    useApiProductLines,
    addLines,
    editLines,
    setAddLines,
    setEditLines
  ]);

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
                      if (inTillflowShell) {
                        navigate(`${TILLFLOW_QUOTATIONS_BASE}/new`);
                      } else {
                        openCreateQuotationForm();
                      }
                    }}>
                    <PlusCircle size={18} strokeWidth={1.75} className="me-1" aria-hidden />
                    Create Quotation
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
              className={`quotation-form-sheet${crmQuotationForm ? " quotation-form-sheet--crm" : ""}`}
              noValidate
              onSubmit={formIsCreate ? handleAddSubmit : handleEditSubmit}>
              <div className={`page-header border-0 pb-2${crmQuotationForm ? " quotation-crm-header" : ""}`}>
                <div
                  className={`d-flex flex-wrap align-items-start gap-3 justify-content-between${
                    crmQuotationForm ? " w-100" : ""
                  }`}>
                  {crmQuotationForm ? (
                    <>
                      <div className="page-title mb-0 min-w-0 flex-grow-1 pe-2">
                        <h4 className="mb-0">
                          {formIsCreate ? "Create Quotation" : "Edit quotation"}
                        </h4>
                      </div>
                      <button
                        type="button"
                        className="tf-btn tf-btn--secondary quotation-crm-header-back d-inline-flex align-items-center justify-content-center gap-1 flex-shrink-0 align-self-start text-decoration-none"
                        onClick={leaveQuotationForm}>
                        <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                        Back
                      </button>
                    </>
                  ) : (
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
                          {formIsCreate ? "Create Quotation" : "Edit quotation"}
                        </h4>
                        <h6 className="text-muted mb-0 fw-normal mt-1">
                          Customer, dates, line items, and totals — same fields as before, full page layout.
                        </h6>
                      </div>
                    </div>
                  )}
                </div>
                {catalogError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {catalogError}
                  </div>
                ) : null}
              </div>

              <div
                className={`card border-0 shadow-sm mb-3${crmQuotationForm ? " quotation-crm-card" : ""}`}>
                {crmQuotationForm ? (
                  <div className="card-header border-bottom py-3 bg-transparent">
                    <h5 className="mb-0 fw-semibold">Customer &amp; details</h5>
                  </div>
                ) : null}
                <div className="card-body">
                  <div className="row g-3">
                    <div
                      className={
                        !crmQuotationForm ||
                        !token ||
                        (!formIsCreate && editingApiId == null)
                          ? "col-lg-6"
                          : "col-12"
                      }>
                      <div className="row g-3 align-items-end mb-3">
                        <div className="col-12 col-lg-8">
                          <label className="form-label">
                            Quote title
                            <span className="text-muted fw-normal ms-1">(optional)</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Shown on the quote PDF and details view"
                            value={formIsCreate ? addQuoteTitle : editQuoteTitle}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddQuoteTitle(e.target.value)
                                : setEditQuoteTitle(e.target.value)
                            }
                          />
                        </div>
                        <div className="col-12 col-lg-4">
                          {token ? (
                            formIsCreate ? (
                              <>
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
                              </>
                            ) : editingApiId != null ? (
                              <>
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
                              </>
                            ) : (
                              <>
                                <label className="form-label">
                                  Customer name<span className="text-danger ms-1">*</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editCustomerName}
                                  onChange={(e) => setEditCustomerName(e.target.value)}
                                />
                              </>
                            )
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-6 col-lg-4">
                          <label className="form-label">
                            Quote date
                            <span className="text-danger ms-1">*</span>
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
                            Valid until<span className="text-muted fw-normal ms-1">(optional)</span>
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
                          <label className="form-label">Status</label>
                          {formIsCreate ? (
                            <>
                              <input type="text" className="form-control" value="Draft" readOnly disabled />
                              <p className="text-muted small mb-0 mt-1">
                                Status switches to Sent after sending.
                              </p>
                            </>
                          ) : (
                            <select
                              className="form-select"
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}>
                              {QUOTATION_CRM_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {!crmQuotationForm ||
                    !token ||
                    (!formIsCreate && editingApiId == null) ? (
                      <div className="col-lg-6">
                        {!crmQuotationForm ? (
                          <div className="mb-3">
                            <label className="form-label">Quote total</label>
                            <div className="form-control bg-light fw-medium">{formatMoney(formQuoteTotal)}</div>
                          </div>
                        ) : null}
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
                    ) : null}
                  </div>
                  <div className="row g-3 mt-1 pt-3 border-top border-light-subtle">
                    <div
                      className={`col-md-6 ${discountFieldsActive ? "col-lg-3" : "col-lg-6"}`}>
                      <label className="form-label">Sales agent</label>
                      {token ? (
                        <CommonSelect
                          className="w-100"
                          options={catalogBillerPickOptions}
                          value={
                            formIsCreate
                              ? addBillerId === ""
                                ? ""
                                : addBillerId
                              : editBillerId === ""
                                ? ""
                                : editBillerId
                          }
                          onChange={(e) => {
                            const v = e.value;
                            const s = v == null || v === "" ? "" : String(v);
                            if (formIsCreate) {
                              setAddBillerId(s);
                            } else {
                              setEditBillerId(s);
                            }
                          }}
                          placeholder="Sales agent"
                          filter
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional"
                          value={formIsCreate ? addSalesAgentName : editSalesAgentName}
                          onChange={(e) =>
                            formIsCreate
                              ? setAddSalesAgentName(e.target.value)
                              : setEditSalesAgentName(e.target.value)
                          }
                        />
                      )}
                    </div>
                    <div
                      className={`col-md-6 ${discountFieldsActive ? "col-lg-3" : "col-lg-6"}`}>
                      <label className="form-label">Discount type</label>
                      <select
                        className="form-select"
                        value={formIsCreate ? addDiscountType : editDiscountType}
                        onChange={(e) =>
                          formIsCreate
                            ? setAddDiscountType(e.target.value)
                            : setEditDiscountType(e.target.value)
                        }>
                        {DISCOUNT_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {discountFieldsActive ? (
                      <>
                        <div className="col-md-6 col-lg-3">
                          <label className="form-label" htmlFor="quotation-discount-basis">
                            Discount as
                          </label>
                          <select
                            id="quotation-discount-basis"
                            className="form-select"
                            value={formIsCreate ? addDiscountBasis : editDiscountBasis}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddDiscountBasis(e.target.value)
                                : setEditDiscountBasis(e.target.value)
                            }>
                            {DISCOUNT_BASIS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6 col-lg-3">
                          <label className="form-label" htmlFor="quotation-discount-value">
                            {(formIsCreate ? addDiscountBasis : editDiscountBasis) === "fixed"
                              ? "Amount (Ksh)"
                              : "Percent (%)"}
                          </label>
                          <input
                            id="quotation-discount-value"
                            type="number"
                            min={0}
                            max={
                              (formIsCreate ? addDiscountBasis : editDiscountBasis) === "fixed"
                                ? undefined
                                : 100
                            }
                            step="0.01"
                            className="form-control"
                            value={formIsCreate ? addDiscountValue : editDiscountValue}
                            onChange={(e) =>
                              formIsCreate
                                ? setAddDiscountValue(e.target.value)
                                : setEditDiscountValue(e.target.value)
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={`card border-0 shadow-sm mb-3${crmQuotationForm ? " quotation-crm-card" : ""}`}>
                {crmQuotationForm ? (
                  <div className="card-header border-bottom py-3 bg-transparent">
                    <h5 className="mb-0 fw-semibold">Items</h5>
                  </div>
                ) : null}
                <div className="card-body">
                  {useApiProductLines ? (
                    <div
                      className={`row g-2 align-items-end mb-3 pb-3 border-bottom quotation-catalog-add${
                        crmQuotationForm ? " quotation-crm-items-toolbar" : ""
                      }`}>
                      <div className={crmQuotationForm ? "col-12" : "col-lg-8 col-md-7"}>
                        {crmQuotationForm ? (
                          <label
                            className="visually-hidden"
                            htmlFor={`catalog-quick-add-${catalogQuickAddKey}`}>
                            Search products to add items
                          </label>
                        ) : (
                          <label
                            className="form-label mb-1 fw-semibold"
                            htmlFor={`catalog-quick-add-${catalogQuickAddKey}`}>
                            Search catalog & add item
                          </label>
                        )}
                        <div
                          className={
                            crmQuotationForm && useApiProductLines
                              ? "row g-2 g-md-3 align-items-stretch quotation-crm-search-with-action"
                              : ""
                          }>
                          <div
                            className={
                              crmQuotationForm && useApiProductLines
                                ? "col-12 col-md min-w-0"
                                : ""
                            }>
                            <div className="quotation-catalog-search-field">
                              <Search
                                className="quotation-catalog-search-field__icon"
                                size={18}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <AutoComplete
                                key={`catalog-quick-add-${catalogQuickAddKey}`}
                                inputId={`catalog-quick-add-${catalogQuickAddKey}`}
                                value={catalogQuickSearchText}
                                suggestions={catalogQuickSuggestions}
                                completeMethod={catalogQuickComplete}
                                onChange={catalogQuickOnChange}
                                onSelect={catalogQuickOnSelect}
                                field="name"
                                placeholder={
                                  crmQuotationForm
                                    ? "Add items — search or list; + on row 1 commits; drag other rows; new product → new tab"
                                    : "Search by name or SKU, then pick a product…"
                                }
                                className="w-100 quotation-catalog-autocomplete"
                                inputClassName="form-control"
                                appendTo={typeof document !== "undefined" ? document.body : null}
                                minLength={crmQuotationForm ? 0 : 1}
                                dropdown={Boolean(crmQuotationForm)}
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
                          {crmQuotationForm && useApiProductLines ? (
                            <div className="col-12 col-md-auto d-flex justify-content-md-end align-items-center">
                              <Link
                                to="/tillflow/admin/add-product"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tf-btn tf-btn--secondary quotation-crm-add-product-link d-inline-flex align-items-center justify-content-center gap-1 w-100 text-decoration-none text-nowrap"
                                title="Opens in a new browser tab so this quotation stays open. Re-open the product list from the search field after saving if the new item does not appear.">
                                <PlusCircle size={14} strokeWidth={2} aria-hidden />
                                Add new product
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {!crmQuotationForm ? (
                        <div className="col-lg-4 col-md-5">
                          <p className="text-muted small mb-0">
                            Search and pick a catalog product to fill a line (name and price). For anything not
                            in the database, type the item in the <strong>Item</strong> column in the table
                            below. Duplicate catalog picks increase quantity on that line.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {catalogLoading && token ? (
                    <p className="text-muted small mb-2">Loading catalog…</p>
                  ) : null}
                  {!crmQuotationForm ? (
                    <div className="mb-3">
                      <h5 className="mb-0 fw-semibold">Line items</h5>
                      <p className="text-muted small mb-0 mt-1">
                        Drag the grip icon to reorder rows. Drag the right edge of each header cell to resize
                        columns. Long descriptions can be resized vertically from the textarea corner.
                      </p>
                    </div>
                  ) : null}
                  <div className="table-responsive quotation-line-items-scroll">
                    <table className="table table-hover align-middle mb-0 quotation-line-items-table">
                      <colgroup>
                        {lineItemsColWidths.map((w, i) => (
                          <col key={i} style={{ width: w }} />
                        ))}
                      </colgroup>
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="user-select-none position-relative">
                            <span className="visually-hidden">Reorder rows</span>
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(0)}
                            />
                          </th>
                          <th scope="col" className="text-center position-relative user-select-none">
                            #
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(1)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Item
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(2)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            {crmQuotationForm ? "Description" : "Long description"}
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(3)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Qty
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(4)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Rate
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(5)}
                            />
                          </th>
                          <th scope="col" className="position-relative">
                            Tax %
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(6)}
                            />
                          </th>
                          <th scope="col" className="text-end position-relative">
                            Amount
                            <span
                              className="quote-line-col-resize"
                              onMouseDown={handleQuoteLineColResizeMouseDown(7)}
                            />
                          </th>
                          <th scope="col" className="text-end">
                            <span className="visually-hidden">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody onDragOver={onQuoteLineRowDragOver}>
                        {formLines.length === 0 ? (
                          <tr className="quotation-line-item-row quotation-line-item-row--empty">
                            <td colSpan={9} className="text-center text-muted py-4">
                              <p
                                className={`small ${
                                  crmQuotationForm ? "mb-0" : "mb-2 mb-md-3"
                                }`}>
                                {crmQuotationForm
                                  ? useApiProductLines
                                    ? "No lines yet — search above or use + on row 1."
                                    : "No lines yet — use + on row 1."
                                  : useApiProductLines
                                    ? "No line items yet. Use catalog search above or the button below."
                                    : "No line items yet. Use the button below to add a row."}
                              </p>
                              {!crmQuotationForm ? (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                  onClick={prependFormLine}>
                                  <Plus size={18} strokeWidth={2} aria-hidden />
                                  Add line
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                        {formLines.map((line, lineIndex) => (
                          <tr
                            key={line.key}
                            onDragOver={onQuoteLineRowDragOver}
                            onDrop={onQuoteLineRowDrop(line.key)}
                            className="quotation-line-item-row">
                            <td className="qt-line-row-drag align-middle text-center">
                              <span
                                className={`qt-line-drag-handle d-inline-flex align-items-center justify-content-center rounded px-0 py-1${
                                  crmQuotationForm && lineIndex === 0 ? " opacity-50" : ""
                                }`}
                                draggable={!(crmQuotationForm && lineIndex === 0)}
                                title={
                                  crmQuotationForm && lineIndex === 0
                                    ? "First row stays at the top"
                                    : "Drag to reorder"
                                }
                                onDragStart={(e) => {
                                  if (crmQuotationForm && lineIndex === 0) {
                                    e.preventDefault();
                                    return;
                                  }
                                  e.stopPropagation();
                                  e.dataTransfer.setData("text/plain", line.key);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                aria-label={
                                  crmQuotationForm && lineIndex === 0
                                    ? "First row fixed at top"
                                    : "Drag to reorder this row"
                                }>
                                <span className="visually-hidden">
                                  {crmQuotationForm && lineIndex === 0
                                    ? "First row fixed at top"
                                    : "Drag to reorder row"}
                                </span>
                                <Move size={16} strokeWidth={1.75} className="text-secondary" aria-hidden />
                              </span>
                            </td>
                            <td className="align-middle text-center text-muted small tabular-nums">
                              {lineIndex + 1}
                            </td>
                            <td>
                              {useApiProductLines ? (
                                <>
                                  <label className="visually-hidden" htmlFor={`qt-line-item-${line.key}`}>
                                    Item name (type anything not in catalog)
                                  </label>
                                  <textarea
                                    id={`qt-line-item-${line.key}`}
                                    className="form-control qt-line-item-textarea"
                                    rows={2}
                                    placeholder={
                                      crmQuotationForm
                                        ? lineIndex === 0
                                          ? "Draft: type or search, then +"
                                          : "Item / service"
                                        : "Item or service (not in catalog — type here). Use search above for catalog products."
                                    }
                                    value={line.customLabel ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setFormLines((prev) =>
                                        prev.map((l) => {
                                          if (l.key !== line.key) {
                                            return l;
                                          }
                                          let pid = l.productId;
                                          if (pid != null && String(pid).trim() !== "") {
                                            const cat = catalogProducts.find(
                                              (x) => String(x.id) === String(pid)
                                            );
                                            const expected = String(cat?.name ?? "").trim();
                                            if (expected !== "" && v.trim() !== expected) {
                                              pid = "";
                                            }
                                          }
                                          return { ...l, customLabel: v, productId: pid };
                                        })
                                      );
                                    }}
                                  />
                                </>
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
                                className="form-control qt-line-desc-textarea"
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
                                title="Tax % applied to line subtotal (qty × rate)"
                                value={line.taxPercent ?? DEFAULT_QUOTATION_LINE_TAX_PERCENT}
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
                                {crmQuotationForm
                                  ? formatQuoteMoneyKes(
                                      displayLineAmount(
                                        line,
                                        catalogProducts,
                                        useApiProductLines
                                      )
                                    )
                                  : formatMoney(
                                      displayLineAmount(
                                        line,
                                        catalogProducts,
                                        useApiProductLines
                                      )
                                    )}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex align-items-center justify-content-end quotation-line-action-group">
                                {crmQuotationForm && lineIndex === 0 ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0 quotation-line-action-btn"
                                    aria-label="Add first row to the quote"
                                    title="Add to quote (requires item or product on this row)"
                                    onClick={commitStagingRow}>
                                    <Plus size={20} strokeWidth={2} aria-hidden />
                                  </button>
                                ) : null}
                                {!crmQuotationForm && quoteLineEligibleForAddAbove(line, useApiProductLines) ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0 quotation-line-action-btn"
                                    aria-label="Add blank line above this row"
                                    title="Insert empty line above (this row is unchanged)"
                                    onClick={() =>
                                      setFormLines((p) => {
                                        const idx = p.findIndex((l) => l.key === line.key);
                                        const next = useApiProductLines
                                          ? emptyApiLine()
                                          : emptyLocalLine();
                                        if (idx < 0) {
                                          return [...p, next];
                                        }
                                        return [...p.slice(0, idx), next, ...p.slice(idx)];
                                      })
                                    }>
                                    <Plus size={20} strokeWidth={2} aria-hidden />
                                  </button>
                                ) : null}
                                {crmQuotationForm && lineIndex === 0 ? null : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 quotation-line-action-btn"
                                    aria-label="Remove this line"
                                    title="Remove line"
                                    onClick={() =>
                                      setFormLines((p) => p.filter((l) => l.key !== line.key))
                                    }>
                                    <X size={20} strokeWidth={2} aria-hidden />
                                  </button>
                                )}
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

              <div
                className={`card border-0 shadow-sm mb-3${crmQuotationForm ? " quotation-crm-card" : ""}`}>
                {crmQuotationForm ? (
                  <div className="card-header border-bottom py-3 bg-transparent">
                    <h5 className="mb-0 fw-semibold">Notes &amp; terms</h5>
                  </div>
                ) : null}
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="quotation-client-note">
                      {crmQuotationForm ? "Client Note" : "Client note"}
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
                      {crmQuotationForm ? "Terms & Conditions" : "Terms & conditions"}
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

              {crmQuotationForm ? (
                <div className="card border-0 shadow-sm mb-3 quotation-crm-card">
                  <div className="card-body">
                    <div className="row justify-content-end">
                      <div className="col-md-5 col-lg-4">
                        <div className="d-flex justify-content-between border-bottom py-2">
                          <span>Subtotal (ex tax)</span>
                          <span className="fw-medium">
                            {formatQuoteMoneyKes(quotationKesSummary.subtotalExTax)}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between border-bottom py-2">
                          <span>Tax</span>
                          <span className="fw-medium">
                            {formatQuoteMoneyKes(quotationKesSummary.taxTotal)}
                          </span>
                        </div>
                        {quotationKesSummary.discountAmt > 0 ? (
                          <div className="d-flex justify-content-between border-bottom py-2">
                            <span>Discount</span>
                            <span className="fw-medium">
                              −{formatQuoteMoneyKes(quotationKesSummary.discountAmt)}
                            </span>
                          </div>
                        ) : null}
                        <div className="d-flex justify-content-between py-2">
                          <span className="fw-semibold">Total</span>
                          <span className="fw-bold">
                            {formatQuoteMoneyKes(quotationKesSummary.grandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <DocumentFormActions
                    ui={crmQuotationForm ? "tillflow" : "bootstrap"}
                    onCancel={leaveQuotationForm}
                    cancelLabel="Cancel"
                    saveLabel={
                      crmQuotationForm
                        ? formIsCreate
                          ? "Save quotation"
                          : "Update quotation"
                        : formIsCreate
                          ? "Save quotation"
                          : "Save changes"
                    }
                  />
                </div>
              </div>
            </form>
          )}
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade quotation-view-modal" id="view-quotation-modal">
        <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header border-bottom align-items-center flex-wrap gap-2 quotation-view-no-print">
              <div className="add-item d-flex flex-grow-1">
                <div className="page-title mb-0">
                  <h4 className="mb-0">Quotation Details</h4>
                </div>
              </div>
              <ul className="table-top-head mb-0">
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Download PDF"
                    onClick={() => void handleDownloadViewQuotationPdf()}>
                    <img src={pdf} alt="" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Print"
                    onClick={handlePrintViewQuotation}>
                    <i className="feather icon-printer feather-rotate-ccw" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0"
                    title="Edit quote"
                    onClick={handleEditFromViewQuotation}>
                    <Edit2 size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
                <li>
                  <Link to="#" data-bs-toggle="tooltip" data-bs-placement="top" title="Collapse">
                    <i className="feather icon-chevron-up feather-chevron-up" />
                  </Link>
                </li>
              </ul>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body p-0 bg-white">
              {viewRow && quotationViewModel ? (
                <div className="px-3 pt-2 pb-3 quotation-view-modal-body-inner">
                  <div className="page-btn mb-2 quotation-view-no-print d-flex flex-wrap align-items-center gap-2">
                    <Link
                      to={inTillflowShell ? TILLFLOW_QUOTATIONS_BASE : all_routes.quotationlist}
                      className="btn btn-primary"
                      onClick={() => hideBsModal("view-quotation-modal")}>
                      <i className="feather icon-arrow-left me-2" />
                      Back to Quotations
                    </Link>
                    <Link
                      to="#"
                      className="btn btn-outline-primary d-inline-flex align-items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        handleEditFromViewQuotation();
                      }}>
                      <Edit2 size={18} strokeWidth={1.75} className="me-2" aria-hidden />
                      Edit quote
                    </Link>
                  </div>
                  <QuotationPrintDocument
                    ref={quotationViewPrintRootRef}
                    viewRow={viewRow}
                    quotationViewModel={quotationViewModel}
                    companySnapshot={companySnapshot}
                    quotationFooter={quotationFooter}
                    quotationLogoSrc={quotationLogoSrc}
                    quotationLogoDarkSrc={quotationLogoDarkSrc}
                    formatMoney={viewFormatMoney}
                  />
                  <div className="d-flex justify-content-center align-items-center mb-2 flex-wrap gap-2 quotation-view-no-print">
                    <button
                      type="button"
                      className="btn btn-primary d-flex justify-content-center align-items-center"
                      onClick={() => void handleDownloadViewQuotationPdf()}>
                      <i className="ti ti-file-download me-2" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary d-flex justify-content-center align-items-center"
                      onClick={handlePrintViewQuotation}>
                      <i className="ti ti-printer me-2" />
                      Print quotation
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary d-flex justify-content-center align-items-center"
                      onClick={handleEditFromViewQuotation}>
                      <Edit2 size={18} strokeWidth={1.75} className="me-2" aria-hidden />
                      Edit quote
                    </button>
                    <button type="button" className="btn btn-secondary border" data-bs-dismiss="modal">
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div
        className="modal fade tf-hint-modal"
        id="quotation-staging-commit-hint-modal"
        tabIndex={-1}
        aria-labelledby="quotation-staging-commit-hint-title"
        aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content tf-hint-modal__content border-0">
            <div className="modal-body tf-hint-modal__body text-center">
              <div className="tf-hint-modal__icon-wrap" aria-hidden>
                <Plus className="tf-hint-modal__icon" size={26} strokeWidth={2} />
              </div>
              <h4 className="tf-hint-modal__title" id="quotation-staging-commit-hint-title">
                Complete the line first
              </h4>
              <p className="tf-hint-modal__message mb-0">
                Fill in the first row before adding it to the quote — pick a product from the catalog search
                or type an item name, then press <strong className="text-nowrap">+</strong> again.
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

      <div className="modal fade" id="send-quotation-preview-modal">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="mb-0">Email preview</h4>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label mb-1">To</label>
                <input
                  type="email"
                  className="form-control"
                  value={sendPreviewTo}
                  onChange={(e) => setSendPreviewTo(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="mb-3">
                <label className="form-label mb-1">Subject</label>
                <input
                  type="text"
                  className="form-control"
                  value={sendPreviewSubject}
                  onChange={(e) => setSendPreviewSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <label className="form-label mb-1">Message</label>
                <textarea
                  className="form-control"
                  rows={7}
                  value={sendPreviewMessage}
                  onChange={(e) => setSendPreviewMessage(e.target.value)}
                />
              </div>
              {sendPreviewError ? <p className="text-danger small mt-2 mb-0">{sendPreviewError}</p> : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={sendQuoteBusyId === String(sendPreviewQuote?.id ?? sendPreviewQuote?.apiId ?? "")}
                onClick={() => {
                  void handleConfirmSendQuotation();
                }}>
                {sendQuoteBusyId === String(sendPreviewQuote?.id ?? sendPreviewQuote?.apiId ?? "")
                  ? "Sending..."
                  : "Send Email"}
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
