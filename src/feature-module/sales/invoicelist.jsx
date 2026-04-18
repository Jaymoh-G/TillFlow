import { AutoComplete } from "primereact/autocomplete";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ChevronLeft, Move, Plus, PlusCircle, Search } from "react-feather";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DocumentPdfPreviewModal from "../../components/DocumentPdfPreviewModal";
import InvoiceEmailPreviewModal from "../../components/InvoiceEmailPreviewModal";
import CommonFooter from "../../components/footer/commonFooter";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import DocumentFormActions from "../../components/DocumentFormActions";
import { defaultDueAfterIssue } from "../../utils/defaultDocumentValidity";
import { loadSystemSettings } from "../../utils/systemSettingsStorage";
import { downloadInvoicesExcel, downloadInvoicesPdf } from "../../utils/invoiceExport";
import { invoicereportdata } from "../../core/json/invoicereportdata";
import { all_routes } from "../../routes/all_routes";
import { listCategoriesRequest } from "../../tillflow/api/categories";
import { listCustomersRequest } from "../../tillflow/api/customers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import {
  createInvoicePaymentRequest,
  INVOICE_PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
  previewInvoicePaymentReceiptEmailRequest,
  sendInvoicePaymentReceiptToCustomerRequest,
  updateInvoicePaymentRequest
} from "../../tillflow/api/invoicePayments";
import {
  cancelInvoiceRequest,
  createInvoiceRequest,
  listInvoicesRequest,
  previewInvoiceEmailRequest,
  restoreInvoiceRequest,
  sendInvoiceToCustomerRequest,
  showInvoiceRequest,
  updateInvoiceRequest
} from "../../tillflow/api/invoices";
import { listSalesCatalogProductsRequest } from "../../tillflow/api/products";
import {
  buildCategoryFilterValue,
  filterCatalogProducts
} from "../../tillflow/utils/catalogCategoryFilter";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { PERMISSION } from "../../tillflow/auth/permissions";
import ActivityLogModal from "../../tillflow/components/ActivityLogModal";
import { pdf, stockImg01 } from "../../utils/imagepath";
import {
  createHtmlDocumentPdfObjectUrl,
  downloadHtmlDocumentPdfFromElement,
  htmlDocumentPdfBlobFromElement,
  openHtmlDocumentPdfInBrowser,
  waitForPrintRootImages
} from "../../utils/htmlDocumentPdfExport";
import {
  apiFormSalesLineToPayload,
  computeDiscountedGrandTotal,
  DEFAULT_SALES_LINE_TAX_PERCENT,
  displayLineAmount,
  emptyApiSalesLine,
  filterValidApiSalesLines,
  lineSubtotalExTax,
  newLineKey,
  parseTaxPercentFromLine,
  roundMoney,
  stagingRowCommitReadyApi
} from "../../utils/salesDocumentLineItems";
import InvoicePrintDocument from "./InvoicePrintDocument";
import {
  apiInvoiceToRow,
  buildInvoiceViewDocumentData,
  formatInvoiceMoneyKes,
  formatIsoToDisplay,
  formatReceiptPaidAtDisplay,
  INVOICE_STATUSES,
  invoiceSentToCustomerHoverTitle,
  invoiceStatusBadgeClass,
  invoiceWasIssuedToCustomer,
  receiptWasSentToCustomer,
  parseMoneyish,
  parseRowDateFlexible,
  parseRowDateStr,
  taxTotalFromInvoiceLineItems
} from "./invoiceViewHelpers";
import {
  EditInvoicePaymentModal,
  InvoiceReceiptPreviewModal,
  RecordInvoicePaymentModal
} from "./InvoicePaymentModals";

function getInvoiceDefaultDueDays() {
  try {
    const a = loadSystemSettings().automation;
    if (a && typeof a.invoiceDefaultDueDays === "number" && Number.isFinite(a.invoiceDefaultDueDays)) {
      return Math.max(1, Math.min(3650, Math.floor(a.invoiceDefaultDueDays)));
    }
  } catch {
    /* ignore */
  }
  return 21;
}

const TILLFLOW_INVOICES_BASE = "/tillflow/admin/invoices";
const TILLFLOW_SESSION_TOKEN_KEY = "tillflow_sanctum_token";
const STORAGE_KEY = "retailpos_invoices_v1";

const FEATURE_NOT_IMPLEMENTED_BODY =
  "This feature is not implemented yet. It needs backend support (e.g. mail, tracking tables, or credits).";

const DISCOUNT_TYPE_OPTIONS = [
  { label: "No discount", value: "none" },
  { label: "Before tax", value: "before_tax" },
  { label: "After tax", value: "after_tax" }
];

const DISCOUNT_BASIS_OPTIONS = [
  { label: "Percentage", value: "percent" },
  { label: "Fixed amount (Ksh)", value: "fixed" }
];

const RECURRING_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `Every ${i + 1} month${i + 1 === 1 ? "" : "s"}`,
  value: String(i + 1)
}));

function nextInvoiceRefLocal(list) {
  let max = 0;
  for (const r of list) {
    if (String(r?.status ?? "") === "Draft") {
      continue;
    }
    const ref = String(r.invoiceRefStored ?? r.invoiceno ?? "").trim();
    const m = /^INV-(\d{1,})$/i.exec(ref);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `INV-${String(max + 1).padStart(6, "0")}`;
}

/** Persisted / offline rows: show INV-DRAFT for Draft while keeping real ref in invoiceRefStored. */
function normalizeDraftInvoiceRows(rows) {
  if (!Array.isArray(rows)) {
    return rows;
  }
  return rows.map((r) => {
    if (String(r?.status ?? "") !== "Draft") {
      return r;
    }
    const stored = String(r.invoiceRefStored ?? r.invoiceno ?? "").trim();
    return {
      ...r,
      ...(stored ? { invoiceRefStored: stored } : {}),
      invoiceno: "INV-DRAFT"
    };
  });
}

function loadPersistedRows() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function getInitialRows() {
  const persisted = loadPersistedRows();
  if (persisted && persisted.length > 0) {
    return normalizeDraftInvoiceRows(persisted);
  }
  return invoicereportdata.map((r) => ({
    ...r,
    id: String(r.id),
    apiId: null,
    issueAtIso: null,
    dueAtIso: null,
    totalNum: parseMoneyish(r.amount),
    paidNum: parseMoneyish(r.paid),
    items: [],
    taxNum: null
  }));
}

function enrichInvoiceRowCustomers(baseRow, catalogCustomers) {
  if (!baseRow || typeof baseRow !== "object") {
    return baseRow;
  }
  const hasEmail = String(baseRow.customerEmail ?? "").trim() !== "";
  const hasPhone = String(baseRow.customerPhone ?? "").trim() !== "";
  const hasLocation = String(baseRow.customerLocation ?? "").trim() !== "";
  if (hasEmail && hasPhone && hasLocation) {
    return baseRow;
  }
  const matchById = String(baseRow.customerId ?? "").trim();
  let customerMatch = null;
  if (matchById) {
    customerMatch = (catalogCustomers ?? []).find((c) => String(c.id) === matchById) ?? null;
  }
  if (!customerMatch) {
    const name = String(baseRow.customer ?? "").trim().toLowerCase();
    if (name) {
      customerMatch =
        (catalogCustomers ?? []).find((c) => String(c.name ?? "").trim().toLowerCase() === name) ?? null;
    }
  }
  if (!customerMatch) {
    return baseRow;
  }
  return {
    ...baseRow,
    customerId: String(baseRow.customerId ?? customerMatch.id ?? ""),
    customerEmail: String(baseRow.customerEmail ?? "").trim() || String(customerMatch.email ?? ""),
    customerPhone: String(baseRow.customerPhone ?? "").trim() || String(customerMatch.phone ?? ""),
    customerLocation:
      String(baseRow.customerLocation ?? "").trim() || String(customerMatch.location ?? "")
  };
}

const Invoice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { invoiceId: editRouteInvoiceId } = useParams();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const route = all_routes;

  const auth = useOptionalAuth();
  const canViewActivityLog = Boolean(auth?.hasPermission?.(PERMISSION.ACTIVITY_LOGS_VIEW));
  const tokenFromSession =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(TILLFLOW_SESSION_TOKEN_KEY)
      : null;
  const token = auth?.token ?? tokenFromSession ?? null;

  const [invoices, setInvoices] = useState(getInitialRows);
  const [listLoading, setListLoading] = useState(() => Boolean(token && inTillflowShell));
  const [listError, setListError] = useState("");
  const listGenRef = useRef(0);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("");
  const [catalogCustomers, setCatalogCustomers] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const catalogGenRef = useRef(0);

  const persistSkipRef = useRef(true);

  useEffect(() => {
    if (!inTillflowShell) {
      return;
    }
    if (persistSkipRef.current) {
      persistSkipRef.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
    } catch {
      /* quota */
    }
  }, [invoices, inTillflowShell]);

  const loadCatalog = useCallback(async () => {
    if (!token) {
      return;
    }
    const gen = ++catalogGenRef.current;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const [prodData, custData, categoryData] = await Promise.all([
        listSalesCatalogProductsRequest(token),
        listCustomersRequest(token),
        listCategoriesRequest(token)
      ]);
      if (gen !== catalogGenRef.current) {
        return;
      }
      setCatalogProducts(prodData.products ?? []);
      setCatalogCategories(categoryData.categories ?? []);
      setCatalogCustomers(custData.customers ?? []);
    } catch (e) {
      if (gen !== catalogGenRef.current) {
        return;
      }
      setCatalogProducts([]);
      setCatalogCategories([]);
      setCatalogCustomers([]);
      if (e instanceof TillFlowApiError) {
        setCatalogError(e.status === 403 ? `${e.message} (needs catalog access)` : e.message);
      } else {
        setCatalogError("Could not load products or customers.");
      }
    } finally {
      if (gen === catalogGenRef.current) {
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

  const loadInvoiceList = useCallback(async () => {
    if (!token) {
      return;
    }
    const gen = ++listGenRef.current;
    setListLoading(true);
    setListError("");
    try {
      const data = await listInvoicesRequest(token);
      if (gen !== listGenRef.current) {
        return;
      }
      const apiRows = (data.invoices ?? []).map(apiInvoiceToRow);
      if (apiRows.length > 0) {
        setInvoices(apiRows);
      }
    } catch (e) {
      if (gen !== listGenRef.current) {
        return;
      }
      if (e instanceof TillFlowApiError && e.status === 404) {
        setListError("");
      } else if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message}` : e.message);
      } else {
        setListError("");
      }
    } finally {
      if (gen === listGenRef.current) {
        setListLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!token || !inTillflowShell) {
      return;
    }
    loadInvoiceList();
  }, [token, inTillflowShell, loadInvoiceList]);

  const [invoiceFormMode, setInvoiceFormMode] = useState("list");
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingInvoiceApiId, setEditingInvoiceApiId] = useState(null);

  const [invInvoiceRef, setInvInvoiceRef] = useState("");
  const [invTitle, setInvTitle] = useState("");
  const [invIssueAt, setInvIssueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [invDueAt, setInvDueAt] = useState(() =>
    defaultDueAfterIssue(new Date().toISOString().slice(0, 10), getInvoiceDefaultDueDays())
  );
  const [invCustomerId, setInvCustomerId] = useState("");
  const [invAmountPaid, setInvAmountPaid] = useState("0");
  const [invCreateStatus, setInvCreateStatus] = useState("Draft");
  const [invEditStatus, setInvEditStatus] = useState("Draft");
  const [invInitialPaymentMethod, setInvInitialPaymentMethod] = useState("cash");
  const [invIsRecurring, setInvIsRecurring] = useState(false);
  const [invRecurringChoice, setInvRecurringChoice] = useState("1");
  const [invRecurringCustomEvery, setInvRecurringCustomEvery] = useState("13");
  const [invRecurringCustomUnit, setInvRecurringCustomUnit] = useState("month");
  const [editingHasPayments, setEditingHasPayments] = useState(false);
  const [invLines, setInvLines] = useState(() => [emptyApiSalesLine()]);
  const [invDiscountType, setInvDiscountType] = useState("none");
  const [invDiscountBasis, setInvDiscountBasis] = useState("percent");
  const [invDiscountValue, setInvDiscountValue] = useState("0");
  const [invError, setInvError] = useState("");
  const [invPopupError, setInvPopupError] = useState("");
  const [invPopupSuccess, setInvPopupSuccess] = useState("");
  const [invoiceCancelConfirmRow, setInvoiceCancelConfirmRow] = useState(null);
  const [invoiceCancelSaving, setInvoiceCancelSaving] = useState(false);
  const [invoiceRestoreConfirmRow, setInvoiceRestoreConfirmRow] = useState(null);
  const [invoiceRestoreSaving, setInvoiceRestoreSaving] = useState(false);
  const [invoiceEmailPreviewOpen, setInvoiceEmailPreviewOpen] = useState(false);
  const [invoiceEmailPreviewRow, setInvoiceEmailPreviewRow] = useState(null);
  const [invoiceEmailPreviewSubject, setInvoiceEmailPreviewSubject] = useState("");
  const [invoiceEmailPreviewHtml, setInvoiceEmailPreviewHtml] = useState("");
  const [invoiceEmailPreviewTo, setInvoiceEmailPreviewTo] = useState("");
  const [invoiceEmailPreviewMessage, setInvoiceEmailPreviewMessage] = useState("");
  const [invoiceEmailPreviewLoading, setInvoiceEmailPreviewLoading] = useState(false);
  const [invoiceEmailPreviewError, setInvoiceEmailPreviewError] = useState("");
  const [invoiceEmailPreviewSending, setInvoiceEmailPreviewSending] = useState(false);
  const [invoiceEmailPreviewSource, setInvoiceEmailPreviewSource] = useState("invoice");
  const [invoiceEmailPreviewPaymentId, setInvoiceEmailPreviewPaymentId] = useState(null);
  const [invSaving, setInvSaving] = useState(false);
  const [catalogQuickSearchText, setCatalogQuickSearchText] = useState("");
  const [catalogQuickSuggestions, setCatalogQuickSuggestions] = useState([]);
  const [catalogQuickAddKey, setCatalogQuickAddKey] = useState(0);
  const editRouteLoadRef = useRef("");

  const resetCreateForm = useCallback(() => {
    setInvInvoiceRef("");
    setInvTitle("");
    const issued = new Date().toISOString().slice(0, 10);
    setInvIssueAt(issued);
    setInvDueAt(defaultDueAfterIssue(issued, getInvoiceDefaultDueDays()));
    setInvCustomerId("");
    setInvAmountPaid("0");
    setInvCreateStatus("Draft");
    setInvEditStatus("Draft");
    setInvInitialPaymentMethod("cash");
    setInvIsRecurring(false);
    setInvRecurringChoice("1");
    setInvRecurringCustomEvery("13");
    setInvRecurringCustomUnit("month");
    setEditingHasPayments(false);
    setInvLines([emptyApiSalesLine()]);
    setInvDiscountType("none");
    setInvDiscountBasis("percent");
    setInvDiscountValue("0");
    setInvError("");
    setEditingInvoiceId(null);
    setEditingInvoiceApiId(null);
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
    setCatalogCategoryFilter("");
    setCatalogQuickAddKey((k) => k + 1);
  }, []);

  const leaveCreateForm = useCallback(() => {
    resetCreateForm();
    setInvoiceFormMode("list");
    if (inTillflowShell) {
      navigate(TILLFLOW_INVOICES_BASE);
    }
  }, [inTillflowShell, navigate, resetCreateForm]);

  useEffect(() => {
    if (!inTillflowShell) {
      return;
    }
    const norm = location.pathname.replace(/\/$/, "");
    if (norm === `${TILLFLOW_INVOICES_BASE}/new`) {
      setInvoiceFormMode((m) => {
        if (m === "list") {
          resetCreateForm();
          setInvInvoiceRef((prev) => prev || nextInvoiceRefLocal(invoices));
          return "create";
        }
        return m;
      });
      return;
    }
    if (norm === TILLFLOW_INVOICES_BASE) {
      setInvoiceFormMode((m) => {
        if (m === "create" || m === "edit") {
          resetCreateForm();
        }
        return "list";
      });
    }
  }, [inTillflowShell, location.pathname, invoices, resetCreateForm]);

  const customerPickOptions = useMemo(() => {
    return (catalogCustomers ?? []).map((c) => ({
      label: String(c.name ?? ""),
      value: String(c.id)
    }));
  }, [catalogCustomers]);

  const lineTotalPreDiscount = useMemo(
    () =>
      roundMoney(
        invLines.reduce((s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token)), 0)
      ),
    [invLines, catalogProducts, token]
  );

  const formSubtotalBreakdown = useMemo(() => {
    let subEx = 0;
    let taxAmt = 0;
    for (const l of invLines) {
      const sub = lineSubtotalExTax(l, catalogProducts, Boolean(token));
      const pct = parseTaxPercentFromLine(l);
      subEx += sub;
      taxAmt += roundMoney(sub * (pct / 100));
    }
    return { subtotalExTax: roundMoney(subEx), taxTotal: roundMoney(taxAmt) };
  }, [invLines, catalogProducts, token]);

  const invoiceKesSummary = useMemo(
    () =>
      computeDiscountedGrandTotal(
        formSubtotalBreakdown,
        lineTotalPreDiscount,
        invDiscountType,
        invDiscountBasis,
        invDiscountValue
      ),
    [formSubtotalBreakdown, lineTotalPreDiscount, invDiscountType, invDiscountBasis, invDiscountValue]
  );

  const autoPaymentStatus = useCallback((baseStatus, paidAmount, grandAmount) => {
    const paid = Number(paidAmount ?? 0);
    const grand = Number(grandAmount ?? 0);
    if (!Number.isFinite(paid) || paid <= 0 || !Number.isFinite(grand) || grand <= 0) {
      return baseStatus;
    }
    return paid >= grand ? "Paid" : "Partially_paid";
  }, []);

  useEffect(() => {
    if (editingHasPayments) {
      return;
    }
    const paidRaw = Math.max(0, Number(String(invAmountPaid).replace(/[^0-9.-]/g, "")) || 0);
    const paid = roundMoney(Math.min(paidRaw, invoiceKesSummary.grandTotal));
    if (invoiceFormMode === "edit") {
      setInvEditStatus((prev) => autoPaymentStatus(prev, paid, invoiceKesSummary.grandTotal));
    } else if (invoiceFormMode === "create") {
      setInvCreateStatus((prev) => autoPaymentStatus(prev, paid, invoiceKesSummary.grandTotal));
    }
  }, [invAmountPaid, invoiceKesSummary.grandTotal, invoiceFormMode, editingHasPayments, autoPaymentStatus]);

  const appendProductFromCatalog = useCallback(
    (productIdStr) => {
      if (!productIdStr) {
        return;
      }
      const pid = String(productIdStr);
      const p = catalogProducts.find((x) => String(x.id) === pid);
      const price = p?.selling_price != null ? String(p.selling_price) : "";
      const productName = String(p?.name ?? "");
      setInvLines((prev) => {
        if (prev.length === 0) {
          return [
            {
              key: newLineKey(),
              productId: pid,
              quantity: "1",
              unitPrice: price,
              customLabel: productName,
              description: "",
              taxPercent: DEFAULT_SALES_LINE_TAX_PERCENT
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
          taxPercent: DEFAULT_SALES_LINE_TAX_PERCENT
        };
        const first = prev[0];
        const blankStarter =
          prev.length === 1 &&
          (!String(first.productId ?? "").trim() || first.productId === "") &&
          !String(first.customLabel ?? "").trim();
        if (blankStarter) {
          return [
            {
              ...first,
              productId: pid,
              quantity: "1",
              unitPrice: price,
              customLabel: productName,
              description: "",
              taxPercent: DEFAULT_SALES_LINE_TAX_PERCENT
            }
          ];
        }
        return [...prev, line];
      });
    },
    [catalogProducts]
  );

  const catalogQuickComplete = useCallback(
    (e) => {
      if (!catalogProducts.length) {
        setCatalogQuickSuggestions([]);
        return;
      }
      const filtered = filterCatalogProducts(catalogProducts, {
        query: e.query,
        categoryFilterValue: catalogCategoryFilter,
        limit: 80
      });
      setCatalogQuickSuggestions(filtered);
    },
    [catalogProducts, catalogCategoryFilter]
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

  const commitStagingRow = useCallback(() => {
    if (invLines.length === 0) {
      return;
    }
    const staging = invLines[0];
    if (!stagingRowCommitReadyApi(staging)) {
      window.alert("Add an item name or pick a catalog product on row 1, then press +.");
      return;
    }
    const committed = { ...staging, key: newLineKey() };
    const fresh = emptyApiSalesLine();
    setInvLines([fresh, ...invLines.slice(1), committed]);
  }, [invLines]);

  const onRowDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onRowDrop = useCallback((targetKey) => (e) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData("text/plain");
    if (!fromKey || fromKey === targetKey) {
      return;
    }
    setInvLines((prev) => {
      const from = prev.findIndex((x) => x.key === fromKey);
      const to = prev.findIndex((x) => x.key === targetKey);
      if (from < 0 || to < 0 || from === 0 || to === 0) {
        return prev;
      }
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }, []);

  const invPopupTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (invPopupTimerRef.current) {
        window.clearTimeout(invPopupTimerRef.current);
      }
    };
  }, []);

  const showInvPopupError = useCallback((message) => {
    setInvPopupSuccess("");
    setInvPopupError(String(message ?? "").trim());
    if (invPopupTimerRef.current) {
      window.clearTimeout(invPopupTimerRef.current);
    }
    invPopupTimerRef.current = window.setTimeout(() => {
      setInvPopupError("");
      invPopupTimerRef.current = null;
    }, 2600);
  }, []);

  const showInvPopupSuccess = useCallback((message) => {
    setInvPopupError("");
    setInvPopupSuccess(String(message ?? "").trim());
    if (invPopupTimerRef.current) {
      window.clearTimeout(invPopupTimerRef.current);
    }
    invPopupTimerRef.current = window.setTimeout(() => {
      setInvPopupSuccess("");
      invPopupTimerRef.current = null;
    }, 4500);
  }, []);

  const handleCreateSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setInvError("");
      if (!token) {
        showInvPopupError("Sign in to TillFlow to create invoices.");
        return;
      }
      if (!invCustomerId) {
        showInvPopupError("Customer is required.");
        return;
      }
      if (!invIssueAt) {
        showInvPopupError("Issue date is required.");
        return;
      }
      if (invDueAt && invDueAt < invIssueAt) {
        showInvPopupError("Due date cannot be before the issue date.");
        return;
      }
      let recurringEvery = 1;
      let recurringUnit = "month";
      if (invIsRecurring) {
        const rawEvery = invRecurringChoice === "custom" ? Number(invRecurringCustomEvery) : Number(invRecurringChoice);
        recurringEvery = Number.isFinite(rawEvery) && rawEvery > 0 ? Math.floor(rawEvery) : 0;
        recurringUnit = invRecurringChoice === "custom" ? invRecurringCustomUnit : "month";
        if (recurringEvery <= 0) {
          showInvPopupError("Recurring interval must be at least 1.");
          return;
        }
      }
      const validLines = filterValidApiSalesLines(invLines);
      if (validLines.length === 0) {
        showInvPopupError("add atleast one item");
        return;
      }
      const grand = invoiceKesSummary.grandTotal;
      const paidRaw = Math.max(0, Number(String(invAmountPaid).replace(/[^0-9.-]/g, "")) || 0);
      const paid = roundMoney(Math.min(paidRaw, grand));

      const items = validLines.map((l) => apiFormSalesLineToPayload(l, catalogProducts));
      const selectedStatus = invoiceFormMode === "edit" ? invEditStatus : invCreateStatus;
      const effectiveStatus = autoPaymentStatus(selectedStatus, paid, grand);
      const invoiceRef =
        String(effectiveStatus) === "Draft"
          ? null
          : String(invInvoiceRef || "").trim() || nextInvoiceRefLocal(invoices);
      const cust = catalogCustomers.find((c) => String(c.id) === String(invCustomerId));
      const customerName = String(cust?.name ?? "");
      const customerEmail = String(cust?.email ?? "");
      const customerPhone = String(cust?.phone ?? "");
      const customerLocation = String(cust?.location ?? "");
      const body = {
        invoice_ref: invoiceRef,
        invoice_title: String(invTitle || "").trim() || null,
        issued_at: invIssueAt,
        due_at: invDueAt || null,
        customer_id: Number(invCustomerId),
        status: effectiveStatus,
        discount_type: invDiscountType,
        discount_basis: invDiscountBasis,
        discount_value:
          invDiscountType === "none" ? null : Number(invDiscountValue.replace(/,/g, "")) || 0,
        items
      };
      if (invIsRecurring) {
        body.is_recurring = true;
        body.recurring_interval_value = recurringEvery;
        body.recurring_interval_unit = recurringUnit;
      } else {
        body.is_recurring = false;
      }
      const isEditing = invoiceFormMode === "edit";
      const editingApiIdStr = editingInvoiceApiId != null ? String(editingInvoiceApiId) : "";

      if (!isEditing || !editingHasPayments) {
        body.amount_paid = paid;
      }
      if (!isEditing && paid > 0) {
        body.initial_payment_method = invInitialPaymentMethod;
      }

      setInvSaving(true);
      try {
        if (isEditing && editingApiIdStr) {
          const data = await updateInvoiceRequest(token, editingApiIdStr, body);
          const updated = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
          if (updated) {
            const title = String(invTitle || "").trim();
            const rowOut = {
              ...updated,
              id: String(updated.id),
              invoiceTitle: title || updated.invoiceTitle,
              taxNum: taxTotalFromInvoiceLineItems(updated.items)
            };
            setInvoices((prev) =>
              prev.map((r) => (String(r.apiId ?? r.id) === editingApiIdStr ? rowOut : r))
            );
          }
        } else {
          const data = await createInvoiceRequest(token, body);
          const row = apiInvoiceToRow(data.invoice);
          if (!String(row.invoiceTitle ?? "").trim()) {
            row.invoiceTitle = String(invTitle || "").trim();
          }
          setInvoices((prev) => [row, ...prev.filter((r) => String(r.apiId ?? r.id) !== String(row.apiId))]);
        }
      } catch (err) {
        const due = roundMoney(grand - paid);
        const rowStatusOffline = effectiveStatus;
        const localRow = {
          id: isEditing ? String(editingInvoiceId ?? `local-${Date.now()}`) : `local-${Date.now()}`,
          apiId: null,
          invoiceno: rowStatusOffline === "Draft" ? "INV-DRAFT" : invoiceRef,
          invoiceRefStored: rowStatusOffline === "Draft" ? "" : invoiceRef,
          image: cust?.avatar_url ? String(cust.avatar_url) : stockImg01,
          customer: customerName,
          customerId: String(invCustomerId),
          customerEmail,
          customerPhone,
          customerLocation,
          issueDate: formatIsoToDisplay(invIssueAt),
          issueAtIso: invIssueAt,
          duedate: invDueAt ? formatIsoToDisplay(invDueAt) : "—",
          dueAtIso: invDueAt || "",
          amount: formatInvoiceMoneyKes(grand),
          paid: formatInvoiceMoneyKes(paid),
          amountdue: formatInvoiceMoneyKes(due),
          status: rowStatusOffline,
          totalNum: grand,
          paidNum: paid,
          invoiceTitle: String(invTitle || "").trim(),
          taxNum: invoiceKesSummary.taxTotal,
          isRecurring: invIsRecurring,
          recurringEveryMonths: invIsRecurring ? recurringEvery : 1,
          recurringIntervalUnit: invIsRecurring ? recurringUnit : "month",
          createdAtTs: Date.now()
        };
        if (isEditing) {
          setInvoices((prev) =>
            prev.map((r) => (String(r.id) === String(editingInvoiceId ?? "") ? { ...r, ...localRow } : r))
          );
        } else {
          setInvoices((prev) => [localRow, ...prev]);
        }
        if (err instanceof TillFlowApiError) {
          setListError(
            isEditing
              ? `Updated locally — API unavailable (${err.message}).`
              : `Saved locally — API unavailable (${err.message}). Connect /invoices when the backend is ready.`
          );
        }
      } finally {
        setInvSaving(false);
        leaveCreateForm();
      }
    },
    [
      token,
      invCustomerId,
      invIssueAt,
      invDueAt,
      invLines,
      invoiceKesSummary,
      invAmountPaid,
      invIsRecurring,
      invRecurringChoice,
      invRecurringCustomEvery,
      invRecurringCustomUnit,
      invCreateStatus,
      invEditStatus,
      invInitialPaymentMethod,
      editingHasPayments,
      invInvoiceRef,
      invDiscountType,
      invDiscountBasis,
      invDiscountValue,
      invTitle,
      autoPaymentStatus,
      invoiceFormMode,
      editingInvoiceApiId,
      editingInvoiceId,
      catalogProducts,
      catalogCustomers,
      invoices,
      leaveCreateForm,
      showInvPopupError
    ]
  );

  const openCreate = useCallback(() => {
    resetCreateForm();
    setInvCreateStatus("Draft");
    setInvInvoiceRef(nextInvoiceRefLocal(invoices));
    setInvoiceFormMode("create");
    if (inTillflowShell) {
      navigate(`${TILLFLOW_INVOICES_BASE}/new`);
    }
  }, [inTillflowShell, navigate, resetCreateForm, invoices]);

  const openEditInvoice = useCallback((row) => {
    if (!row) {
      return;
    }
    const matchedCustomer =
      (catalogCustomers ?? []).find((c) => String(c.id) === String(row.customerId ?? "")) ??
      (catalogCustomers ?? []).find(
        (c) => String(c.name ?? "").trim().toLowerCase() === String(row.customer ?? "").trim().toLowerCase()
      ) ??
      null;
    const editCustomerId = matchedCustomer ? String(matchedCustomer.id) : "";

    const mappedLines = Array.isArray(row.items)
      ? row.items.map((it) => ({
          key: newLineKey(),
          productId: it.product_id != null ? String(it.product_id) : "",
          quantity: String(it.quantity ?? "1"),
          unitPrice: String(it.unit_price ?? ""),
          customLabel: String(it.product_name ?? it.name ?? ""),
          description: String(it.description ?? ""),
          taxPercent: String(it.tax_percent ?? DEFAULT_SALES_LINE_TAX_PERCENT)
        }))
      : [];
    const normalizedLines = mappedLines.length > 0 ? mappedLines : [emptyApiSalesLine()];

    setEditingInvoiceId(String(row.id ?? ""));
    setEditingInvoiceApiId(row.apiId ?? null);
    setInvInvoiceRef(String(row.invoiceRefStored ?? row.invoiceno ?? "").trim());
    setInvTitle(String(row.invoiceTitle ?? ""));
    setInvIssueAt(String(row.issueAtIso ?? "").trim() || new Date().toISOString().slice(0, 10));
    setInvDueAt(String(row.dueAtIso ?? ""));
    setInvCustomerId(editCustomerId);
    setInvAmountPaid(String(Number(row.paidNum ?? 0)));
    const pc = Number(row.paymentCount ?? row.payments?.length ?? 0);
    setEditingHasPayments(Boolean(token && pc > 0));
    setInvEditStatus(String(row.status ?? "Draft"));
    setInvLines(normalizedLines);
    setInvDiscountType(String(row.discountType ?? "none"));
    setInvDiscountBasis(String(row.discountBasis ?? "percent"));
    setInvDiscountValue(String(row.discountValue ?? "0"));
    const editRecurringEvery = Number(row.recurringEveryMonths ?? 1);
    const normalizedRecurringEvery =
      Number.isFinite(editRecurringEvery) && editRecurringEvery > 0 ? Math.floor(editRecurringEvery) : 1;
    const normalizedRecurringUnit = ["day", "week", "month"].includes(String(row.recurringIntervalUnit ?? "month"))
      ? String(row.recurringIntervalUnit ?? "month")
      : "month";
    const useCustomRecurringChoice = normalizedRecurringUnit !== "month" || normalizedRecurringEvery > 12;
    setInvIsRecurring(Boolean(row.isRecurring));
    setInvRecurringChoice(useCustomRecurringChoice ? "custom" : String(normalizedRecurringEvery));
    setInvRecurringCustomEvery(String(normalizedRecurringEvery));
    setInvRecurringCustomUnit(normalizedRecurringUnit);
    setInvError("");
    setInvoiceFormMode("edit");
  }, [catalogCustomers, token]);

  useEffect(() => {
    if (!inTillflowShell) {
      editRouteLoadRef.current = "";
      return;
    }
    const norm = location.pathname.replace(/\/$/, "");
    const onEditPath = Boolean(editRouteInvoiceId) && norm === `${TILLFLOW_INVOICES_BASE}/${editRouteInvoiceId}/edit`;
    if (!onEditPath) {
      editRouteLoadRef.current = "";
      return;
    }
    if (!token || !editRouteInvoiceId) {
      return;
    }
    if (editRouteLoadRef.current === editRouteInvoiceId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await showInvoiceRequest(token, editRouteInvoiceId);
        if (cancelled) {
          return;
        }
        if (!data?.invoice) {
          editRouteLoadRef.current = "";
          navigate(TILLFLOW_INVOICES_BASE);
          return;
        }
        const baseRow = apiInvoiceToRow(data.invoice);
        const row = enrichInvoiceRowCustomers(baseRow, catalogCustomers);
        if (String(row.status ?? "").trim() === "Cancelled") {
          editRouteLoadRef.current = "";
          navigate(TILLFLOW_INVOICES_BASE);
          showInvPopupError("Cancelled invoices cannot be edited.");
          return;
        }
        editRouteLoadRef.current = editRouteInvoiceId;
        openEditInvoice(row);
      } catch (err) {
        if (cancelled) {
          return;
        }
        editRouteLoadRef.current = "";
        if (err instanceof TillFlowApiError) {
          showInvPopupError(err.message);
        } else {
          showInvPopupError("Could not load invoice to edit.");
        }
        navigate(TILLFLOW_INVOICES_BASE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    inTillflowShell,
    token,
    editRouteInvoiceId,
    location.pathname,
    catalogCustomers,
    navigate,
    openEditInvoice,
    showInvPopupError
  ]);

  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewInvoiceError, setViewInvoiceError] = useState("");
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
  const viewInvoicePrintRootRef = useRef(null);
  const receiptPrintRootRef = useRef(null);
  const receiptInvoicePdfRootRef = useRef(null);

  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [recordPayTarget, setRecordPayTarget] = useState(null);
  const [recordPayAmount, setRecordPayAmount] = useState("");
  const [recordPayMethod, setRecordPayMethod] = useState("cash");
  const [recordPayPaidAt, setRecordPayPaidAt] = useState("");
  const [recordPayTransactionId, setRecordPayTransactionId] = useState("");
  const [recordPayNotes, setRecordPayNotes] = useState("");
  const [recordPaySaving, setRecordPaySaving] = useState(false);
  const [recordPayError, setRecordPayError] = useState("");

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptPreviewRow, setReceiptPreviewRow] = useState(null);

  const [viewPayEdit, setViewPayEdit] = useState(null);
  const [viewPayEditAmount, setViewPayEditAmount] = useState("");
  const [viewPayEditMethod, setViewPayEditMethod] = useState("cash");
  const [viewPayEditPaidAt, setViewPayEditPaidAt] = useState("");
  const [viewPayEditTransactionId, setViewPayEditTransactionId] = useState("");
  const [viewPayEditNotes, setViewPayEditNotes] = useState("");
  const [viewPayEditSaving, setViewPayEditSaving] = useState(false);
  const [viewPayEditError, setViewPayEditError] = useState("");
  const [invoiceViewPdfPreviewUrl, setInvoiceViewPdfPreviewUrl] = useState(null);
  const [invoiceViewPdfTitle, setInvoiceViewPdfTitle] = useState("");
  const [receiptInfoModal, setReceiptInfoModal] = useState(null);
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  const customerFilterOptions = useMemo(() => {
    const names = [
      ...new Set(
        invoices.map((r) => String(r.customer ?? "").trim()).filter((n) => n !== "")
      )
    ].sort((a, b) => a.localeCompare(b));
    return names.map((n) => ({ label: n, value: n }));
  }, [invoices]);

  const statusFilterOptions = useMemo(
    () => INVOICE_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s })),
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: "Recently issued", value: "recent" },
      { label: "Invoice no. A–Z", value: "invAsc" },
      { label: "Invoice no. Z–A", value: "invDesc" },
      { label: "Due — this month", value: "dueThisMonth" },
      { label: "Due — next 60 days", value: "dueSoon" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...invoices];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.customer).toLowerCase().includes(q) ||
          String(r.invoiceno).toLowerCase().includes(q)
      );
    }
    if (filterCustomer) {
      list = list.filter((r) => r.customer === filterCustomer);
    }
    if (filterStatus) {
      list = list.filter((r) => r.status === filterStatus);
    }

    const now = new Date();
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);

    if (sortMode === "dueThisMonth") {
      list = list.filter((r) => {
        const d = parseRowDateStr(r.duedate) || (r.dueAtIso ? new Date(`${r.dueAtIso}T12:00:00`) : null);
        return (
          d &&
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      });
    } else if (sortMode === "dueSoon") {
      list = list.filter((r) => {
        const d = parseRowDateStr(r.duedate) || (r.dueAtIso ? new Date(`${r.dueAtIso}T12:00:00`) : null);
        return d && !Number.isNaN(d.getTime()) && d >= now && d <= in60;
      });
    }

    if (sortMode === "invAsc") {
      list.sort((a, b) => String(a.invoiceno).localeCompare(String(b.invoiceno)));
    } else if (sortMode === "invDesc") {
      list.sort((a, b) => String(b.invoiceno).localeCompare(String(a.invoiceno)));
    } else if (sortMode === "dueThisMonth" || sortMode === "dueSoon") {
      list.sort((a, b) => {
        const da = parseRowDateStr(a.duedate) || (a.dueAtIso ? new Date(`${a.dueAtIso}T12:00:00`) : null);
        const db = parseRowDateStr(b.duedate) || (b.dueAtIso ? new Date(`${b.dueAtIso}T12:00:00`) : null);
        if (!da || Number.isNaN(da.getTime())) {
          return !db || Number.isNaN(db.getTime()) ? 0 : 1;
        }
        if (!db || Number.isNaN(db.getTime())) {
          return -1;
        }
        return da - db;
      });
    } else {
      list.sort((a, b) => {
        const ta = Number(a.createdAtTs ?? NaN);
        const tb = Number(b.createdAtTs ?? NaN);
        if (Number.isFinite(tb) || Number.isFinite(ta)) {
          if (!Number.isFinite(ta)) {
            return 1;
          }
          if (!Number.isFinite(tb)) {
            return -1;
          }
          if (tb !== ta) {
            return tb - ta;
          }
        }
        const da = parseRowDateFlexible(a);
        const db = parseRowDateFlexible(b);
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
  }, [invoices, searchQuery, filterCustomer, filterStatus, sortMode]);

  const totalRecords = displayRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterCustomer, filterStatus, sortMode]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCustomer("");
    setFilterStatus("");
    setSortMode("recent");
    setCurrentPage(1);
  }, []);

  const handleExportPdf = useCallback(async () => {
    try {
      await downloadInvoicesPdf(displayRows);
    } catch {
      setListError("Could not export PDF. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const handleExportExcel = useCallback(async () => {
    try {
      await downloadInvoicesExcel(displayRows);
    } catch {
      setListError("Could not export Excel. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const openInvoiceCancelConfirm = useCallback((row) => {
    if (!row || row.status === "Cancelled" || row.status === "Draft") {
      return;
    }
    setInvoiceCancelConfirmRow(row);
  }, []);

  const confirmInvoiceCancel = useCallback(async () => {
    const row = invoiceCancelConfirmRow;
    if (!row || row.status === "Draft") {
      return;
    }
    if (token && row.apiId) {
      setInvoiceCancelSaving(true);
      try {
        const data = await cancelInvoiceRequest(token, row.apiId);
        const inv = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
        if (inv) {
          const rowOut = {
            ...enrichInvoiceRowCustomers(inv, catalogCustomers),
            id: String(inv.id),
            taxNum: taxTotalFromInvoiceLineItems(inv.items ?? [])
          };
          setInvoices((prev) =>
            prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? rowOut : r))
          );
          setViewInvoice((prev) =>
            prev && String(prev.apiId) === String(inv.apiId)
              ? { ...prev, ...rowOut, invoiceTitle: prev.invoiceTitle || rowOut.invoiceTitle }
              : prev
          );
        }
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          showInvPopupError(err.message);
        } else {
          showInvPopupError("Could not cancel invoice.");
        }
      } finally {
        setInvoiceCancelSaving(false);
        setInvoiceCancelConfirmRow(null);
      }
    } else {
      setInvoices((prev) => prev.filter((r) => r.id !== row.id));
      setInvoiceCancelConfirmRow(null);
    }
  }, [invoiceCancelConfirmRow, token, catalogCustomers, showInvPopupError]);

  const openInvoiceRestoreConfirm = useCallback((row) => {
    if (!row || row.status !== "Cancelled" || !token || !row.apiId) {
      return;
    }
    setInvoiceRestoreConfirmRow(row);
  }, [token]);

  const confirmInvoiceRestore = useCallback(async () => {
    const row = invoiceRestoreConfirmRow;
    if (!row || row.status !== "Cancelled" || !token || !row.apiId) {
      return;
    }
    setInvoiceRestoreSaving(true);
    try {
      const data = await restoreInvoiceRequest(token, row.apiId);
      const inv = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
      if (inv) {
        const rowOut = {
          ...enrichInvoiceRowCustomers(inv, catalogCustomers),
          id: String(inv.id),
          taxNum: taxTotalFromInvoiceLineItems(inv.items ?? [])
        };
        setInvoices((prev) =>
          prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? rowOut : r))
        );
        setViewInvoice((prev) =>
          prev && String(prev.apiId) === String(inv.apiId)
            ? { ...prev, ...rowOut, invoiceTitle: prev.invoiceTitle || rowOut.invoiceTitle }
            : prev
        );
        showInvPopupSuccess(String(data?.message ?? "").trim() || "Invoice restored.");
      }
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        showInvPopupError(err.message);
      } else {
        showInvPopupError("Could not restore invoice.");
      }
    } finally {
      setInvoiceRestoreSaving(false);
      setInvoiceRestoreConfirmRow(null);
    }
  }, [invoiceRestoreConfirmRow, token, catalogCustomers, showInvPopupError, showInvPopupSuccess]);

  const openViewInvoice = useCallback(
    async (row) => {
      setViewInvoiceError("");
      setViewInvoice(enrichInvoiceRowCustomers(row, catalogCustomers));
      if (!token || !row?.apiId) {
        return;
      }
      setViewInvoiceLoading(true);
      try {
        const data = await showInvoiceRequest(token, row.apiId);
        if (data?.invoice) {
          const apiRow = enrichInvoiceRowCustomers(apiInvoiceToRow(data.invoice), catalogCustomers);
          const fallbackTitle = String(row?.invoiceTitle ?? "").trim();
          setViewInvoice((prev) => {
            const previousTitle = String(prev?.invoiceTitle ?? "").trim();
            return {
              ...apiRow,
              invoiceTitle: String(apiRow?.invoiceTitle ?? "").trim() || fallbackTitle || previousTitle
            };
          });
        }
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setViewInvoiceError(err.message);
        } else {
          setViewInvoiceError("Could not load invoice details.");
        }
      } finally {
        setViewInvoiceLoading(false);
      }
    },
    [token, catalogCustomers]
  );

  const viewDoc = useMemo(() => (viewInvoice ? buildInvoiceViewDocumentData(viewInvoice) : null), [viewInvoice]);

  const handleCloseInvoiceViewPdfPreview = useCallback(() => {
    setInvoiceViewPdfTitle("");
    setInvoiceViewPdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, []);

  useEffect(() => {
    setInvoiceViewPdfTitle("");
    setInvoiceViewPdfPreviewUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, [viewInvoice?.apiId, viewInvoice?.id]);

  const handleViewInvoicePdfPreview = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = viewInvoicePrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`;
      setInvoiceViewPdfTitle(`Invoice ${viewDoc.invoiceNo}`);
      const url = await createHtmlDocumentPdfObjectUrl(root, { fileSlug: slug });
      setInvoiceViewPdfPreviewUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {
            /* ignore */
          }
        }
        return url;
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewDoc]);

  const handleViewInvoicePdfFromReceipt = useCallback(async () => {
    const row = receiptPreviewRow;
    if (!row || !token || !inTillflowShell) {
      return;
    }
    const doc = buildInvoiceViewDocumentData(row);
    const root = receiptInvoicePdfRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      window.alert("Could not prepare the invoice for PDF. Try again in a moment.");
      return;
    }
    try {
      await waitForPrintRootImages(root);
      const slug = `invoice-${String(doc.invoiceNo).replace(/[^\w.-]+/g, "_")}`;
      const url = await createHtmlDocumentPdfObjectUrl(root, { fileSlug: slug });
      setInvoiceViewPdfTitle(`Invoice ${doc.invoiceNo}`);
      setInvoiceViewPdfPreviewUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {
            /* ignore */
          }
        }
        return url;
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [receiptPreviewRow, token, inTillflowShell]);

  const handleReceiptActivityLog = useCallback(() => {
    setActivityLogOpen(true);
  }, []);

  const handleViewInvoicePdfNewTab = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = viewInvoicePrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await openHtmlDocumentPdfInBrowser(root, {
        fileSlug: `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === "POPUP_BLOCKED") {
        window.alert("Your browser blocked the new tab. Allow pop-ups for this site or use View PDF.");
        return;
      }
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewDoc]);

  const handleDownloadViewInvoicePdf = useCallback(async () => {
    if (!viewDoc) {
      return;
    }
    const root = viewInvoicePrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `invoice-${String(viewDoc.invoiceNo).replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [viewDoc]);

  const openRecordPayment = useCallback((row) => {
    if (!row?.apiId) {
      return;
    }
    setRecordPayTarget(row);
    const due = Math.max(0, roundMoney(Number(row.totalNum ?? 0) - Number(row.paidNum ?? 0)));
    setRecordPayAmount(due > 0 ? String(due) : "");
    setRecordPayMethod("cash");
    setRecordPayPaidAt(
      typeof window !== "undefined"
        ? new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : ""
    );
    setRecordPayTransactionId("");
    setRecordPayNotes("");
    setRecordPayError("");
    setShowRecordPayment(true);
  }, []);

  const resetInvoiceEmailPreview = useCallback(() => {
    setInvoiceEmailPreviewOpen(false);
    setInvoiceEmailPreviewRow(null);
    setInvoiceEmailPreviewSubject("");
    setInvoiceEmailPreviewHtml("");
    setInvoiceEmailPreviewTo("");
    setInvoiceEmailPreviewMessage("");
    setInvoiceEmailPreviewLoading(false);
    setInvoiceEmailPreviewError("");
    setInvoiceEmailPreviewSending(false);
    setInvoiceEmailPreviewSource("invoice");
    setInvoiceEmailPreviewPaymentId(null);
  }, []);

  const openInvoiceEmailPreview = useCallback(
    async (row, source = "invoice") => {
      if (!token || !row?.apiId || row.status === "Cancelled") {
        return;
      }
      if (!String(row.customerEmail ?? "").trim()) {
        showInvPopupError("Add an email to the customer before sending.");
        return;
      }
      setInvoiceEmailPreviewRow(row);
      setInvoiceEmailPreviewSubject("");
      setInvoiceEmailPreviewHtml("");
      setInvoiceEmailPreviewTo(String(row.customerEmail ?? "").trim());
      setInvoiceEmailPreviewMessage("");
      setInvoiceEmailPreviewError("");
      setInvoiceEmailPreviewOpen(true);
      setInvoiceEmailPreviewLoading(true);
      setInvoiceEmailPreviewSource(source === "receipt" ? "receipt" : "invoice");
      try {
        const data = await previewInvoiceEmailRequest(token, row.apiId);
        setInvoiceEmailPreviewSubject(String(data?.subject ?? ""));
        setInvoiceEmailPreviewHtml(String(data?.html ?? ""));
        if (String(data?.to_email ?? "").trim()) {
          setInvoiceEmailPreviewTo(String(data.to_email).trim());
        }
        setInvoiceEmailPreviewMessage(String(data?.message_template ?? "Please find your invoice below."));
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setInvoiceEmailPreviewError(err.message);
        } else {
          setInvoiceEmailPreviewError("Could not load email preview.");
        }
      } finally {
        setInvoiceEmailPreviewLoading(false);
      }
    },
    [token, showInvPopupError]
  );

  const confirmSendInvoiceFromPreview = useCallback(async () => {
    const row = invoiceEmailPreviewRow;
    if (!token || !row?.apiId || row.status === "Cancelled") {
      return;
    }
    setInvoiceEmailPreviewSending(true);
    try {
      if (invoiceEmailPreviewSource === "receipt") {
        const paymentId = invoiceEmailPreviewPaymentId;
        if (!paymentId) {
          throw new Error("Missing receipt payment id.");
        }
        const data = await sendInvoicePaymentReceiptToCustomerRequest(token, row.apiId, paymentId, {
          toEmail: String(invoiceEmailPreviewTo ?? "").trim(),
          subject: String(invoiceEmailPreviewSubject ?? "").trim(),
          message: String(invoiceEmailPreviewMessage ?? "")
        });
        if (data?.payment?.id) {
          const sentPay = data.payment;
          setReceiptPreview((prev) => (prev && String(prev.id) === String(sentPay.id) ? { ...prev, ...sentPay } : prev));
          setInvoices((prev) =>
            prev.map((invRow) => {
              if (String(invRow.apiId ?? invRow.id) !== String(row.apiId)) {
                return invRow;
              }
              const nextPayments = Array.isArray(invRow.payments)
                ? invRow.payments.map((p) => (String(p.id) === String(sentPay.id) ? { ...p, ...sentPay } : p))
                : invRow.payments;
              return { ...invRow, payments: nextPayments };
            })
          );
          setViewInvoice((prev) => {
            if (!prev || String(prev.apiId ?? prev.id) !== String(row.apiId)) {
              return prev;
            }
            const nextPayments = Array.isArray(prev.payments)
              ? prev.payments.map((p) => (String(p.id) === String(sentPay.id) ? { ...p, ...sentPay } : p))
              : prev.payments;
            return { ...prev, payments: nextPayments };
          });
        }
        const msg = String(data?.message ?? "").trim() || "Receipt was sent to the customer.";
        showInvPopupSuccess(msg);
        resetInvoiceEmailPreview();
        return;
      }
      /** First issue from Draft: server PDF (correct INV-#). Resend: match on-screen layout like quotations. */
      let pdfBlob = null;
      const useClientPdf = invoiceWasIssuedToCustomer(row);
      if (useClientPdf && typeof document !== "undefined") {
        try {
          const enriched = enrichInvoiceRowCustomers(row, catalogCustomers);
          const viewDocSend = buildInvoiceViewDocumentData(enriched);
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
          const reactRoot = createRoot(host);
          let printEl = null;
          flushSync(() => {
            reactRoot.render(
              <InvoicePrintDocument
                ref={(el) => {
                  printEl = el;
                }}
                {...viewDocSend}
              />
            );
          });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (printEl) {
            await waitForPrintRootImages(printEl);
            await new Promise((r) => setTimeout(r, 120));
            pdfBlob = await htmlDocumentPdfBlobFromElement(printEl, {
              fileSlug: `invoice-${String(enriched.invoiceno ?? enriched.apiId ?? "inv").replace(/[^\w.-]+/g, "_")}`
            });
          }
          reactRoot.unmount();
          document.body.removeChild(host);
        } catch (e) {
          console.warn("Client PDF for email failed; server Dompdf will be used.", e);
          pdfBlob = null;
        }
      }

      const attachFilename = `invoice-${String(row.invoiceRefStored ?? row.invoiceno ?? row.apiId ?? "invoice").replace(/[^\w.-]+/g, "_")}.pdf`;

      const data = await sendInvoiceToCustomerRequest(token, row.apiId, {
        pdfBlob: pdfBlob instanceof Blob ? pdfBlob : undefined,
        attachmentFilename: attachFilename,
        toEmail: String(invoiceEmailPreviewTo ?? "").trim(),
        subject: String(invoiceEmailPreviewSubject ?? "").trim(),
        message: String(invoiceEmailPreviewMessage ?? "")
      });
      const inv = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
      if (inv) {
        const rowOut = {
          ...inv,
          id: String(inv.id),
          taxNum: taxTotalFromInvoiceLineItems(inv.items),
          ...(invoiceEmailPreviewSource === "invoice"
            ? {
                sentToCustomerAt: inv.sentToCustomerAt || new Date().toISOString(),
                emailSentConfirmed: true
              }
            : {
                sentToCustomerAt: row.sentToCustomerAt ?? null,
                emailSentConfirmed: Boolean(row.emailSentConfirmed)
              })
        };
        setInvoices((prev) =>
          prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? rowOut : r))
        );
        setViewInvoice((prev) =>
          prev && String(prev.apiId) === String(inv.apiId)
            ? { ...prev, ...rowOut, invoiceTitle: prev.invoiceTitle || rowOut.invoiceTitle }
            : prev
        );
      }
      const apiMsg = String(data?.message ?? "").trim();
      const fallback = invoiceWasIssuedToCustomer(row)
        ? "Invoice email was resent to the customer."
        : "Invoice was sent to the customer.";
      showInvPopupSuccess(apiMsg || fallback);
      resetInvoiceEmailPreview();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        showInvPopupError(err.message);
      } else {
        showInvPopupError("Could not send invoice email.");
      }
    } finally {
      setInvoiceEmailPreviewSending(false);
    }
  }, [
    token,
    invoiceEmailPreviewRow,
    invoiceEmailPreviewTo,
    invoiceEmailPreviewSubject,
    invoiceEmailPreviewMessage,
    invoiceEmailPreviewSource,
    invoiceEmailPreviewPaymentId,
    catalogCustomers,
    resetInvoiceEmailPreview,
    showInvPopupError,
    showInvPopupSuccess
  ]);

  const handleSendReceiptToCustomer = useCallback(async () => {
    const row = receiptPreviewRow;
    const receipt = receiptPreview;
    if (
      !token ||
      !row?.apiId ||
      !receipt?.id ||
      row.status === "Cancelled" ||
      !String(row.customerEmail ?? "").trim()
    ) {
      return;
    }
    try {
      setInvoiceEmailPreviewRow(row);
      setInvoiceEmailPreviewSource("receipt");
      setInvoiceEmailPreviewPaymentId(receipt.id);
      setInvoiceEmailPreviewSubject("");
      setInvoiceEmailPreviewHtml("");
      setInvoiceEmailPreviewTo(String(row.customerEmail ?? "").trim());
      setInvoiceEmailPreviewMessage("");
      setInvoiceEmailPreviewError("");
      setInvoiceEmailPreviewOpen(true);
      setInvoiceEmailPreviewLoading(true);
      const data = await previewInvoicePaymentReceiptEmailRequest(token, receipt.id);
      setInvoiceEmailPreviewSubject(String(data?.subject ?? ""));
      setInvoiceEmailPreviewHtml(String(data?.html ?? ""));
      if (String(data?.to_email ?? "").trim()) {
        setInvoiceEmailPreviewTo(String(data.to_email).trim());
      }
      setInvoiceEmailPreviewMessage(String(data?.message_template ?? "Please find your payment receipt details below."));
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setInvoiceEmailPreviewError(err.message);
      } else {
        setInvoiceEmailPreviewError("Could not load receipt email preview.");
      }
    } finally {
      setInvoiceEmailPreviewLoading(false);
    }
  }, [token, receiptPreviewRow, receiptPreview]);

  const submitRecordPayment = useCallback(async () => {
    if (!token || !recordPayTarget?.apiId) {
      return;
    }
    setRecordPaySaving(true);
    setRecordPayError("");
    try {
      const amt = roundMoney(Math.max(0.01, Number(String(recordPayAmount).replace(/,/g, "")) || 0));
      const data = await createInvoicePaymentRequest(token, recordPayTarget.apiId, {
        amount: amt,
        payment_method: recordPayMethod,
        paid_at: recordPayPaidAt ? new Date(recordPayPaidAt).toISOString() : undefined,
        transaction_id: recordPayTransactionId.trim() || undefined,
        notes: recordPayNotes.trim() || undefined
      });
      const inv = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
      if (inv) {
        setInvoices((prev) =>
          prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? { ...inv, id: String(inv.id) } : r))
        );
        setViewInvoice((prev) =>
          prev && String(prev.apiId) === String(inv.apiId)
            ? { ...prev, ...inv, invoiceTitle: prev.invoiceTitle || inv.invoiceTitle }
            : prev
        );
      }
      if (data?.payment) {
        setReceiptPreview(data.payment);
        setReceiptPreviewRow(recordPayTarget);
      }
      setShowRecordPayment(false);
      setRecordPayTarget(null);
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setRecordPayError(err.message);
      } else {
        setRecordPayError("Could not record payment.");
      }
    } finally {
      setRecordPaySaving(false);
    }
  }, [token, recordPayTarget, recordPayAmount, recordPayMethod, recordPayPaidAt, recordPayTransactionId, recordPayNotes]);

  const handleDownloadReceiptPdf = useCallback(async () => {
    if (!receiptPreview || !receiptPreviewRow) {
      return;
    }
    const root = receiptPrintRootRef.current;
    if (!root || !(root instanceof HTMLElement)) {
      return;
    }
    try {
      await waitForPrintRootImages(root);
      await downloadHtmlDocumentPdfFromElement(root, {
        fileSlug: `receipt-${String(receiptPreview.receipt_ref ?? "").replace(/[^\w.-]+/g, "_")}`
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not generate the PDF. Please try again.");
    }
  }, [receiptPreview, receiptPreviewRow]);

  const openViewPaymentEdit = useCallback((pay) => {
    if (!viewInvoice?.apiId || !pay?.id) {
      return;
    }
    setViewPayEdit(pay);
    setViewPayEditAmount(String(pay.amount ?? ""));
    setViewPayEditMethod(String(pay.payment_method ?? "cash"));
    const iso = pay.paid_at ? String(pay.paid_at) : "";
    setViewPayEditPaidAt(iso ? iso.slice(0, 16) : "");
    setViewPayEditTransactionId(String(pay.transaction_id ?? ""));
    setViewPayEditNotes(String(pay.notes ?? ""));
    setViewPayEditError("");
  }, [viewInvoice?.apiId]);

  const submitViewPaymentEdit = useCallback(async () => {
    if (!token || !viewInvoice?.apiId || !viewPayEdit?.id) {
      return;
    }
    setViewPayEditSaving(true);
    setViewPayEditError("");
    try {
      const data = await updateInvoicePaymentRequest(token, viewInvoice.apiId, viewPayEdit.id, {
        amount: Number(String(viewPayEditAmount).replace(/,/g, "")) || 0,
        payment_method: viewPayEditMethod,
        paid_at: viewPayEditPaidAt ? new Date(viewPayEditPaidAt).toISOString() : undefined,
        transaction_id: viewPayEditTransactionId.trim() || null,
        notes: viewPayEditNotes.trim() || null
      });
      const inv = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
      if (inv) {
        setInvoices((prev) =>
          prev.map((r) => (String(r.apiId ?? r.id) === String(inv.apiId) ? { ...inv, id: String(inv.id) } : r))
        );
        setViewInvoice((prev) =>
          prev && String(prev.apiId) === String(inv.apiId)
            ? { ...prev, ...inv, invoiceTitle: prev.invoiceTitle || inv.invoiceTitle }
            : prev
        );
      }
      setViewPayEdit(null);
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setViewPayEditError(err.message);
      } else {
        setViewPayEditError("Could not update payment.");
      }
    } finally {
      setViewPayEditSaving(false);
    }
  }, [
    token,
    viewInvoice?.apiId,
    viewPayEdit?.id,
    viewPayEditAmount,
    viewPayEditMethod,
    viewPayEditPaidAt,
    viewPayEditTransactionId,
    viewPayEditNotes
  ]);

  const discountFieldsActive = invDiscountType !== "none";

  const columns = useMemo(
    () => [
      {
        header: "Invoice No",
        field: "invoiceno",
        body: (rowData) =>
          inTillflowShell && rowData.apiId ? (
            <Link to={`${TILLFLOW_INVOICES_BASE}/${rowData.apiId}`} className="text-primary">
              {rowData.invoiceno}
            </Link>
          ) : inTillflowShell ? (
            <Link
              to="#"
              className="text-primary"
              onClick={(e) => {
                e.preventDefault();
                void openViewInvoice(rowData);
              }}>
              {rowData.invoiceno}
            </Link>
          ) : (
            <Link to={route.invoicedetails}>{rowData.invoiceno}</Link>
          )
      },
      { header: "Issued", field: "issueDate" },
      {
        header: "Customer",
        field: "customer",
        body: (rowData) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md" onClick={(e) => e.preventDefault()}>
              <img src={rowData.image} alt="" />
            </Link>
            <span className="ms-2">{rowData.customer}</span>
          </div>
        )
      },
      { header: "Due Date", field: "duedate" },
      { header: "Amount", field: "amount" },
      {
        header: "Tax",
        field: "taxNum",
        sortable: false,
        body: (rowData) => {
          const n =
            typeof rowData.taxNum === "number" && Number.isFinite(rowData.taxNum)
              ? rowData.taxNum
              : taxTotalFromInvoiceLineItems(rowData.items);
          if (n == null) {
            return "—";
          }
          return formatInvoiceMoneyKes(n);
        }
      },
      { header: "Paid", field: "paid" },
      { header: "Amount Due", field: "amountdue" },
      {
        header: "Status",
        field: "status",
        body: (rowData) => (
          <span className={`badge ${invoiceStatusBadgeClass(rowData.status)} badge-xs shadow-none`}>
            {String(rowData.status ?? "").replace(/_/g, " ")}
          </span>
        )
      },
      {
        header: "",
        field: "action",
        sortable: false,
        body: (row) => {
          const rowWithCustomer = enrichInvoiceRowCustomers(row, catalogCustomers);
          const canEmailCustomer = String(rowWithCustomer?.customerEmail ?? "").trim() !== "";
          return inTillflowShell ? (
            <div className="edit-delete-action d-flex align-items-center justify-content-end">
              <Dropdown align="end" drop="down">
                <Dropdown.Toggle
                  variant="light"
                  id={`invoice-actions-${String(row.id)}`}
                  className="btn btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center invoice-list__row-actions-toggle"
                  aria-label="Invoice actions">
                  <i className="ti ti-dots-vertical" />
                </Dropdown.Toggle>
                <Dropdown.Menu popperConfig={{ strategy: "fixed" }} renderOnMount>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    onClick={() => {
                      if (row.apiId) {
                        navigate(`${TILLFLOW_INVOICES_BASE}/${row.apiId}`);
                      } else {
                        void openViewInvoice(row);
                      }
                    }}>
                    <i className="ti ti-eye me-2 text-dark" />
                    View
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    disabled={Boolean(token && row.apiId && row.status === "Cancelled")}
                    onClick={() => {
                      if (token && row.apiId && row.status === "Cancelled") {
                        return;
                      }
                      if (token && row.apiId) {
                        navigate(`${TILLFLOW_INVOICES_BASE}/${row.apiId}/edit`);
                        return;
                      }
                      openEditInvoice(row);
                    }}>
                    <i className="ti ti-edit me-2 text-dark" />
                    Edit
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    disabled={
                      !token || !row.apiId || row.status === "Draft" || row.status === "Cancelled"
                    }
                    onClick={() => {
                      if (token && row.apiId && row.status !== "Draft" && row.status !== "Cancelled") {
                        openRecordPayment(row);
                      }
                    }}>
                    <i className="ti ti-currency-dollar me-2 text-dark" />
                    Record payment
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    disabled={
                      !token || !row.apiId || row.status === "Draft" || row.status === "Cancelled"
                    }
                    onClick={() => {
                      if (token && row.apiId && row.status !== "Draft" && row.status !== "Cancelled") {
                        navigate(`${TILLFLOW_INVOICES_BASE}/${row.apiId}?generateDelivery=1`);
                      }
                    }}>
                    <i className="ti ti-truck-delivery me-2 text-dark" />
                    Generate delivery
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    disabled={!token || !row.apiId || row.status === "Draft" || row.status === "Cancelled"}
                    onClick={() => {
                      if (token && row.apiId && row.status !== "Draft" && row.status !== "Cancelled") {
                        navigate(`${TILLFLOW_INVOICES_BASE}/${row.apiId}?generateCreditNote=1`);
                      }
                    }}>
                    <i className="ti ti-file-minus me-2 text-dark" />
                    Generate credit note
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    type="button"
                    className={
                      invoiceWasIssuedToCustomer(rowWithCustomer)
                        ? "text-danger"
                        : row.status === "Draft" && canEmailCustomer
                          ? "tf-invoice-send-customer"
                          : undefined
                    }
                    disabled={
                      !token ||
                      !row.apiId ||
                      row.status === "Cancelled" ||
                      !canEmailCustomer
                    }
                    title={
                      invoiceWasIssuedToCustomer(rowWithCustomer)
                        ? invoiceSentToCustomerHoverTitle(rowWithCustomer)
                        : row.status === "Draft" && !canEmailCustomer
                          ? "Customer needs an email address"
                          : row.status === "Draft" && canEmailCustomer
                            ? "Send this invoice to the customer's email address"
                            : undefined
                    }
                    onClick={() => {
                      void openInvoiceEmailPreview(rowWithCustomer);
                    }}>
                    <i
                      className={`ti ti-send me-2 ${
                        invoiceWasIssuedToCustomer(rowWithCustomer)
                          ? "text-danger"
                          : row.status === "Draft" && canEmailCustomer
                            ? "tf-invoice-send-customer-icon"
                            : "text-dark"
                      }`}
                    />
                    {invoiceWasIssuedToCustomer(rowWithCustomer) ? "Resend to customer" : "Send to customer"}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  {row.status === "Cancelled" ? (
                    <Dropdown.Item
                      as="button"
                      type="button"
                      className="text-success"
                      disabled={!token || !row.apiId || invoiceRestoreSaving}
                      onClick={() => openInvoiceRestoreConfirm(row)}>
                      <i className="ti ti-restore me-2" />
                      Restore invoice
                    </Dropdown.Item>
                  ) : null}
                  <Dropdown.Item
                    as="button"
                    type="button"
                    className="text-danger"
                    disabled={row.status === "Cancelled" || row.status === "Draft"}
                    title={row.status === "Draft" ? "Draft invoices cannot be cancelled" : undefined}
                    onClick={() => openInvoiceCancelConfirm(row)}>
                    <i className="ti ti-trash me-2" />
                    Cancel invoice
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          ) : (
            <div className="edit-delete-action d-flex align-items-center justify-content-center gap-1">
              <button
                type="button"
                className="p-2 btn btn-light border rounded"
                title="Edit"
                disabled={Boolean(token && row.apiId && row.status === "Cancelled")}
                onClick={() => {
                  if (token && row.apiId && row.status === "Cancelled") {
                    return;
                  }
                  openEditInvoice(row);
                }}>
                <i className="feather icon-edit text-primary" />
              </button>
              <Link
                className="p-2 d-flex align-items-center justify-content-center border rounded"
                to={route.invoicedetails}
                title="View">
                <i className="feather icon-eye feather-eye" />
              </Link>
              <button
                type="button"
                className="p-2 btn btn-light border rounded"
                title={
                  row.status === "Draft"
                    ? "Draft invoices cannot be cancelled"
                    : row.status === "Cancelled"
                      ? "Already cancelled"
                      : "Cancel invoice"
                }
                disabled={row.status === "Cancelled" || row.status === "Draft"}
                onClick={() => openInvoiceCancelConfirm(row)}>
                <i className="feather icon-trash-2 text-danger" />
              </button>
            </div>
          );
        }
      }
    ],
    [
      route.invoicedetails,
      inTillflowShell,
      token,
      catalogCustomers,
      openInvoiceCancelConfirm,
      openInvoiceRestoreConfirm,
      invoiceRestoreSaving,
      openViewInvoice,
      openEditInvoice,
      openRecordPayment,
      openInvoiceEmailPreview,
      navigate
    ]
  );

  return (
    <div>
      <div
        className={`page-wrapper invoice-list-page${inTillflowShell ? " invoice-list-page--tillflow" : ""}`}>
        <div className="content">
          {invPopupError || invPopupSuccess ? (
            <div
              className="position-fixed top-0 end-0 p-3"
              style={{ zIndex: 1065, minWidth: 280, maxWidth: 400 }}>
              <div
                className={`alert shadow-sm mb-0 d-flex align-items-center justify-content-between gap-2 ${
                  invPopupError ? "alert-danger" : "alert-success"
                }`}>
                <span>{invPopupError || invPopupSuccess}</span>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => {
                    setInvPopupError("");
                    setInvPopupSuccess("");
                  }}
                />
              </div>
            </div>
          ) : null}
          {invoiceFormMode === "list" ? (
            <>
              <div className="page-header">
                <div className="add-item d-flex">
                  <div className="page-title">
                    <h4>Invoices</h4>
                    <h6>
                      Track billing and collections — search, filter by customer or status, and create invoices.
                    </h6>
                  </div>
                </div>
                <TableTopHead
                  onRefresh={resetFilters}
                  onExportPdf={handleExportPdf}
                  onExportExcel={handleExportExcel}
                  showCollapse={false}
                />
                {listError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {listError}
                  </div>
                ) : null}
                {catalogError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {catalogError}
                  </div>
                ) : null}
                <div className="page-btn d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary text-white" onClick={openCreate}>
                    <PlusCircle size={18} strokeWidth={1.75} className="me-1" aria-hidden />
                    Add Invoice
                  </button>
                  {inTillflowShell ? (
                    <Link to="/tillflow/admin/invoice-payments" className="btn btn-outline-secondary">
                      <i className="feather icon-dollar-sign me-1" />
                      Invoice payments
                    </Link>
                  ) : null}
                  {inTillflowShell ? (
                    <Link to="/tillflow/admin/quotations" className="btn btn-outline-primary">
                      <i className="ti ti-file-description me-1" />
                      Quotations
                    </Link>
                  ) : (
                    <Link to={route.quotationlist} className="btn btn-outline-primary">
                      <i className="ti ti-file-description me-1" />
                      Quotations
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
                        options={customerFilterOptions}
                        value={filterCustomer === "" ? null : filterCustomer}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterCustomer(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Customer"
                        filter
                        showClear
                      />
                    </div>
                    <div style={{ minWidth: "10rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={statusFilterOptions}
                        value={filterStatus === "" ? null : filterStatus}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterStatus(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Status"
                        filter={false}
                        showClear
                      />
                    </div>
                    <div style={{ minWidth: "12rem" }}>
                      <CommonSelect
                        className="w-100"
                        options={sortOptions}
                        value={sortMode}
                        onChange={(e) =>
                          setSortMode(e.value != null ? String(e.value) : "recent")
                        }
                        placeholder="Sort / scope"
                        filter={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="card-body p-0">
                  <div className="custom-datatable-filter table-responsive">
                    <PrimeDataTable
                      column={columns}
                      data={displayRows}
                      rows={rows}
                      setRows={setRows}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      totalRecords={totalRecords}
                      loading={listLoading}
                      selectionMode="checkbox"
                      selection={selectedInvoices}
                      onSelectionChange={(e) => setSelectedInvoices(e.value)}
                      dataKey="id"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <form
              className="quotation-form-sheet quotation-form-sheet--crm"
              noValidate
              onSubmit={handleCreateSubmit}>
              <div className="page-header border-0 pb-2 quotation-crm-header">
                <div className="d-flex flex-wrap align-items-start gap-3 justify-content-between w-100">
                  <div className="page-title mb-0 min-w-0 flex-grow-1 pe-2">
                    <h4 className="mb-0">{invoiceFormMode === "edit" ? "Edit invoice" : "Create invoice"}</h4>
                  </div>
                  <button
                    type="button"
                    className="tf-btn tf-btn--secondary quotation-crm-header-back d-inline-flex align-items-center justify-content-center gap-1 flex-shrink-0 align-self-start text-decoration-none"
                    onClick={leaveCreateForm}>
                    <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                    Back
                  </button>
                </div>
                {catalogError ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {catalogError}
                  </div>
                ) : null}
              </div>

              <div className="card border-0 shadow-sm mb-3 quotation-crm-card">
                <div className="card-header border-bottom py-3 bg-transparent">
                  <h5 className="mb-0 fw-semibold">Invoice details</h5>
                </div>
                <div className="card-body">
                  {invError ? (
                    <div className="alert alert-danger" role="alert">
                      {invError}
                    </div>
                  ) : null}
                  <div className="row g-3">
                    <div className="col-md-4 col-lg-3">
                      <label className="form-label">Invoice no.</label>
                      <input
                        type="text"
                        className="form-control"
                        value={invInvoiceRef || "INV-000001"}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="col-md-4 col-lg-5">
                      <label className="form-label">Invoice title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={invTitle}
                        onChange={(e) => setInvTitle(e.target.value)}
                        placeholder="Invoice for: website redesign"
                        maxLength={180}
                      />
                    </div>
                    <div className="col-md-4 col-lg-4">
                      <label className="form-label">
                        Customer<span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={customerPickOptions}
                        value={invCustomerId === "" ? "" : invCustomerId}
                        onChange={(e) => {
                          const v = e.value;
                          setInvCustomerId(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Customer"
                        filter
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">
                        Issue date<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={invIssueAt}
                        onChange={(e) => setInvIssueAt(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Due date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={invDueAt}
                        onChange={(e) => setInvDueAt(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label d-block">Recurring invoice</label>
                      <div className="form-check form-switch mt-1">
                        <input
                          id="inv-recurring-toggle"
                          type="checkbox"
                          className="form-check-input"
                          checked={invIsRecurring}
                          onChange={(e) => setInvIsRecurring(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="inv-recurring-toggle">
                          Enable recurring
                        </label>
                      </div>
                    </div>
                    {invIsRecurring ? (
                      <>
                        <div className="col-md-4">
                          <label className="form-label">Repeat every</label>
                          <select
                            className="form-select"
                            value={invRecurringChoice}
                            onChange={(e) => setInvRecurringChoice(e.target.value)}>
                            {RECURRING_MONTH_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {invRecurringChoice === "custom" ? (
                          <div className="col-md-4 col-lg-2">
                            <label className="form-label">Custom interval</label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              className="form-control"
                              value={invRecurringCustomEvery}
                              onChange={(e) => setInvRecurringCustomEvery(e.target.value)}
                            />
                          </div>
                        ) : null}
                        {invRecurringChoice === "custom" ? (
                          <div className="col-md-4 col-lg-2">
                            <label className="form-label">Unit</label>
                            <select
                              className="form-select"
                              value={invRecurringCustomUnit}
                              onChange={(e) => setInvRecurringCustomUnit(e.target.value)}>
                              <option value="day">Day(s)</option>
                              <option value="week">Week(s)</option>
                              <option value="month">Month(s)</option>
                            </select>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {token && inTillflowShell ? (
                      <div className="col-md-4">
                        <label className="form-label">Status</label>
                        <select
                          className="form-select"
                          value={invoiceFormMode === "edit" ? invEditStatus : invCreateStatus}
                          onChange={(e) =>
                            invoiceFormMode === "edit"
                              ? setInvEditStatus(e.target.value)
                              : setInvCreateStatus(e.target.value)
                          }>
                          {(invoiceFormMode === "create"
                            ? ["Draft", "Unpaid"]
                            : INVOICE_STATUSES.filter((s) => s !== "Cancelled")
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        {invoiceFormMode === "create" ? (
                          <p className="text-muted small mb-0 mt-1">
                            Choose <strong>Unpaid</strong> to issue; record payments from the list.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {token && inTillflowShell && invoiceFormMode === "edit" && editingHasPayments ? (
                      <div className="col-md-4">
                        <label className="form-label">Amount paid</label>
                        <div className="form-control bg-light small mb-0">
                          Totals come from{" "}
                          <Link to="/tillflow/admin/invoice-payments" target="_blank" rel="noopener noreferrer">
                            recorded payments
                          </Link>
                          . Use <strong>Record payment</strong> on the invoice list.
                        </div>
                      </div>
                    ) : (
                      <div className="col-md-4">
                        <label className="form-label">Amount paid (Ksh)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="form-control"
                          value={invAmountPaid}
                          onChange={(e) => setInvAmountPaid(e.target.value)}
                        />
                        <p className="text-muted small mb-0 mt-1">
                          Total due:{" "}
                          {formatInvoiceMoneyKes(
                            Math.max(
                              0,
                              invoiceKesSummary.grandTotal -
                                Math.min(Number(invAmountPaid) || 0, invoiceKesSummary.grandTotal)
                            )
                          )}
                        </p>
                        {token && inTillflowShell && invoiceFormMode === "create" && Number(invAmountPaid) > 0 ? (
                          <div className="mt-2">
                            <label className="form-label small">Initial payment method</label>
                            <select
                              className="form-select form-select-sm"
                              value={invInitialPaymentMethod}
                              onChange={(e) => setInvInitialPaymentMethod(e.target.value)}>
                              {INVOICE_PAYMENT_METHOD_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="row g-3 mt-1 pt-3 border-top border-light-subtle">
                    <div className={`col-md-6 ${discountFieldsActive ? "col-lg-3" : "col-lg-6"}`}>
                      <label className="form-label">Discount type</label>
                      <select
                        className="form-select"
                        value={invDiscountType}
                        onChange={(e) => setInvDiscountType(e.target.value)}>
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
                          <label className="form-label">Discount as</label>
                          <select
                            className="form-select"
                            value={invDiscountBasis}
                            onChange={(e) => setInvDiscountBasis(e.target.value)}>
                            {DISCOUNT_BASIS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6 col-lg-3">
                          <label className="form-label">
                            {invDiscountBasis === "fixed" ? "Amount (Ksh)" : "Percent (%)"}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={invDiscountBasis === "fixed" ? undefined : 100}
                            step="0.01"
                            className="form-control"
                            value={invDiscountValue}
                            onChange={(e) => setInvDiscountValue(e.target.value)}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-3 quotation-crm-card">
                <div className="card-header border-bottom py-3 bg-transparent">
                  <h5 className="mb-0 fw-semibold">Line items</h5>
                </div>
                <div className="card-body">
                  {token ? (
                    <div className="row g-2 align-items-end mb-3 pb-3 border-bottom quotation-catalog-add quotation-crm-items-toolbar">
                      <div className="col-12">
                        <label className="visually-hidden" htmlFor={`inv-catalog-quick-${catalogQuickAddKey}`}>
                          Search products
                        </label>
                        <div className="row g-2 g-md-3 align-items-stretch quotation-crm-search-with-action">
                          <div className="col-12 col-md min-w-0">
                            <div className="quotation-catalog-search-field">
                              <Search
                                className="quotation-catalog-search-field__icon"
                                size={18}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <AutoComplete
                                key={`inv-catalog-${catalogQuickAddKey}`}
                                inputId={`inv-catalog-quick-${catalogQuickAddKey}`}
                                value={catalogQuickSearchText}
                                suggestions={catalogQuickSuggestions}
                                completeMethod={catalogQuickComplete}
                                onChange={catalogQuickOnChange}
                                onSelect={catalogQuickOnSelect}
                                field="name"
                                placeholder="Search catalog to add lines…"
                                className="w-100 quotation-catalog-autocomplete"
                                inputClassName="form-control"
                                appendTo={typeof document !== "undefined" ? document.body : null}
                                minLength={0}
                                dropdown
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
                          <div className="col-12 col-md-3">
                            <select
                              className="form-select quotation-catalog-category-select"
                              value={catalogCategoryFilter}
                              onChange={(e) => setCatalogCategoryFilter(e.target.value)}>
                              <option value="">All categories</option>
                              {catalogCategories.map((c) => (
                                <option key={String(c.id)} value={buildCategoryFilterValue(c)}>
                                  {String(c.name ?? "")}
                                </option>
                              ))}
                            </select>
                          </div>
                          {inTillflowShell ? (
                            <div className="col-12 col-md-auto d-flex justify-content-md-end align-items-center">
                              <Link
                                to="/tillflow/admin/add-product"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tf-btn tf-btn--secondary quotation-crm-add-product-link d-inline-flex align-items-center justify-content-center gap-1 w-100 text-decoration-none text-nowrap">
                                <PlusCircle size={14} strokeWidth={2} aria-hidden />
                                Add new product
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {catalogLoading && token ? (
                    <p className="text-muted small mb-2">Loading catalog…</p>
                  ) : null}
                  <div className="table-responsive quotation-line-items-scroll">
                    <table className="table table-hover align-middle mb-0 quotation-line-items-table">
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="user-select-none">
                            <span className="visually-hidden">Reorder</span>
                          </th>
                          <th scope="col" className="text-center">
                            #
                          </th>
                          <th scope="col">Item</th>
                          <th scope="col">Description</th>
                          <th scope="col">Qty</th>
                          <th scope="col">Rate</th>
                          <th scope="col">Tax %</th>
                          <th scope="col" className="text-end">
                            Amount
                          </th>
                          <th scope="col" className="text-end">
                            <span className="visually-hidden">+</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody onDragOver={onRowDragOver}>
                        {invLines.map((line, lineIndex) => (
                          <tr
                            key={line.key}
                            onDragOver={onRowDragOver}
                            onDrop={onRowDrop(line.key)}
                            className="quotation-line-item-row">
                            <td className="qt-line-row-drag align-middle text-center">
                              <span
                                className={`qt-line-drag-handle d-inline-flex align-items-center justify-content-center rounded px-0 py-1${lineIndex === 0 ? " opacity-50" : ""}`}
                                draggable={lineIndex !== 0}
                                title={lineIndex === 0 ? "First row stays at top" : "Drag to reorder"}
                                onDragStart={(e) => {
                                  if (lineIndex === 0) {
                                    e.preventDefault();
                                    return;
                                  }
                                  e.stopPropagation();
                                  e.dataTransfer.setData("text/plain", line.key);
                                  e.dataTransfer.effectAllowed = "move";
                                }}>
                                <Move size={16} strokeWidth={1.75} className="text-secondary" aria-hidden />
                              </span>
                            </td>
                            <td className="align-middle text-center text-muted small tabular-nums">
                              {lineIndex + 1}
                            </td>
                            <td>
                              <textarea
                                className="form-control qt-line-item-textarea"
                                rows={2}
                                placeholder={lineIndex === 0 ? "Draft row — type or pick from search" : "Item"}
                                value={line.customLabel ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setInvLines((prev) =>
                                    prev.map((l) => {
                                      if (l.key !== line.key) {
                                        return l;
                                      }
                                      let pid = l.productId;
                                      if (pid != null && String(pid).trim() !== "") {
                                        const cat = catalogProducts.find((x) => String(x.id) === String(pid));
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
                            </td>
                            <td>
                              <textarea
                                className="form-control qt-line-desc-textarea"
                                rows={2}
                                placeholder="Optional"
                                value={line.description ?? ""}
                                onChange={(e) =>
                                  setInvLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, description: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td style={{ maxWidth: 100 }}>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                className="form-control"
                                value={line.quantity}
                                onChange={(e) =>
                                  setInvLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, quantity: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td style={{ maxWidth: 110 }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={line.unitPrice}
                                onChange={(e) =>
                                  setInvLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, unitPrice: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td style={{ maxWidth: 90 }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                value={line.taxPercent ?? DEFAULT_SALES_LINE_TAX_PERCENT}
                                onChange={(e) =>
                                  setInvLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key ? { ...l, taxPercent: e.target.value } : l
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="text-end">
                              <span className="fw-medium">
                                {formatInvoiceMoneyKes(
                                  displayLineAmount(line, catalogProducts, Boolean(token))
                                )}
                              </span>
                            </td>
                            <td className="text-end align-middle">
                              {lineIndex === 0 ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  title="Commit row"
                                  onClick={commitStagingRow}>
                                  <Plus size={16} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-danger"
                                  onClick={() =>
                                    setInvLines((prev) => prev.filter((l) => l.key !== line.key))
                                  }>
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-3 quotation-crm-card">
                <div className="card-body">
                  <div className="row justify-content-end">
                    <div className="col-md-5 col-lg-4">
                      <div className="d-flex justify-content-between border-bottom py-2">
                        <span>Subtotal (ex tax)</span>
                        <span className="fw-medium">{formatInvoiceMoneyKes(invoiceKesSummary.subtotalExTax)}</span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom py-2">
                        <span>Tax</span>
                        <span className="fw-medium">{formatInvoiceMoneyKes(invoiceKesSummary.taxTotal)}</span>
                      </div>
                      {invoiceKesSummary.discountAmt > 0 ? (
                        <div className="d-flex justify-content-between border-bottom py-2">
                          <span>Discount</span>
                          <span className="fw-medium">−{formatInvoiceMoneyKes(invoiceKesSummary.discountAmt)}</span>
                        </div>
                      ) : null}
                      <div className="d-flex justify-content-between py-2">
                        <span className="fw-semibold">Total</span>
                        <span className="fw-bold">{formatInvoiceMoneyKes(invoiceKesSummary.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                  <DocumentFormActions
                    ui="tillflow"
                    onCancel={leaveCreateForm}
                    cancelLabel="Cancel"
                    saveLabel={invoiceFormMode === "edit" ? "Update invoice" : "Save invoice"}
                    saving={invSaving}
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="modal fade quotation-view-modal" id="view-invoice-modal">
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header border-bottom align-items-center flex-wrap gap-2 quotation-view-no-print">
                <div className="add-item d-flex flex-grow-1">
                  <div className="page-title mb-0">
                    <h4 className="mb-0">Invoice Details</h4>
                  </div>
                </div>
                <ul className="table-top-head mb-0">
                  <li>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0"
                      title="View PDF"
                      onClick={() => void handleViewInvoicePdfPreview()}>
                      <img src={pdf} alt="" />
                    </button>
                  </li>
                </ul>
                <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className="modal-body p-0 bg-white">
                {viewInvoiceError ? (
                  <div className="alert alert-warning m-3 mb-0" role="alert">
                    {viewInvoiceError}
                  </div>
                ) : null}
                {viewDoc ? (
                  <div className="px-3 pt-2 pb-3 quotation-view-modal-body-inner">
                    <div className="page-btn mb-2 quotation-view-no-print d-flex flex-wrap align-items-center gap-2">
                      <button type="button" className="btn btn-secondary border" data-bs-dismiss="modal">
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary d-flex justify-content-center align-items-center"
                        onClick={() => void handleViewInvoicePdfPreview()}>
                        <i className="ti ti-file-invoice me-2" />
                        View PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-primary d-flex justify-content-center align-items-center"
                        onClick={() => void handleViewInvoicePdfNewTab()}>
                        <i className="ti ti-external-link me-2" />
                        View PDF in new tab
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                        onClick={() => void handleDownloadViewInvoicePdf()}>
                        <i className="ti ti-download me-2" />
                        Download PDF
                      </button>
                    </div>
                    <InvoicePrintDocument ref={viewInvoicePrintRootRef} {...viewDoc} />
                    {token && inTillflowShell && viewInvoice?.apiId && viewInvoice.status !== "Draft" ? (
                      <div className="px-3 pb-3 quotation-view-no-print border-top pt-3 mt-2">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                          <h6 className="mb-0 fw-semibold text-success">Payments</h6>
                          {viewInvoice.status !== "Cancelled" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={() => openRecordPayment(viewInvoice)}>
                              Record payment
                            </button>
                          ) : null}
                        </div>
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered mb-0">
                            <thead>
                              <tr>
                                <th>Receipt</th>
                                <th>Paid</th>
                                <th>Method</th>
                                <th>Txn ID</th>
                                <th className="text-end">Amount</th>
                                <th className="text-end">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(viewInvoice.payments ?? []).length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-muted text-center py-2">
                                    No payments yet.
                                  </td>
                                </tr>
                              ) : (
                                (viewInvoice.payments ?? []).map((p) => (
                                  <tr key={p.id}>
                                    <td className="fw-medium">
                                      {inTillflowShell && p.id ? (
                                        <Link
                                          to={`/tillflow/admin/invoice-payments/${p.id}`}
                                          className="text-primary"
                                          onClick={(e) => e.stopPropagation()}>
                                          {p.receipt_ref}
                                        </Link>
                                      ) : (
                                        p.receipt_ref
                                      )}
                                    </td>
                                    <td className="small">{formatReceiptPaidAtDisplay(p.paid_at)}</td>
                                    <td>{paymentMethodLabel(p.payment_method)}</td>
                                    <td className="small text-break">{p.transaction_id || "—"}</td>
                                    <td className="text-end">{formatInvoiceMoneyKes(p.amount)}</td>
                                    <td className="text-end text-nowrap">
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm py-0"
                                        onClick={() => {
                                          setReceiptPreview(p);
                                          setReceiptPreviewRow(viewInvoice);
                                        }}>
                                        Receipt
                                      </button>
                                      {viewInvoice.status !== "Cancelled" ? (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm py-0"
                                          onClick={() => openViewPaymentEdit(p)}>
                                          Edit
                                        </button>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <RecordInvoicePaymentModal
          show={showRecordPayment}
          onHide={() => setShowRecordPayment(false)}
          recordPayTarget={recordPayTarget}
          recordPayAmount={recordPayAmount}
          setRecordPayAmount={setRecordPayAmount}
          recordPayMethod={recordPayMethod}
          setRecordPayMethod={setRecordPayMethod}
          recordPayPaidAt={recordPayPaidAt}
          setRecordPayPaidAt={setRecordPayPaidAt}
          recordPayTransactionId={recordPayTransactionId}
          setRecordPayTransactionId={setRecordPayTransactionId}
          recordPayNotes={recordPayNotes}
          setRecordPayNotes={setRecordPayNotes}
          recordPayError={recordPayError}
          recordPaySaving={recordPaySaving}
          onSubmit={submitRecordPayment}
        />

        <InvoiceReceiptPreviewModal
          receiptPreview={receiptPreview}
          receiptPreviewRow={receiptPreviewRow}
          receiptPrintRootRef={receiptPrintRootRef}
          onHide={() => {
            setReceiptPreview(null);
            setReceiptPreviewRow(null);
          }}
          onDownloadPdf={handleDownloadReceiptPdf}
          tillflowEmailActionsEnabled={Boolean(token && inTillflowShell)}
          onSendReceiptToCustomer={token && inTillflowShell ? handleSendReceiptToCustomer : undefined}
          onViewInvoicePdf={
            token && inTillflowShell && receiptPreviewRow ? handleViewInvoicePdfFromReceipt : undefined
          }
          onActivityLog={
            token && inTillflowShell && canViewActivityLog && receiptPreviewRow?.apiId
              ? handleReceiptActivityLog
              : undefined
          }
        />

        <ActivityLogModal
          show={activityLogOpen}
          onHide={() => setActivityLogOpen(false)}
          token={token}
          canView={canViewActivityLog}
          invoiceId={
            receiptPreviewRow?.apiId ? Number(receiptPreviewRow.apiId) : null
          }
        />

        {receiptPreview && receiptPreviewRow && token && inTillflowShell ? (
          <div
            className="position-fixed overflow-hidden"
            style={{ left: -12000, top: 0, width: 720, pointerEvents: "none", opacity: 0 }}
            aria-hidden>
            <InvoicePrintDocument
              ref={receiptInvoicePdfRootRef}
              {...buildInvoiceViewDocumentData(receiptPreviewRow)}
            />
          </div>
        ) : null}

        <DocumentPdfPreviewModal
          url={invoiceViewPdfPreviewUrl}
          title={invoiceViewPdfTitle || (viewDoc ? `Invoice ${viewDoc.invoiceNo}` : "Invoice PDF")}
          onHide={handleCloseInvoiceViewPdfPreview}
        />

        <Modal show={Boolean(receiptInfoModal)} onHide={() => setReceiptInfoModal(null)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{receiptInfoModal?.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>{receiptInfoModal?.body}</Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-primary" onClick={() => setReceiptInfoModal(null)}>
              OK
            </button>
          </Modal.Footer>
        </Modal>

        <EditInvoicePaymentModal
          viewPayEdit={viewPayEdit}
          onHide={() => setViewPayEdit(null)}
          viewPayEditAmount={viewPayEditAmount}
          setViewPayEditAmount={setViewPayEditAmount}
          viewPayEditMethod={viewPayEditMethod}
          setViewPayEditMethod={setViewPayEditMethod}
          viewPayEditPaidAt={viewPayEditPaidAt}
          setViewPayEditPaidAt={setViewPayEditPaidAt}
          viewPayEditTransactionId={viewPayEditTransactionId}
          setViewPayEditTransactionId={setViewPayEditTransactionId}
          viewPayEditNotes={viewPayEditNotes}
          setViewPayEditNotes={setViewPayEditNotes}
          viewPayEditError={viewPayEditError}
          viewPayEditSaving={viewPayEditSaving}
          onSubmit={submitViewPaymentEdit}
        />

        <InvoiceEmailPreviewModal
          show={invoiceEmailPreviewOpen}
          onHide={() => {
            if (!invoiceEmailPreviewSending) {
              resetInvoiceEmailPreview();
            }
          }}
          loading={invoiceEmailPreviewLoading}
          error={invoiceEmailPreviewError}
          subject={invoiceEmailPreviewSubject}
          html={invoiceEmailPreviewHtml}
          toEmail={invoiceEmailPreviewTo}
          message={invoiceEmailPreviewMessage}
          onChangeToEmail={setInvoiceEmailPreviewTo}
          onChangeSubject={setInvoiceEmailPreviewSubject}
          onChangeMessage={setInvoiceEmailPreviewMessage}
          showHtmlPreview={false}
          sending={invoiceEmailPreviewSending}
          sendButtonLabel={
            invoiceEmailPreviewSource === "receipt"
              ? (receiptWasSentToCustomer(receiptPreview) ? "Resend receipt" : "Send receipt")
              : invoiceEmailPreviewRow && invoiceWasIssuedToCustomer(invoiceEmailPreviewRow)
                ? "Resend email"
                : "Send email"
          }
          sendDisabled={
            !invoiceEmailPreviewRow ||
            String(invoiceEmailPreviewRow?.status ?? "") === "Cancelled" ||
            !String(invoiceEmailPreviewTo ?? "").trim()
          }
          onSend={confirmSendInvoiceFromPreview}
        />

        <Modal
          show={Boolean(invoiceCancelConfirmRow)}
          onHide={() => {
            if (!invoiceCancelSaving) {
              setInvoiceCancelConfirmRow(null);
            }
          }}
          centered
          backdrop={invoiceCancelSaving ? "static" : true}>
          <Modal.Header closeButton={!invoiceCancelSaving}>
            <Modal.Title>Cancel invoice</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0">
              Cancel this invoice? It will remain on file as cancelled and can no longer be edited or receive
              payments.
            </p>
            {invoiceCancelConfirmRow?.invoiceno ? (
              <p className="text-muted small mb-0 mt-2 fw-medium">{invoiceCancelConfirmRow.invoiceno}</p>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={invoiceCancelSaving}
              onClick={() => setInvoiceCancelConfirmRow(null)}>
              Keep invoice
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={invoiceCancelSaving}
              onClick={() => void confirmInvoiceCancel()}>
              {invoiceCancelSaving ? "Cancelling…" : "Cancel invoice"}
            </button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={Boolean(invoiceRestoreConfirmRow)}
          onHide={() => {
            if (!invoiceRestoreSaving) {
              setInvoiceRestoreConfirmRow(null);
            }
          }}
          centered
          backdrop={invoiceRestoreSaving ? "static" : true}>
          <Modal.Header closeButton={!invoiceRestoreSaving}>
            <Modal.Title>Restore invoice</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0">
              Restore this invoice? Its status will be updated from payments and the due date (Unpaid, Partially paid,
              Paid, or Overdue).
            </p>
            {invoiceRestoreConfirmRow?.invoiceno ? (
              <p className="text-muted small mb-0 mt-2 fw-medium">{invoiceRestoreConfirmRow.invoiceno}</p>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={invoiceRestoreSaving}
              onClick={() => setInvoiceRestoreConfirmRow(null)}>
              Keep cancelled
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={invoiceRestoreSaving}
              onClick={() => void confirmInvoiceRestore()}>
              {invoiceRestoreSaving ? "Restoring…" : "Restore invoice"}
            </button>
          </Modal.Footer>
        </Modal>

        <CommonFooter />
      </div>
    </div>
  );
};

export default Invoice;
