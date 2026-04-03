import { Edit2, Eye, PlusCircle, Trash2, X } from "react-feather";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
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

const STORAGE_KEY = "retailpos_quotations_v1";

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

function apiQuotationToRow(q) {
  const items = normalizeApiItemsForRow(q.items);
  const { label, imgSrc, exportLabel } = productSummaryFromItems(items, resolveMediaUrl);
  return {
    id: String(q.id),
    apiId: q.id,
    quoteRef: q.quote_ref,
    quotedDate: formatQuotedDisplay(q.quoted_at),
    quotedAtIso: q.quoted_at,
    customer_id: q.customer_id ?? null,
    customer_image_url: q.customer_image_url ?? null,
    productImg: imgSrc,
    Product_Name: label,
    productsExportLabel: exportLabel,
    items,
    customerImg: resolveMediaUrl(q.customer_image_url, user33),
    Custmer_Name: q.customer_name,
    Status: q.status,
    Total: Number(q.total_amount)
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
  return { key: newLineKey(), productId: "", quantity: "1", unitPrice: "" };
}

function emptyLocalLine() {
  return { key: newLineKey(), productName: "", quantity: "1", unitPrice: "", productImg: stockImg01 };
}

function parseMoneyish(s) {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** @param {Array<{ product_name?: string, product_id?: number|null, product_image_url?: string|null, quantity?: string|number, unit_price?: string|number, line_total?: string|number }>} rawItems */
function normalizeApiItemsForRow(rawItems) {
  const list = Array.isArray(rawItems) ? rawItems : [];
  return list.map((it, idx) => ({
    key: it.id != null ? `api-item-${it.id}` : `api-idx-${idx}`,
    product_id: it.product_id ?? null,
    product_name: it.product_name ?? "",
    product_image_url: it.product_image_url ?? null,
    quantity: String(it.quantity ?? 1),
    unit_price: String(it.unit_price ?? 0),
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

function displayLineTotal(line, catalogProducts, token) {
  const q = parseFloat(String(line.quantity).replace(/[^0-9.-]/g, ""));
  const qty = Number.isNaN(q) || q < 0 ? 0 : q;
  let unit = parseFloat(String(line.unitPrice).replace(/[^0-9.-]/g, ""));
  if (token && line.productId != null && line.productId !== "") {
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

const QuotationList = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");

  const auth = useOptionalAuth();
  const token = auth?.token ?? null;

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

  const [addQuoteRef, setAddQuoteRef] = useState("");
  const [addQuotedAt, setAddQuotedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [addCustomerId, setAddCustomerId] = useState("");
  const [addLines, setAddLines] = useState([emptyApiLine()]);
  const [addCustomerName, setAddCustomerName] = useState("");
  const [addStatus, setAddStatus] = useState("Pending");
  const [addProductImgUrl, setAddProductImgUrl] = useState("");
  const [addCustomerImgUrl, setAddCustomerImgUrl] = useState("");
  const [addError, setAddError] = useState("");

  const [editingRowId, setEditingRowId] = useState(null);
  const [editingApiId, setEditingApiId] = useState(null);
  const [editQuoteRef, setEditQuoteRef] = useState("");
  const [editQuotedAt, setEditQuotedAt] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editLines, setEditLines] = useState([emptyApiLine()]);
  const [editStatus, setEditStatus] = useState("Pending");
  const [editProductImgUrl, setEditProductImgUrl] = useState("");
  const [editCustomerImgUrl, setEditCustomerImgUrl] = useState("");
  const [editError, setEditError] = useState("");

  const [viewRow, setViewRow] = useState(null);
  const [deleteQuoteRef, setDeleteQuoteRef] = useState(null);
  const [deleteRowId, setDeleteRowId] = useState(null);
  const [deleteApiId, setDeleteApiId] = useState(null);

  const addQuoteTotal = useMemo(
    () => roundMoney(addLines.reduce((s, l) => s + displayLineTotal(l, catalogProducts, Boolean(token)), 0)),
    [addLines, catalogProducts, token]
  );

  const editQuoteTotal = useMemo(
    () =>
      roundMoney(
        editLines.reduce(
          (s, l) =>
            s + displayLineTotal(l, catalogProducts, Boolean(token && editingApiId != null)),
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
    setAddQuoteRef("");
    setAddQuotedAt(new Date().toISOString().slice(0, 10));
    setAddCustomerId("");
    setAddLines(token ? [emptyApiLine()] : [emptyLocalLine()]);
    setAddCustomerName("");
    setAddStatus("Pending");
    setAddProductImgUrl("");
    setAddCustomerImgUrl("");
    setAddError("");
  }, [token]);

  const openAddModal = useCallback(() => {
    resetAddForm();
  }, [resetAddForm]);

  const openEditQuotation = useCallback(
    (row) => {
      setEditingRowId(row.id);
      setEditingApiId(row.apiId ?? null);
      setEditQuoteRef(String(row.quoteRef ?? ""));
      setEditQuotedAt(row.quotedAtIso || new Date().toISOString().slice(0, 10));
      setEditCustomerId(
        row.customer_id != null && row.customer_id !== "" ? String(row.customer_id) : ""
      );
      if (token && row.apiId != null) {
        setEditCustomerName("");
        const src = row.items ?? [];
        setEditLines(
          src.length > 0
            ? src.map((it) => ({
                key: it.key ?? newLineKey(),
                productId: it.product_id != null ? String(it.product_id) : "",
                quantity: String(it.quantity ?? 1),
                unitPrice:
                  it.unit_price != null && String(it.unit_price) !== ""
                    ? String(it.unit_price)
                    : ""
              }))
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
                productImg: it.productImg ?? stockImg01
              }))
            : [emptyLocalLine()]
        );
        setEditCustomerName(String(row.Custmer_Name ?? ""));
      }
      setEditStatus(String(row.Status ?? "Pending"));
      setEditProductImgUrl(row.product_image_url ? String(row.product_image_url) : "");
      setEditCustomerImgUrl(row.customer_image_url ? String(row.customer_image_url) : "");
      setEditError("");
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

    const productUrl = addProductImgUrl.trim() || null;
    const customerUrl = addCustomerImgUrl.trim() || null;

    if (token) {
      if (!addCustomerId) {
        setAddError("Choose a customer.");
        return;
      }
      const lines = addLines.filter((l) => l.productId != null && l.productId !== "");
      if (lines.length === 0) {
        setAddError("Add at least one line with a product.");
        return;
      }
      if (addQuoteTotal <= 0) {
        setAddError("Enter valid quantities and prices for each line.");
        return;
      }
      const items = lines.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(unit) || String(l.unitPrice).trim() === "") {
          const p = catalogProducts.find((x) => String(x.id) === String(l.productId));
          unit = p?.selling_price != null ? Number(p.selling_price) : 0;
        }
        return {
          product_id: Number(l.productId),
          quantity,
          unit_price: unit
        };
      });
      try {
        const body = {
          quoted_at: addQuotedAt,
          customer_id: Number(addCustomerId),
          status: addStatus,
          items
        };
        const ref = addQuoteRef.trim();
        if (ref) {
          body.quote_ref = ref;
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
      const quoteRef = addQuoteRef.trim() || nextQuoteRefLocal(quotations);
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
        const lt = roundMoney(quantity * unit);
        return {
          key: l.key,
          productName: String(l.productName).trim(),
          quantity: String(quantity),
          unitPrice: String(unit),
          line_total: lt,
          productImg: l.productImg ?? stockImg01
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
        Total: totalNum
      };
      setQuotations((prev) => [...prev, row]);
    }

    resetAddForm();
    hideBsModal("add-quotation");
  }, [
    addQuotedAt,
    addLines,
    addCustomerId,
    addCustomerName,
    addQuoteTotal,
    addStatus,
    addQuoteRef,
    addProductImgUrl,
    addCustomerImgUrl,
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

    const productUrl = editProductImgUrl.trim() || null;
    const customerUrl = editCustomerImgUrl.trim() || null;

    if (token && editingApiId != null) {
      if (!editCustomerId) {
        setEditError("Choose a customer.");
        return;
      }
      const lines = editLines.filter((l) => l.productId != null && l.productId !== "");
      if (lines.length === 0) {
        setEditError("Add at least one line with a product.");
        return;
      }
      if (editQuoteTotal <= 0) {
        setEditError("Enter valid quantities and prices for each line.");
        return;
      }
      const items = lines.map((l) => {
        const qty = parseFloat(String(l.quantity).replace(/[^0-9.-]/g, ""));
        const quantity = Number.isNaN(qty) || qty <= 0 ? 0 : qty;
        let unit = parseFloat(String(l.unitPrice).replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(unit) || String(l.unitPrice).trim() === "") {
          const p = catalogProducts.find((x) => String(x.id) === String(l.productId));
          unit = p?.selling_price != null ? Number(p.selling_price) : 0;
        }
        return {
          product_id: Number(l.productId),
          quantity,
          unit_price: unit
        };
      });
      try {
        await updateQuotationRequest(token, editingApiId, {
          quote_ref: ref,
          quoted_at: editQuotedAt,
          customer_id: Number(editCustomerId),
          status: editStatus,
          items
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
        const lt = roundMoney(quantity * unit);
        return {
          key: l.key,
          productName: String(l.productName).trim(),
          quantity: String(quantity),
          unitPrice: String(unit),
          line_total: lt,
          productImg: l.productImg ?? stockImg01
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
    hideBsModal("edit-quotation-modal");
  }, [
    editingRowId,
    editingApiId,
    editQuoteRef,
    editQuotedAt,
    editLines,
    editCustomerId,
    editCustomerName,
    editQuoteTotal,
    editStatus,
    editProductImgUrl,
    editCustomerImgUrl,
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
              data-bs-toggle="modal"
              data-bs-target="#edit-quotation-modal"
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

  return (
    <>
      <div
        className={`page-wrapper quotation-list-page${
          inTillflowShell ? " quotation-list-page--tillflow" : ""
        }`}>
        <div className="content">
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
                data-bs-toggle="modal"
                data-bs-target="#add-quotation"
                onClick={(e) => {
                  e.preventDefault();
                  openAddModal();
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
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-quotation">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add quotation</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">Quote # (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Leave blank to auto-assign"
                      value={addQuoteRef}
                      onChange={(e) => setAddQuoteRef(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Quote date<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={addQuotedAt}
                      onChange={(e) => setAddQuotedAt(e.target.value)}
                    />
                  </div>
                  {token ? (
                    <div className="col-lg-12 mb-3">
                      <label className="form-label">
                        Customer<span className="text-danger ms-1">*</span>
                      </label>
                      <div style={{ minWidth: "12rem" }}>
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
                    </div>
                  ) : (
                    <div className="col-lg-12 mb-3">
                      <label className="form-label">
                        Customer name<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={addCustomerName}
                        onChange={(e) => setAddCustomerName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="col-12 mb-2">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <label className="form-label mb-0">
                        Line items<span className="text-danger ms-1">*</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          setAddLines((p) => [...p, token ? emptyApiLine() : emptyLocalLine()])
                        }>
                        Add line
                      </button>
                    </div>
                  </div>
                  {addLines.map((line, idx) => (
                    <div key={line.key} className="col-12 border rounded p-3 mb-2">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="text-muted small">Line {idx + 1}</span>
                        {addLines.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0"
                            aria-label="Remove line"
                            onClick={() => setAddLines((p) => p.filter((l) => l.key !== line.key))}>
                            <X size={18} strokeWidth={1.75} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <div className="row g-2">
                        {token ? (
                          <div className="col-md-6">
                            <label className="form-label small">Product</label>
                            <CommonSelect
                              className="w-100"
                              options={catalogProductPickOptions}
                              value={line.productId === "" ? "" : line.productId}
                              onChange={(e) => {
                                const v = e.value == null || e.value === "" ? "" : String(e.value);
                                setAddLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
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
                            />
                          </div>
                        ) : (
                          <div className="col-md-6">
                            <label className="form-label small">Product name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={line.productName ?? ""}
                              onChange={(e) =>
                                setAddLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key ? { ...l, productName: e.target.value } : l
                                  )
                                )
                              }
                            />
                          </div>
                        )}
                        <div className="col-md-2">
                          <label className="form-label small">Qty</label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="form-control"
                            value={line.quantity}
                            onChange={(e) =>
                              setAddLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, quantity: e.target.value } : l
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Unit price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={line.unitPrice}
                            onChange={(e) =>
                              setAddLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, unitPrice: e.target.value } : l
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <div className="w-100">
                            <label className="form-label small">Line total</label>
                            <div className="form-control bg-light">
                              {formatMoney(displayLineTotal(line, catalogProducts, Boolean(token)))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {catalogLoading && token ? (
                    <div className="col-12">
                      <p className="text-muted small mb-2">Loading catalog…</p>
                    </div>
                  ) : null}
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">Quote total</label>
                    <div className="form-control bg-light fw-medium">{formatMoney(addQuoteTotal)}</div>
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Status<span className="text-danger ms-1">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={addStatus}
                      onChange={(e) => setAddStatus(e.target.value)}>
                      <option value="Pending">Pending</option>
                      <option value="Sent">Sent</option>
                      <option value="Ordered">Ordered</option>
                    </select>
                  </div>
                  {!token ? (
                    <>
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">Product image URL</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional — absolute or /path from API"
                          value={addProductImgUrl}
                          onChange={(e) => setAddProductImgUrl(e.target.value)}
                        />
                      </div>
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">Customer image URL</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional — absolute or /path from API"
                          value={addCustomerImgUrl}
                          onChange={(e) => setAddCustomerImgUrl(e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                  {addError ? (
                    <div className="col-12">
                      <p className="text-danger small mb-0">{addError}</p>
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
                <button type="button" className="btn btn-primary fs-13 fw-medium p-2 px-3" onClick={saveNewQuotation}>
                  Save quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit-quotation-modal">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Edit quotation</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Quote #<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editQuoteRef}
                      onChange={(e) => setEditQuoteRef(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Quote date<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={editQuotedAt}
                      onChange={(e) => setEditQuotedAt(e.target.value)}
                    />
                  </div>
                  {token && editingApiId != null ? (
                    <div className="col-lg-12 mb-3">
                      <label className="form-label">
                        Customer<span className="text-danger ms-1">*</span>
                      </label>
                      <div style={{ minWidth: "12rem" }}>
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
                    </div>
                  ) : (
                    <div className="col-lg-12 mb-3">
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
                  )}
                  <div className="col-12 mb-2">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <label className="form-label mb-0">
                        Line items<span className="text-danger ms-1">*</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          setEditLines((p) => [
                            ...p,
                            token && editingApiId != null ? emptyApiLine() : emptyLocalLine()
                          ])
                        }>
                        Add line
                      </button>
                    </div>
                  </div>
                  {editLines.map((line, idx) => (
                    <div key={line.key} className="col-12 border rounded p-3 mb-2">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="text-muted small">Line {idx + 1}</span>
                        {editLines.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0"
                            aria-label="Remove line"
                            onClick={() => setEditLines((p) => p.filter((l) => l.key !== line.key))}>
                            <X size={18} strokeWidth={1.75} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <div className="row g-2">
                        {token && editingApiId != null ? (
                          <div className="col-md-6">
                            <label className="form-label small">Product</label>
                            <CommonSelect
                              className="w-100"
                              options={catalogProductPickOptions}
                              value={line.productId === "" ? "" : line.productId}
                              onChange={(e) => {
                                const v = e.value == null || e.value === "" ? "" : String(e.value);
                                setEditLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
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
                            />
                          </div>
                        ) : (
                          <div className="col-md-6">
                            <label className="form-label small">Product name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={line.productName ?? ""}
                              onChange={(e) =>
                                setEditLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key ? { ...l, productName: e.target.value } : l
                                  )
                                )
                              }
                            />
                          </div>
                        )}
                        <div className="col-md-2">
                          <label className="form-label small">Qty</label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="form-control"
                            value={line.quantity}
                            onChange={(e) =>
                              setEditLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, quantity: e.target.value } : l
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Unit price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={line.unitPrice}
                            onChange={(e) =>
                              setEditLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key ? { ...l, unitPrice: e.target.value } : l
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <div className="w-100">
                            <label className="form-label small">Line total</label>
                            <div className="form-control bg-light">
                              {formatMoney(
                                displayLineTotal(line, catalogProducts, Boolean(token && editingApiId))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">Quote total</label>
                    <div className="form-control bg-light fw-medium">{formatMoney(editQuoteTotal)}</div>
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Status<span className="text-danger ms-1">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}>
                      <option value="Pending">Pending</option>
                      <option value="Sent">Sent</option>
                      <option value="Ordered">Ordered</option>
                    </select>
                  </div>
                  {!token || editingApiId == null ? (
                    <>
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">Product image URL</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional — absolute or /path from API"
                          value={editProductImgUrl}
                          onChange={(e) => setEditProductImgUrl(e.target.value)}
                        />
                      </div>
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">Customer image URL</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional — absolute or /path from API"
                          value={editCustomerImgUrl}
                          onChange={(e) => setEditCustomerImgUrl(e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                  {editError ? (
                    <div className="col-12">
                      <p className="text-danger small mb-0">{editError}</p>
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
                <button type="button" className="btn btn-primary fs-13 fw-medium p-2 px-3" onClick={saveQuotationEdits}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="view-quotation-modal">
        <div className="modal-dialog modal-dialog-centered">
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
                  <dt className="col-sm-4">Items</dt>
                  <dd className="col-sm-8">
                    {(viewRow.items ?? []).length === 0 ? (
                      viewRow.Product_Name
                    ) : (
                      <ul className="list-unstyled mb-0 small">
                        {(viewRow.items ?? []).map((it, ix) => {
                          const qty = Number(it.quantity ?? 1);
                          const unit = Number(it.unit_price ?? it.unitPrice ?? 0);
                          const lt =
                            it.line_total != null || it.lineTotal != null
                              ? Number(it.line_total ?? it.lineTotal)
                              : roundMoney(qty * unit);
                          return (
                            <li key={it.key ?? it.id ?? `${ix}-${it.product_name ?? it.productName}`}>
                              <span className="fw-medium">{it.product_name ?? it.productName}</span>
                              {" · "}
                              Qty {it.quantity ?? 1} × {formatMoney(unit)} = {formatMoney(lt)}
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
