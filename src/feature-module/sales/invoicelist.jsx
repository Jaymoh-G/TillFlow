import { AutoComplete } from "primereact/autocomplete";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Move, Plus, PlusCircle, Search } from "react-feather";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CommonFooter from "../../components/footer/commonFooter";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import DocumentFormActions from "../../components/DocumentFormActions";
import { invoicereportdata } from "../../core/json/invoicereportdata";
import { all_routes } from "../../routes/all_routes";
import { listCustomersRequest } from "../../tillflow/api/customers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import {
  createInvoiceRequest,
  listInvoicesRequest,
  showInvoiceRequest,
  updateInvoiceRequest
} from "../../tillflow/api/invoices";
import { listSalesCatalogProductsRequest } from "../../tillflow/api/products";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { getCompanySettingsSnapshot, resolveQuotationFooterFromSnapshot } from "../../utils/companySettingsStorage";
import { pdf, stockImg01 } from "../../utils/imagepath";
import { downloadHtmlDocumentPdfFromElement, waitForPrintRootImages } from "../../utils/htmlDocumentPdfExport";
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
import { getInvoiceSettingsSnapshot } from "../../utils/appSettingsStorage";
import InvoicePrintDocument from "./InvoicePrintDocument";

const ALL = { label: "All", value: "" };

const TILLFLOW_INVOICES_BASE = "/tillflow/admin/invoices";
const TILLFLOW_SESSION_TOKEN_KEY = "tillflow_sanctum_token";
const STORAGE_KEY = "retailpos_invoices_v1";

const INVOICE_STATUSES = ["Draft", "Sent"];

const DISCOUNT_TYPE_OPTIONS = [
  { label: "No discount", value: "none" },
  { label: "Before tax", value: "before_tax" },
  { label: "After tax", value: "after_tax" }
];

const DISCOUNT_BASIS_OPTIONS = [
  { label: "Percentage", value: "percent" },
  { label: "Fixed amount (Ksh)", value: "fixed" }
];

function formatInvoiceMoneyKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

function formatIsoToDisplay(iso) {
  if (!iso) {
    return "";
  }
  const raw = String(iso).trim();
  const d = new Date(raw.length >= 10 ? `${raw.slice(0, 10)}T12:00:00` : raw);
  if (Number.isNaN(d.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function nextInvoiceRefLocal(list) {
  let max = 0;
  for (const r of list) {
    const m = /^INV-(\d{1,})$/i.exec(String(r.invoiceno ?? "").trim());
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `INV-${String(max + 1).padStart(6, "0")}`;
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
    return persisted;
  }
  return invoicereportdata.map((r) => ({
    ...r,
    id: String(r.id),
    apiId: null,
    issueAtIso: null,
    dueAtIso: null,
    totalNum: parseMoneyish(r.amount),
    paidNum: parseMoneyish(r.paid)
  }));
}

function parseMoneyish(s) {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Map API invoice to list row (when backend is available). */
function apiInvoiceToRow(inv) {
  const total = Number(inv.total_amount ?? 0);
  const paid = Number(inv.amount_paid ?? 0);
  const due = roundMoney(Math.max(0, total - paid));
  const cImg = inv.customer_image_url ? String(inv.customer_image_url) : stockImg01;
  const nestedCustomer = inv.customer && typeof inv.customer === "object" ? inv.customer : null;
  const invoiceTitle = String(
    inv.invoice_title ??
      inv.title ??
      inv.subject ??
      inv.subject_line ??
      inv.invoice_for ??
      ""
  ).trim();
  const createdAtRaw = String(inv.created_at ?? "").trim();
  const createdAtTs = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;
  return {
    id: String(inv.id),
    apiId: inv.id,
    invoiceno: String(inv.invoice_ref ?? inv.id),
    image: cImg,
    customer: String(inv.customer_name ?? ""),
    customerId: inv.customer_id != null ? String(inv.customer_id) : String(nestedCustomer?.id ?? ""),
    customerEmail: String(inv.customer_email ?? nestedCustomer?.email ?? ""),
    customerPhone: String(inv.customer_phone ?? nestedCustomer?.phone ?? ""),
    customerLocation: String(inv.customer_location ?? nestedCustomer?.location ?? ""),
    issueDate: formatIsoToDisplay(inv.issued_at),
    issueAtIso: inv.issued_at ? String(inv.issued_at).slice(0, 10) : "",
    duedate: formatIsoToDisplay(inv.due_at),
    dueAtIso: inv.due_at ? String(inv.due_at).slice(0, 10) : "",
    amount: formatInvoiceMoneyKes(total),
    paid: formatInvoiceMoneyKes(paid),
    amountdue: formatInvoiceMoneyKes(due),
    status: String(inv.status ?? "Draft"),
    totalNum: total,
    paidNum: paid,
    invoiceTitle,
    termsAndConditions: String(inv.terms_and_conditions ?? ""),
    notes: String(inv.notes ?? ""),
    discountType: String(inv.discount_type ?? "none"),
    discountBasis: String(inv.discount_basis ?? "percent"),
    discountValue: Number(inv.discount_value ?? 0),
    items: Array.isArray(inv.items) ? inv.items : []
    ,
    createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : null
  };
}

function parseRowDateFlexible(row) {
  if (row.issueAtIso) {
    const d = new Date(`${row.issueAtIso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseRowDateStr(row.issueDate);
}

function parseRowDateStr(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildInvoiceViewDocumentData(row) {
  const company = getCompanySettingsSnapshot();
  const invoiceSettings = getInvoiceSettingsSnapshot();
  const footer = resolveQuotationFooterFromSnapshot(company);
  const invoiceLogo = String(invoiceSettings.invoiceLogoDataUrl ?? "").trim();
  const issueDate = row?.issueAtIso || "";
  const dueDate = row?.dueAtIso || "";
  const items = Array.isArray(row?.items) ? row.items : [];
  const totalNum = Number(row?.totalNum ?? 0);
  const paidNum = Number(row?.paidNum ?? 0);

  let subtotalExTax = 0;
  let taxTotal = 0;
  const lineRows = (items.length > 0 ? items : [{ product_name: "Invoice total", quantity: 1, unit_price: totalNum, line_total: totalNum }]).map((it, idx) => {
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unit_price ?? 0);
    const lineTotal = Number(it.line_total ?? qty * unit);
    const lineSubEx = roundMoney((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0));
    const lineTax = roundMoney(lineTotal - lineSubEx);
    subtotalExTax += lineSubEx;
    taxTotal += lineTax;
    return {
      key: String(it.id ?? idx + 1),
      title: String(it.product_name ?? "Item"),
      desc: String(it.description ?? "").trim(),
      qty: Number.isFinite(qty) ? String(qty) : "0",
      cost: formatInvoiceMoneyKes(unit),
      discount: "—",
      total: formatInvoiceMoneyKes(lineTotal)
    };
  });

  subtotalExTax = roundMoney(subtotalExTax);
  taxTotal = roundMoney(taxTotal);
  const gross = roundMoney(subtotalExTax + taxTotal);
  const discountAmt = roundMoney(Math.max(0, gross - totalNum));

  return {
    invoiceNo: String(row?.invoiceno ?? "INV-000000"),
    issueDateDisplay: formatIsoToDisplay(issueDate) || "—",
    dueDateDisplay: formatIsoToDisplay(dueDate) || "—",
    statusLabel: String(row?.status ?? "Draft"),
    subjectLine: String(row?.invoiceTitle ?? "").trim(),
    seller: {
      companyName: company.companyName || "Your business",
      address: company.location || "—",
      website: company.website || "",
      email: company.email || "—",
      phone: company.phone || "—"
    },
    buyer: {
      name: String(row?.customer ?? "Customer"),
      address: String(row?.customerLocation ?? ""),
      email: String(row?.customerEmail ?? ""),
      phone: String(row?.customerPhone ?? "")
    },
    paymentPill: { label: String(row?.status ?? "Draft") },
    qrSrc: "",
    lineRows,
    totals: {
      sub: formatInvoiceMoneyKes(subtotalExTax),
      discountLine: discountAmt > 0 ? "Discount (aggregate)" : "",
      discountAmt: discountAmt > 0 ? formatInvoiceMoneyKes(discountAmt) : "",
      taxLine: "Tax",
      taxAmt: formatInvoiceMoneyKes(taxTotal),
      grandTotal: formatInvoiceMoneyKes(totalNum),
      amountInWords: ""
    },
    terms: String(row?.termsAndConditions ?? "").trim(),
    notes: String(row?.notes ?? "").trim(),
    footer,
    signBlock: null,
    logoSrc: invoiceLogo,
    logoDarkSrc: invoiceLogo,
    amountDueLabel: formatInvoiceMoneyKes(Math.max(0, totalNum - paidNum))
  };
}

const Invoice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const route = all_routes;

  const auth = useOptionalAuth();
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
      const [prodData, custData] = await Promise.all([
        listSalesCatalogProductsRequest(token),
        listCustomersRequest(token)
      ]);
      if (gen !== catalogGenRef.current) {
        return;
      }
      setCatalogProducts(prodData.products ?? []);
      setCatalogCustomers(custData.customers ?? []);
    } catch (e) {
      if (gen !== catalogGenRef.current) {
        return;
      }
      setCatalogProducts([]);
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
  const [invDueAt, setInvDueAt] = useState("");
  const [invCustomerId, setInvCustomerId] = useState("");
  const [invAmountPaid, setInvAmountPaid] = useState("0");
  const [invLines, setInvLines] = useState(() => [emptyApiSalesLine()]);
  const [invDiscountType, setInvDiscountType] = useState("none");
  const [invDiscountBasis, setInvDiscountBasis] = useState("percent");
  const [invDiscountValue, setInvDiscountValue] = useState("0");
  const [invError, setInvError] = useState("");
  const [invPopupError, setInvPopupError] = useState("");
  const [invSaving, setInvSaving] = useState(false);
  const [catalogQuickSearchText, setCatalogQuickSearchText] = useState("");
  const [catalogQuickSuggestions, setCatalogQuickSuggestions] = useState([]);
  const [catalogQuickAddKey, setCatalogQuickAddKey] = useState(0);

  const resetCreateForm = useCallback(() => {
    setInvInvoiceRef("");
    setInvTitle("");
    setInvIssueAt(new Date().toISOString().slice(0, 10));
    setInvDueAt("");
    setInvCustomerId("");
    setInvAmountPaid("0");
    setInvLines([emptyApiSalesLine()]);
    setInvDiscountType("none");
    setInvDiscountBasis("percent");
    setInvDiscountValue("0");
    setInvError("");
    setEditingInvoiceId(null);
    setEditingInvoiceApiId(null);
    setCatalogQuickSearchText("");
    setCatalogQuickSuggestions([]);
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
        if (m === "create") {
          resetCreateForm();
        }
        return m === "edit" ? m : "list";
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
    setInvPopupError(String(message ?? "").trim());
    if (invPopupTimerRef.current) {
      window.clearTimeout(invPopupTimerRef.current);
    }
    invPopupTimerRef.current = window.setTimeout(() => {
      setInvPopupError("");
      invPopupTimerRef.current = null;
    }, 2600);
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
      const validLines = filterValidApiSalesLines(invLines);
      if (validLines.length === 0) {
        showInvPopupError("add atleast one item");
        return;
      }
      const grand = invoiceKesSummary.grandTotal;
      const paidRaw = Math.max(0, Number(String(invAmountPaid).replace(/[^0-9.-]/g, "")) || 0);
      const paid = roundMoney(Math.min(paidRaw, grand));

      const items = validLines.map((l) => apiFormSalesLineToPayload(l, catalogProducts));
      const invoiceRef = String(invInvoiceRef || "").trim() || nextInvoiceRefLocal(invoices);
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
        status: "Draft",
        amount_paid: paid,
        discount_type: invDiscountType,
        discount_basis: invDiscountBasis,
        discount_value:
          invDiscountType === "none" ? null : Number(invDiscountValue.replace(/,/g, "")) || 0,
        items
      };
      const isEditing = invoiceFormMode === "edit";
      const editingApiIdStr = editingInvoiceApiId != null ? String(editingInvoiceApiId) : "";

      setInvSaving(true);
      try {
        if (isEditing && editingApiIdStr) {
          const data = await updateInvoiceRequest(token, editingApiIdStr, body);
          const updated = data?.invoice ? apiInvoiceToRow(data.invoice) : null;
          setInvoices((prev) =>
            prev.map((r) =>
              String(r.apiId ?? r.id) === editingApiIdStr
                ? {
                    ...(updated || r),
                    id: String(updated?.id ?? r.id),
                    apiId: updated?.apiId ?? r.apiId,
                    invoiceno: invoiceRef,
                    invoiceTitle: String(invTitle || "").trim(),
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
                    amountdue: formatInvoiceMoneyKes(roundMoney(grand - paid)),
                    status: "Draft",
                    totalNum: grand,
                    paidNum: paid,
                    items,
                    discountType: invDiscountType,
                    discountBasis: invDiscountBasis,
                    discountValue:
                      invDiscountType === "none" ? 0 : Number(invDiscountValue.replace(/,/g, "")) || 0
                  }
                : r
            )
          );
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
        const localRow = {
          id: isEditing ? String(editingInvoiceId ?? `local-${Date.now()}`) : `local-${Date.now()}`,
          apiId: null,
          invoiceno: invoiceRef,
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
          status: "Draft",
          totalNum: grand,
          paidNum: paid,
          invoiceTitle: String(invTitle || "").trim(),
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
      invoiceKesSummary.grandTotal,
      invAmountPaid,
      invInvoiceRef,
      invDiscountType,
      invDiscountBasis,
      invDiscountValue,
      invTitle,
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
    setInvInvoiceRef(String(row.invoiceno ?? ""));
    setInvTitle(String(row.invoiceTitle ?? ""));
    setInvIssueAt(String(row.issueAtIso ?? "").trim() || new Date().toISOString().slice(0, 10));
    setInvDueAt(String(row.dueAtIso ?? ""));
    setInvCustomerId(editCustomerId);
    setInvAmountPaid(String(Number(row.paidNum ?? 0)));
    setInvLines(normalizedLines);
    setInvDiscountType(String(row.discountType ?? "none"));
    setInvDiscountBasis(String(row.discountBasis ?? "percent"));
    setInvDiscountValue(String(row.discountValue ?? "0"));
    setInvError("");
    setInvoiceFormMode("edit");
  }, [catalogCustomers]);


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

  const customerFilterOptions = useMemo(() => {
    const names = [...new Set(invoices.map((r) => r.customer))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return [ALL, ...names.map((n) => ({ label: n, value: n }))];
  }, [invoices]);

  const statusFilterOptions = useMemo(
    () => [ALL, { label: "Draft", value: "Draft" }, { label: "Sent", value: "Sent" }],
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

  const deleteLocalRow = useCallback((row) => {
    setInvoices((prev) => prev.filter((r) => r.id !== row.id));
  }, []);

  const openViewInvoice = useCallback(
    async (row) => {
      const enrichCustomerFields = (baseRow) => {
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
      };

      setViewInvoiceError("");
      setViewInvoice(enrichCustomerFields(row));
      if (!token || !row?.apiId) {
        return;
      }
      setViewInvoiceLoading(true);
      try {
        const data = await showInvoiceRequest(token, row.apiId);
        if (data?.invoice) {
          const apiRow = enrichCustomerFields(apiInvoiceToRow(data.invoice));
          const fallbackTitle = String(row?.invoiceTitle ?? "").trim();
          const previousTitle = String(viewInvoice?.invoiceTitle ?? "").trim();
          setViewInvoice({
            ...apiRow,
            invoiceTitle: String(apiRow?.invoiceTitle ?? "").trim() || fallbackTitle || previousTitle
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
    [token, catalogCustomers, viewInvoice]
  );

  const viewDoc = useMemo(() => (viewInvoice ? buildInvoiceViewDocumentData(viewInvoice) : null), [viewInvoice]);

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

  const handlePrintViewInvoice = useCallback(() => {
    window.print();
  }, []);

  const discountFieldsActive = invDiscountType !== "none";

  const columns = useMemo(
    () => [
      {
        header: "Invoice No",
        field: "invoiceno",
        body: (rowData) =>
          inTillflowShell ? (
            <Link to="#" className="text-primary" onClick={(e) => e.preventDefault()}>
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
      { header: "Paid", field: "paid" },
      { header: "Amount Due", field: "amountdue" },
      {
        header: "Status",
        field: "status",
        body: (rowData) => (
          <div>
            {rowData.status === "Sent" && (
              <span className="badge badge-soft-success badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
            {rowData.status === "Draft" && (
              <span className="badge badge-soft-secondary badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
            {(rowData.status !== "Sent" && rowData.status !== "Draft") && (
              <span className="badge badge-soft-warning text-dark badge-xs shadow-none">
                <i className="ti ti-point-filled me-1" />
                {rowData.status}
              </span>
            )}
          </div>
        )
      },
      {
        header: "",
        field: "action",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action d-flex align-items-center justify-content-center gap-1">
            <button
              type="button"
              className="p-2 btn btn-light border rounded"
              title="Edit"
              onClick={() => openEditInvoice(row)}>
              <i className="feather icon-edit text-primary" />
            </button>
            <Link
              className="p-2 d-flex align-items-center justify-content-center border rounded"
              to={inTillflowShell ? "#" : route.invoicedetails}
              data-bs-toggle={inTillflowShell ? "modal" : undefined}
              data-bs-target={inTillflowShell ? "#view-invoice-modal" : undefined}
              onClick={
                inTillflowShell
                  ? (e) => {
                      e.preventDefault();
                      void openViewInvoice(row);
                    }
                  : undefined
              }
              title="View">
              <i className="feather icon-eye feather-eye" />
            </Link>
            <button
              type="button"
              className="p-2 btn btn-light border rounded"
              title="Remove from list"
              onClick={() => deleteLocalRow(row)}>
              <i className="feather icon-trash-2 text-danger" />
            </button>
          </div>
        )
      }
    ],
    [route.invoicedetails, inTillflowShell, deleteLocalRow, openViewInvoice, openEditInvoice]
  );

  return (
    <div>
      <div
        className={`page-wrapper invoice-list-page${inTillflowShell ? " invoice-list-page--tillflow" : ""}`}>
        <div className="content">
          {invPopupError ? (
            <div
              className="position-fixed top-0 end-0 p-3"
              style={{ zIndex: 1065, minWidth: 280, maxWidth: 360 }}>
              <div className="alert alert-danger shadow-sm mb-0 d-flex align-items-center justify-content-between gap-2">
                <span>{invPopupError}</span>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setInvPopupError("")}
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
                <TableTopHead onRefresh={resetFilters} />
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
                        options={statusFilterOptions}
                        value={filterStatus === "" ? "" : filterStatus}
                        onChange={(e) => {
                          const v = e.value;
                          setFilterStatus(v == null || v === "" ? "" : String(v));
                        }}
                        placeholder="Status"
                        filter={false}
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
                        Total due: {formatInvoiceMoneyKes(Math.max(0, invoiceKesSummary.grandTotal - Math.min(Number(invAmountPaid) || 0, invoiceKesSummary.grandTotal)))}
                      </p>
                    </div>
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
                      title="Download PDF"
                      onClick={() => void handleDownloadViewInvoicePdf()}>
                      <img src={pdf} alt="" />
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0"
                      title="Print"
                      onClick={handlePrintViewInvoice}>
                      <i className="feather icon-printer feather-rotate-ccw" />
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
                        onClick={() => void handleDownloadViewInvoicePdf()}>
                        <i className="ti ti-file-download me-2" />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-primary d-flex justify-content-center align-items-center"
                        onClick={handlePrintViewInvoice}>
                        <i className="ti ti-printer me-2" />
                        Print invoice
                      </button>
                    </div>
                    <InvoicePrintDocument ref={viewInvoicePrintRootRef} {...viewDoc} />
                    <div className="text-end mt-2 quotation-view-no-print">
                      <small className="text-muted">Amount due: {viewDoc.amountDueLabel}</small>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
    </div>
  );
};

export default Invoice;
