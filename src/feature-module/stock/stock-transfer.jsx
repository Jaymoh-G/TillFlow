import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AutoComplete } from "primereact/autocomplete";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonFooter from "../../components/footer/commonFooter";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import { stockTransferData } from "../../core/json/stock-transfer-data";
import { storeLabel } from "../../stores/storesRegistry";
import { useStores } from "../../stores/useStores";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { listProductsRequest } from "../../tillflow/api/products";
import {
  apiStockTransferToRow,
  createStockTransferRequest,
  deleteStockTransferRequest,
  listStockTransfersRequest,
  updateStockTransferRequest
} from "../../tillflow/api/stockTransfers";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { readTillflowStoredToken } from "../../tillflow/auth/tillflowToken";
import { downloadRowsExcel, downloadRowsPdf } from "../../tillflow/utils/listExport";
import { downloadImg } from "../../utils/imagepath";

const DEMO_PRODUCTS = [
  { sku: "PT001", name: "Apple iMac Pro", category: "Electronics" },
  { sku: "PT002", name: "Nike Jordan", category: "Footwear" },
  { sku: "PT003", name: "Bluetooth Headset", category: "Electronics" },
  { sku: "PT004", name: "Woodcraft Sandal", category: "Footwear" },
  { sku: "PT005", name: "Black Rim Glasses", category: "Accessories" },
  { sku: "PT006", name: "Amazon Echo Dot", category: "Electronics" }
];

function hideBsModal(id) {
  const el = document.getElementById(id);
  if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
    const inst =
      window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.hide();
  }
}

function nextId(rows) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  return max + 1;
}

function parseRowDate(s) {
  if (s == null || s === "") {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Prefer ISO `createdAt` from API; fall back to display `date` string. */
function parseTransferRowDate(row) {
  if (row?.createdAt) {
    const d = new Date(row.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return parseRowDate(row?.date);
}

function summarizeLines(lines) {
  const qty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  return { noOfProducts: lines.length, quantityTransferred: qty };
}

/** Same product → increase qty; merged row moves to the top. */
function upsertTransferLine(prev, newLine, liveMode) {
  const matchIndex = prev.findIndex((l) =>
    liveMode
      ? l.productId != null &&
        newLine.productId != null &&
        Number(l.productId) === Number(newLine.productId)
      : String(l.sku ?? "") === String(newLine.sku ?? "") &&
        String(l.sku ?? "") !== "" &&
        String(newLine.sku ?? "") !== ""
  );
  if (matchIndex === -1) {
    return [newLine, ...prev];
  }
  const next = [...prev];
  const existing = next[matchIndex];
  const merged = {
    ...existing,
    qty: (Number(existing.qty) || 0) + (Number(newLine.qty) || 0)
  };
  next.splice(matchIndex, 1);
  return [merged, ...next];
}

const ALL_FILTER = { label: "All", value: "" };

const SORT_OPTIONS = [
  { label: "Recently added", value: "recent" },
  { label: "Reference A–Z", value: "asc" },
  { label: "Reference Z–A", value: "desc" },
  { label: "Last month", value: "lastMonth" },
  { label: "Last 7 days", value: "last7" }
];

const StockTransfer = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const stores = useStores();

  const auth = useOptionalAuth();
  const token = auth?.token ?? readTillflowStoredToken();
  const liveMode = Boolean(token);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(
    () => Boolean(readTillflowStoredToken())
  );
  const [productsError, setProductsError] = useState("");

  const loadCatalog = useCallback(async () => {
    if (!token) {
      return;
    }
    setProductsError("");
    setProductsLoading(true);
    try {
      const data = await listProductsRequest(token);
      setCatalogProducts(data.products ?? []);
    } catch (e) {
      setCatalogProducts([]);
      if (e instanceof TillFlowApiError) {
        setProductsError(
          e.status === 403 ? `${e.message} (needs catalog access)` : e.message
        );
      } else {
        setProductsError("Could not load items from catalog.");
      }
    } finally {
      setProductsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadCatalog();
    }
  }, [token, loadCatalog]);

  const [transfers, setTransfers] = useState(() =>
    readTillflowStoredToken()
      ? []
      : stockTransferData.map((r) => ({
          ...r,
          lines: Array.isArray(r.lines) ? r.lines : []
        }))
  );
  const [transfersLoading, setTransfersLoading] = useState(() =>
    Boolean(readTillflowStoredToken())
  );
  const [transfersError, setTransfersError] = useState("");

  const loadTransfers = useCallback(async () => {
    if (!token) {
      return;
    }
    setTransfersError("");
    setTransfersLoading(true);
    try {
      const data = await listStockTransfersRequest(token);
      const raw = Array.isArray(data?.transfers) ? data.transfers : [];
      const mapped = raw
        .map((t) => apiStockTransferToRow(t))
        .filter(Boolean);
      setTransfers(mapped);
    } catch (e) {
      setTransfers([]);
      if (e instanceof TillFlowApiError) {
        setTransfersError(
          e.status === 403 ? `${e.message} (needs catalog access)` : e.message
        );
      } else {
        setTransfersError("Could not load stock transfers.");
      }
    } finally {
      setTransfersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadTransfers();
    }
  }, [token, loadTransfers]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [sortMode, setSortMode] = useState("recent");

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [selectedTransfers, setSelectedTransfers] = useState([]);

  const [addFrom, setAddFrom] = useState(null);
  const [addTo, setAddTo] = useState(null);
  const [addRef, setAddRef] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addLines, setAddLines] = useState([]);
  /** Input must stay a string (Prime AutoComplete + field breaks if value is an object). */
  const [addProductQuery, setAddProductQuery] = useState("");
  /** Set when user picks a row from the suggestion list (used by Add). */
  const [addPendingProduct, setAddPendingProduct] = useState(null);
  const [addProductSuggestions, setAddProductSuggestions] = useState([]);
  const [addProductAutocompleteKey, setAddProductAutocompleteKey] = useState(0);
  const [addLineQty, setAddLineQty] = useState("1");
  const [formError, setFormError] = useState("");

  const [editing, setEditing] = useState(null);
  const [editFrom, setEditFrom] = useState(null);
  const [editTo, setEditTo] = useState(null);
  const [editRef, setEditRef] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState([]);
  const [editProductQuery, setEditProductQuery] = useState("");
  const [editPendingProduct, setEditPendingProduct] = useState(null);
  const [editProductSuggestions, setEditProductSuggestions] = useState([]);
  const [editProductAutocompleteKey, setEditProductAutocompleteKey] = useState(0);
  const [editLineQty, setEditLineQty] = useState("1");
  const [editError, setEditError] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [importFrom, setImportFrom] = useState(null);
  const [importTo, setImportTo] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

  const storeFilterOptions = useMemo(
    () => [
      ALL_FILTER,
      ...stores
        .map((s) => ({ label: s.name, value: String(s.id) }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    ],
    [stores]
  );

  const storeSelectOptions = useMemo(
    () => [
      { label: "Select store", value: null },
      ...stores.map((s) => ({
        label: `${s.name} (${s.code})`,
        value: s.id
      }))
    ],
    [stores]
  );

  const importStoreOptions = useMemo(
    () => [
      { label: "Select", value: null },
      ...stores.map((s) => ({ label: s.name, value: s.id }))
    ],
    [stores]
  );

  const filterProductsForTransfer = useCallback(
    (query) => {
      const q = String(query ?? "")
        .trim()
        .toLowerCase();
      if (liveMode) {
        if (!catalogProducts.length) {
          return [];
        }
        return catalogProducts
          .filter((p) => {
            if (!q) {
              return true;
            }
            const name = String(p.name ?? "").toLowerCase();
            const sku = String(p.sku ?? "").toLowerCase();
            return name.includes(q) || sku.includes(q);
          })
          .slice(0, 60);
      }
      return DEMO_PRODUCTS.filter((p) => {
        if (!q) {
          return true;
        }
        const name = String(p.name ?? "").toLowerCase();
        const sku = String(p.sku ?? "").toLowerCase();
        return name.includes(q) || sku.includes(q);
      }).slice(0, 60);
    },
    [liveMode, catalogProducts]
  );

  const completeAddProduct = useCallback(
    (e) => {
      setAddProductSuggestions(filterProductsForTransfer(e.query));
    },
    [filterProductsForTransfer]
  );

  const completeEditProduct = useCallback(
    (e) => {
      setEditProductSuggestions(filterProductsForTransfer(e.query));
    },
    [filterProductsForTransfer]
  );

  const onAddProductChange = useCallback((e) => {
    const v = e.value;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      if (liveMode ? v.id != null : v.sku != null) {
        return;
      }
    }
    setAddPendingProduct(null);
    setAddProductQuery(typeof v === "string" || v == null ? v ?? "" : String(v));
  }, [liveMode]);

  const onAddProductSelect = useCallback(
    (e) => {
      const p = e.value;
      if (!p) {
        return;
      }
      setAddPendingProduct(p);
      setAddProductQuery(String(p.name ?? ""));
    },
    []
  );

  const onEditProductChange = useCallback((e) => {
    const v = e.value;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      if (liveMode ? v.id != null : v.sku != null) {
        return;
      }
    }
    setEditPendingProduct(null);
    setEditProductQuery(typeof v === "string" || v == null ? v ?? "" : String(v));
  }, [liveMode]);

  const onEditProductSelect = useCallback((e) => {
    const p = e.value;
    if (!p) {
      return;
    }
    setEditPendingProduct(p);
    setEditProductQuery(String(p.name ?? ""));
  }, []);

  const statusOptions = [
    { label: "Select", value: "" },
    { label: "Sent", value: "sent" },
    { label: "Pending", value: "pending" }
  ];

  const displayRows = useMemo(() => {
    let list = [...transfers];
    if (filterFrom !== "") {
      list = list.filter(
        (r) => String(r.fromStoreId) === String(filterFrom)
      );
    }
    if (filterTo !== "") {
      list = list.filter((r) => String(r.toStoreId) === String(filterTo));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const fromN = storeLabel(stores, r.fromStoreId).toLowerCase();
        const toN = storeLabel(stores, r.toStoreId).toLowerCase();
        const inLines =
          Array.isArray(r.lines) &&
          r.lines.some(
            (l) =>
              String(l.name || "")
                .toLowerCase()
                .includes(q) ||
              String(l.sku || "")
                .toLowerCase()
                .includes(q)
          );
        return (
          fromN.includes(q) ||
          toN.includes(q) ||
          String(r.refNumber).toLowerCase().includes(q) ||
          inLines
        );
      });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);

    if (sortMode === "lastMonth") {
      list = list.filter((r) => {
        const d = parseTransferRowDate(r);
        return d && d >= startOfMonth;
      });
    } else if (sortMode === "last7") {
      list = list.filter((r) => {
        const d = parseTransferRowDate(r);
        return d && d >= last7;
      });
    }

    if (sortMode === "asc") {
      list.sort((a, b) =>
        String(a.refNumber).localeCompare(String(b.refNumber))
      );
    } else if (sortMode === "desc") {
      list.sort((a, b) =>
        String(b.refNumber).localeCompare(String(a.refNumber))
      );
    } else {
      list.sort((a, b) => {
        const da = parseTransferRowDate(a);
        const db = parseTransferRowDate(b);
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
  }, [transfers, filterFrom, filterTo, searchQuery, sortMode, stores]);

  const totalRecords = displayRows.length;

  const handleExportExcel = useCallback(async () => {
    const records = displayRows.map((row) => ({
      "From store": storeLabel(stores, row.fromStoreId),
      "To store": storeLabel(stores, row.toStoreId),
      "No. of products": row.noOfProducts,
      "Qty transferred": row.quantityTransferred,
      Ref: String(row.refNumber ?? ""),
      Date: String(row.date ?? ""),
      Notes: String(row.notes ?? "")
    }));
    await downloadRowsExcel(records, "Stock transfers", "stock-transfers");
  }, [displayRows, stores]);

  const handleExportPdf = useCallback(async () => {
    const body = displayRows.map((row) => [
      storeLabel(stores, row.fromStoreId),
      storeLabel(stores, row.toStoreId),
      String(row.noOfProducts ?? ""),
      String(row.quantityTransferred ?? ""),
      String(row.refNumber ?? ""),
      String(row.date ?? ""),
      String(row.notes ?? "")
    ]);
    await downloadRowsPdf(
      "Stock transfers",
      ["From store", "To store", "No. of products", "Qty transferred", "Ref", "Date", "Notes"],
      body,
      "stock-transfers"
    );
  }, [displayRows, stores]);

  const resetAddForm = useCallback(() => {
    setAddFrom(null);
    setAddTo(null);
    setAddRef("");
    setAddNotes("");
    setAddLines([]);
    setAddProductQuery("");
    setAddPendingProduct(null);
    setAddProductSuggestions([]);
    setAddProductAutocompleteKey((k) => k + 1);
    setAddLineQty("1");
    setFormError("");
  }, []);

  const openEdit = useCallback((row) => {
    setEditing(row);
    setEditFrom(row.fromStoreId ?? null);
    setEditTo(row.toStoreId ?? null);
    setEditRef(row.refNumber);
    setEditNotes(row.notes ?? "");
    setEditProductQuery("");
    setEditPendingProduct(null);
    setEditProductSuggestions([]);
    setEditProductAutocompleteKey((k) => k + 1);
    setEditLineQty("1");
    setEditError("");
    let lines = row.lines?.length
      ? row.lines.map((l, i) => ({
          ...l,
          lineId: l.lineId ?? `ln-${row.id}-${i}`
        }))
      : [
          {
            lineId: `ln-${row.id}-0`,
            name: "Line items",
            sku: "—",
            category: "—",
            qty: row.quantityTransferred
          }
        ];
    setEditLines(lines);
  }, []);

  const handleAddLine = () => {
    let p = addPendingProduct;
    if (p && liveMode && p.id != null) {
      p = catalogProducts.find((x) => x.id === p.id) ?? p;
    } else if (p && !liveMode && p.sku) {
      p = DEMO_PRODUCTS.find((x) => x.sku === p.sku) ?? p;
    }
    if (!p) {
      setFormError("Search and select a product from the list.");
      return;
    }
    const q = parseInt(addLineQty, 10);
    if (!Number.isFinite(q) || q < 1) {
      setFormError("Enter a quantity of at least 1.");
      return;
    }
    setFormError("");
    const newLine = liveMode
      ? {
          lineId: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          productId: p.id,
          name: p.name ?? "—",
          sku: p.sku ?? "—",
          category: p.category?.name ?? "—",
          qty: q
        }
      : {
          lineId: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: p.name,
          sku: p.sku,
          category: p.category,
          qty: q
        };
    setAddLines((prev) => upsertTransferLine(prev, newLine, liveMode));
    setAddProductQuery("");
    setAddPendingProduct(null);
    setAddProductSuggestions([]);
    setAddProductAutocompleteKey((k) => k + 1);
    setAddLineQty("1");
  };

  const handleEditAddLine = () => {
    let p = editPendingProduct;
    if (p && liveMode && p.id != null) {
      p = catalogProducts.find((x) => x.id === p.id) ?? p;
    } else if (p && !liveMode && p.sku) {
      p = DEMO_PRODUCTS.find((x) => x.sku === p.sku) ?? p;
    }
    if (!p) {
      setEditError("Search and select a product from the list.");
      return;
    }
    const q = parseInt(editLineQty, 10);
    if (!Number.isFinite(q) || q < 1) {
      setEditError("Enter a quantity of at least 1.");
      return;
    }
    setEditError("");
    const newLine = liveMode
      ? {
          lineId: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          productId: p.id,
          name: p.name ?? "—",
          sku: p.sku ?? "—",
          category: p.category?.name ?? "—",
          qty: q
        }
      : {
          lineId: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: p.name,
          sku: p.sku,
          category: p.category,
          qty: q
        };
    setEditLines((prev) => upsertTransferLine(prev, newLine, liveMode));
    setEditProductQuery("");
    setEditPendingProduct(null);
    setEditProductSuggestions([]);
    setEditProductAutocompleteKey((k) => k + 1);
    setEditLineQty("1");
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (addFrom == null || addTo == null) {
      setFormError("Choose both stores.");
      return;
    }
    if (Number(addFrom) === Number(addTo)) {
      setFormError("Source and destination must differ.");
      return;
    }
    if (!addLines.length) {
      setFormError("Add at least one product line.");
      return;
    }
    const refRaw =
      addRef.trim() ||
      `ST-${Date.now().toString(36).toUpperCase()}`;
    const refNumber = refRaw.startsWith("#")
      ? refRaw
      : `#${refRaw.replace(/^#/, "")}`;

    if (liveMode && token) {
      const missingPid = addLines.some(
        (l) => l.productId == null || Number(l.productId) < 1
      );
      if (missingPid) {
        setFormError("Each line must include a catalog product.");
        return;
      }
      setFormError("");
      try {
        const data = await createStockTransferRequest(token, {
          from_store_id: Number(addFrom),
          to_store_id: Number(addTo),
          ref_number: refNumber,
          notes: addNotes.trim() ? addNotes.trim() : null,
          lines: addLines.map((l) => ({
            product_id: Number(l.productId),
            qty: Number(l.qty) || 0
          }))
        });
        const row = apiStockTransferToRow(data?.transfer);
        if (row) {
          setTransfers((prev) => [row, ...prev]);
        }
        resetAddForm();
        hideBsModal("add-stock-transfer");
      } catch (err) {
        setFormError(
          err instanceof TillFlowApiError
            ? err.message
            : "Could not create stock transfer."
        );
      }
      return;
    }

    const { noOfProducts, quantityTransferred } = summarizeLines(addLines);
    const when = new Date().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    setTransfers((prev) => [
      {
        id: nextId(prev),
        fromStoreId: Number(addFrom),
        toStoreId: Number(addTo),
        noOfProducts,
        quantityTransferred,
        refNumber,
        date: when,
        notes: addNotes.trim() || undefined,
        lines: addLines.map(({ lineId: _lid, ...rest }) => ({ ...rest }))
      },
      ...prev
    ]);
    resetAddForm();
    hideBsModal("add-stock-transfer");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editing) {
      return;
    }
    if (editFrom == null || editTo == null) {
      setEditError("Choose both stores.");
      return;
    }
    if (Number(editFrom) === Number(editTo)) {
      setEditError("Source and destination must differ.");
      return;
    }
    if (!editLines.length) {
      setEditError("Keep at least one product line.");
      return;
    }
    const ref =
      editRef.trim().startsWith("#") ? editRef.trim() : `#${editRef.replace(/^#/, "")}`;

    if (liveMode && token) {
      const missingPid = editLines.some(
        (l) => l.productId == null || Number(l.productId) < 1
      );
      if (missingPid) {
        setEditError("Each line must include a catalog product.");
        return;
      }
      setEditError("");
      try {
        const data = await updateStockTransferRequest(token, editing.id, {
          from_store_id: Number(editFrom),
          to_store_id: Number(editTo),
          ref_number: ref,
          notes: editNotes.trim() ? editNotes.trim() : null,
          lines: editLines.map((l) => ({
            product_id: Number(l.productId),
            qty: Number(l.qty) || 0
          }))
        });
        const updated = apiStockTransferToRow(data?.transfer);
        if (updated) {
          setTransfers((prev) =>
            prev.map((r) => (r.id === editing.id ? updated : r))
          );
        }
        setEditing(null);
        hideBsModal("edit-stock-transfer");
      } catch (err) {
        setEditError(
          err instanceof TillFlowApiError
            ? err.message
            : "Could not update stock transfer."
        );
      }
      return;
    }

    const { noOfProducts, quantityTransferred } = summarizeLines(editLines);

    setTransfers((prev) =>
      prev.map((r) =>
        r.id === editing.id
          ? {
              ...r,
              fromStoreId: Number(editFrom),
              toStoreId: Number(editTo),
              refNumber: ref,
              noOfProducts,
              quantityTransferred,
              notes: editNotes.trim() || undefined,
              lines: editLines.map(({ lineId: _lid, ...rest }) => ({ ...rest }))
            }
          : r
      )
    );
    setEditing(null);
    hideBsModal("edit-stock-transfer");
  };

  const confirmDelete = async () => {
    if (deleteTargetId == null) {
      return;
    }
    const id = deleteTargetId;
    setDeleteError("");
    if (liveMode && token) {
      try {
        await deleteStockTransferRequest(token, id);
        setTransfers((prev) => prev.filter((r) => r.id !== id));
        setSelectedTransfers((sel) => sel.filter((r) => r.id !== id));
      } catch (e) {
        setDeleteError(
          e instanceof TillFlowApiError
            ? e.message
            : "Could not delete stock transfer."
        );
        return;
      }
    } else {
      setTransfers((prev) => prev.filter((r) => r.id !== id));
      setSelectedTransfers((sel) => sel.filter((r) => r.id !== id));
    }
    setDeleteTargetId(null);
    hideBsModal("delete-stock-transfer");
  };

  const columns = [
    {
      header: "From store",
      field: "fromStoreId",
      key: "fromStoreId",
      body: (row) => storeLabel(stores, row.fromStoreId)
    },
    {
      header: "To store",
      field: "toStoreId",
      key: "toStoreId",
      body: (row) => storeLabel(stores, row.toStoreId)
    },
    { header: "No. of products", field: "noOfProducts", key: "noOfProducts" },
    {
      header: "Qty transferred",
      field: "quantityTransferred",
      key: "quantityTransferred"
    },
    { header: "Ref", field: "refNumber", key: "refNumber" },
    { header: "Date", field: "date", key: "date" },
    {
      header: "",
      field: "actions",
      key: "actions",
      sortable: false,
      body: (row) => (
        <div className="edit-delete-action d-flex align-items-center justify-content-center">
          <button
            type="button"
            className="me-2 p-2 d-flex align-items-center justify-content-between border rounded bg-transparent"
            data-bs-toggle="modal"
            data-bs-target="#edit-stock-transfer"
            onClick={() => openEdit(row)}
            title="Edit">
            <i className="feather icon-edit" />
          </button>
          <button
            type="button"
            className="p-2 d-flex align-items-center justify-content-between border rounded bg-transparent"
            data-bs-toggle="modal"
            data-bs-target="#delete-stock-transfer"
            onClick={() => {
              setDeleteError("");
              setDeleteTargetId(row.id);
            }}
            title="Delete">
            <i className="feather icon-trash-2" />
          </button>
        </div>
      )
    }
  ];

  const handleSearch = (value) => {
    setSearchQuery(value ?? "");
    setCurrentPage(1);
  };

  return (
    <>
      <div
        className={`page-wrapper stock-transfer-page${
          inTillflowShell ? " stock-transfer-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Transfer Stock</h4>
                <h6>
                  {inTillflowShell
                    ? "Plan moves between inventory stores. Products on each transfer line are loaded from your Items catalog (same list as Add Stock)."
                    : "Move stock between inventory stores — maintain stores under Stock link"}
                </h6>
              </div>
            </div>
            <TableTopHead
              onRefresh={() => {
                setFilterFrom("");
                setFilterTo("");
                setSortMode("recent");
                setSearchQuery("");
                if (token) {
                  void loadTransfers();
                } else {
                  setTransfers(
                    stockTransferData.map((r) => ({
                      ...r,
                      lines: Array.isArray(r.lines) ? r.lines : []
                    }))
                  );
                }
                setCurrentPage(1);
                void loadCatalog();
              }}
              onExportPdf={
                transfersLoading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportPdf()
              }
              onExportExcel={
                transfersLoading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportExcel()
              }
            />
            <div className="page-btn d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-stock-transfer"
                onClick={resetAddForm}>
                <i className="ti ti-circle-plus me-1" />
                Add new
              </button>
              <Link
                to={
                  inTillflowShell
                    ? "/tillflow/admin/stores"
                    : "/manage-stores"
                }
                className="btn btn-outline-secondary">
                <i className="feather icon-home me-1" />
                Manage stores
              </Link>
              {inTillflowShell ? (
                <Link
                  to="/tillflow/admin/stock-adjustment"
                  className="btn btn-outline-secondary">
                  <i className="feather icon-trending-up me-1" />
                  Adjust Stock
                </Link>
              ) : null}
            </div>
            <div className="page-btn import">
              <Link
                to="#"
                className="btn btn-secondary color"
                data-bs-toggle="modal"
                data-bs-target="#import-stock-transfer">
                <i className="feather icon-download me-1" />
                Import transfer
              </Link>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={handleSearch}
                rows={rows}
                setRows={setRows}
              />
              {liveMode && transfersError ? (
                <div className="alert alert-danger py-2 mb-0 w-100">
                  {transfersError}
                </div>
              ) : null}
              {liveMode && transfersLoading ? (
                <div className="text-muted small w-100">Loading transfers…</div>
              ) : null}
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3 gap-2">
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={storeFilterOptions}
                    value={filterFrom === "" ? "" : filterFrom}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterFrom(
                        v == null || v === "" ? "" : String(v)
                      );
                      setCurrentPage(1);
                    }}
                    placeholder="From store"
                    filter
                  />
                </div>
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={storeFilterOptions}
                    value={filterTo === "" ? "" : filterTo}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterTo(
                        v == null || v === "" ? "" : String(v)
                      );
                      setCurrentPage(1);
                    }}
                    placeholder="To store"
                    filter
                  />
                </div>
                <div style={{ minWidth: "11rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={SORT_OPTIONS}
                    value={sortMode}
                    onChange={(e) => {
                      setSortMode(e.value ?? "recent");
                      setCurrentPage(1);
                    }}
                    placeholder="Sort"
                    filter={false}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <PrimeDataTable
                column={columns}
                data={displayRows}
                rows={rows}
                setRows={setRows}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalRecords={totalRecords}
                selectionMode="checkbox"
                selection={selectedTransfers}
                onSelectionChange={(e) => setSelectedTransfers(e.value)}
                dataKey="id"
              />
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-stock-transfer">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add transfer</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleCreateTransfer}>
              <div className="modal-body">
                {formError ? (
                  <div className="alert alert-warning py-2 mb-3">{formError}</div>
                ) : null}
                {liveMode && productsError ? (
                  <div className="alert alert-danger py-2 mb-3">{productsError}</div>
                ) : null}
                {liveMode && productsLoading ? (
                  <div className="text-muted small mb-3">Loading catalog items…</div>
                ) : null}
                <div className="row">
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Store from{" "}
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={storeSelectOptions}
                        value={addFrom}
                        onChange={(e) =>
                          setAddFrom(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="Store from"
                        filter
                      />
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Store to{" "}
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={storeSelectOptions}
                        value={addTo}
                        onChange={(e) =>
                          setAddTo(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="Store to"
                        filter
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Reference number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addRef}
                        onChange={(e) => setAddRef(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <label className="form-label mb-2">
                      Products <span className="text-danger ms-1">*</span>
                    </label>
                    <div className="row g-2 align-items-end mb-2 pb-2 border-bottom quotation-catalog-add">
                      <div className="col-12">
                        <label
                          className="visually-hidden"
                          htmlFor={`transfer-add-product-${addProductAutocompleteKey}`}>
                          Search product to add
                        </label>
                        <div className="row g-2 g-md-3 align-items-stretch quotation-crm-items-toolbar">
                          <div className="col-12 col-md min-w-0">
                            <div className="primereact-common-select w-100">
                              <AutoComplete
                                key={`add-transfer-product-${addProductAutocompleteKey}`}
                                inputId={`transfer-add-product-${addProductAutocompleteKey}`}
                                value={addProductQuery}
                                suggestions={addProductSuggestions}
                                completeMethod={completeAddProduct}
                                onChange={onAddProductChange}
                                onSelect={onAddProductSelect}
                                field="name"
                                placeholder="Product"
                                className="w-100 quotation-catalog-autocomplete"
                                inputClassName="form-control"
                                appendTo={
                                  typeof document !== "undefined"
                                    ? document.body
                                    : null
                                }
                                minLength={0}
                                dropdown
                                dropdownMode="current"
                                showEmptyMessage
                                emptyMessage={
                                  liveMode && !catalogProducts.length
                                    ? "No items in catalog"
                                    : "No products match"
                                }
                                disabled={
                                  liveMode &&
                                  (productsLoading || !!productsError)
                                }
                                itemTemplate={(item) => (
                                  <span>
                                    {item.name}{" "}
                                    <span className="text-muted">
                                      (
                                      {item.sku != null &&
                                      String(item.sku) !== ""
                                        ? item.sku
                                        : "—"}
                                      )
                                    </span>
                                  </span>
                                )}
                              />
                            </div>
                          </div>
                          <div className="col-12 col-md-auto flex-shrink-0">
                            <label
                              className="visually-hidden"
                              htmlFor={`transfer-add-qty-${addProductAutocompleteKey}`}>
                              Quantity
                            </label>
                            <input
                              id={`transfer-add-qty-${addProductAutocompleteKey}`}
                              type="number"
                              min={1}
                              className="form-control text-end tf-transfer-line-qty"
                              value={addLineQty}
                              onChange={(e) => setAddLineQty(e.target.value)}
                              placeholder="Qty"
                            />
                          </div>
                          <div className="col-12 col-md-auto d-flex justify-content-md-end align-items-stretch">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary tf-transfer-add-line-btn w-100 w-md-auto align-self-center px-2"
                              onClick={handleAddLine}
                              disabled={
                                liveMode &&
                                (productsLoading ||
                                  !!productsError ||
                                  !catalogProducts.length)
                              }>
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {addLines.length ? (
                      <div className="table-responsive border rounded">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>SKU</th>
                              <th>Category</th>
                              <th className="text-end">Qty</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {addLines.map((l) => (
                              <tr key={l.lineId}>
                                <td>{l.name}</td>
                                <td>{l.sku}</td>
                                <td>{l.category}</td>
                                <td className="text-end">{l.qty}</td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm text-danger p-0"
                                    onClick={() =>
                                      setAddLines((p) =>
                                        p.filter((x) => x.lineId !== l.lineId)
                                      )
                                    }>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">
                        Add one or more lines to this transfer.
                      </p>
                    )}
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-0">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit-stock-transfer">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Edit transfer</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={() => setEditing(null)}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {editError ? (
                  <div className="alert alert-warning py-2 mb-3">{editError}</div>
                ) : null}
                {liveMode && productsError ? (
                  <div className="alert alert-danger py-2 mb-3">{productsError}</div>
                ) : null}
                {liveMode && productsLoading ? (
                  <div className="text-muted small mb-3">Loading catalog items…</div>
                ) : null}
                <div className="row">
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Store from{" "}
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={storeSelectOptions}
                        value={editFrom}
                        onChange={(e) =>
                          setEditFrom(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="Store from"
                        filter
                      />
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Store to{" "}
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={storeSelectOptions}
                        value={editTo}
                        onChange={(e) =>
                          setEditTo(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="Store to"
                        filter
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Reference <span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRef}
                        onChange={(e) => setEditRef(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <label className="form-label mb-2">Products</label>
                    <div className="row g-2 align-items-end mb-2 pb-2 border-bottom quotation-catalog-add">
                      <div className="col-12">
                        <label
                          className="visually-hidden"
                          htmlFor={`transfer-edit-product-${editProductAutocompleteKey}`}>
                          Search product to add
                        </label>
                        <div className="row g-2 g-md-3 align-items-stretch quotation-crm-items-toolbar">
                          <div className="col-12 col-md min-w-0">
                            <div className="primereact-common-select w-100">
                              <AutoComplete
                                key={`edit-transfer-product-${editProductAutocompleteKey}`}
                                inputId={`transfer-edit-product-${editProductAutocompleteKey}`}
                                value={editProductQuery}
                                suggestions={editProductSuggestions}
                                completeMethod={completeEditProduct}
                                onChange={onEditProductChange}
                                onSelect={onEditProductSelect}
                                field="name"
                                placeholder="Product"
                                className="w-100 quotation-catalog-autocomplete"
                                inputClassName="form-control"
                                appendTo={
                                  typeof document !== "undefined"
                                    ? document.body
                                    : null
                                }
                                minLength={0}
                                dropdown
                                dropdownMode="current"
                                showEmptyMessage
                                emptyMessage={
                                  liveMode && !catalogProducts.length
                                    ? "No items in catalog"
                                    : "No products match"
                                }
                                disabled={
                                  liveMode &&
                                  (productsLoading || !!productsError)
                                }
                                itemTemplate={(item) => (
                                  <span>
                                    {item.name}{" "}
                                    <span className="text-muted">
                                      (
                                      {item.sku != null &&
                                      String(item.sku) !== ""
                                        ? item.sku
                                        : "—"}
                                      )
                                    </span>
                                  </span>
                                )}
                              />
                            </div>
                          </div>
                          <div className="col-12 col-md-auto flex-shrink-0">
                            <label
                              className="visually-hidden"
                              htmlFor={`transfer-edit-qty-${editProductAutocompleteKey}`}>
                              Quantity
                            </label>
                            <input
                              id={`transfer-edit-qty-${editProductAutocompleteKey}`}
                              type="number"
                              min={1}
                              className="form-control text-end tf-transfer-line-qty"
                              value={editLineQty}
                              onChange={(e) => setEditLineQty(e.target.value)}
                            />
                          </div>
                          <div className="col-12 col-md-auto d-flex justify-content-md-end align-items-stretch">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary tf-transfer-add-line-btn w-100 w-md-auto align-self-center px-2"
                              onClick={handleEditAddLine}
                              disabled={
                                liveMode &&
                                (productsLoading ||
                                  !!productsError ||
                                  !catalogProducts.length)
                              }>
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive border rounded">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Category</th>
                            <th className="text-end">Qty</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {editLines.map((l) => (
                            <tr key={l.lineId}>
                              <td>{l.name}</td>
                              <td>{l.sku}</td>
                              <td>{l.category}</td>
                              <td className="text-end">
                                <input
                                  type="number"
                                  min={1}
                                  className="form-control form-control-sm text-end tf-transfer-line-qty"
                                  value={l.qty}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    setEditLines((prev) =>
                                      prev.map((x) =>
                                        x.lineId === l.lineId
                                          ? {
                                              ...x,
                                              qty: Number.isFinite(n)
                                                ? Math.max(1, n)
                                                : 1
                                            }
                                          : x
                                      )
                                    );
                                  }}
                                />
                              </td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger p-0"
                                  disabled={editLines.length <= 1}
                                  onClick={() =>
                                    setEditLines((p) =>
                                      p.filter((x) => x.lineId !== l.lineId)
                                    )
                                  }>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-0">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  data-bs-dismiss="modal"
                  onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="import-stock-transfer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Import transfer</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                hideBsModal("import-stock-transfer");
              }}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        From<span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={importStoreOptions}
                        value={importFrom}
                        onChange={(e) =>
                          setImportFrom(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="From store"
                        filter={false}
                      />
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        To<span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={importStoreOptions}
                        value={importTo}
                        onChange={(e) =>
                          setImportTo(
                            e.value == null || e.value === ""
                              ? null
                              : Number(e.value)
                          )
                        }
                        placeholder="To store"
                        filter={false}
                      />
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <CommonSelect
                        className="w-100"
                        options={statusOptions}
                        value={importStatus}
                        onChange={(e) => setImportStatus(e.value || null)}
                        placeholder="Status"
                        filter={false}
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3 image-upload-down">
                      <label className="form-label">Upload CSV file</label>
                      <div className="image-upload download">
                        <input type="file" accept=".csv,text/csv" />
                        <div className="image-uploads">
                          <img src={downloadImg} alt="" />
                          <h4>
                            Drag and drop a <span>file to upload</span>
                          </h4>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-0">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={3} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary me-2"
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

      <div className="modal fade" id="delete-stock-transfer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="content p-5 px-3 text-center">
              <span className="rounded-circle d-inline-flex p-2 bg-danger-transparent mb-2">
                <i className="ti ti-trash fs-24 text-danger" />
              </span>
              <h4 className="mb-0 delete-account-font">
                Delete this stock transfer?
              </h4>
              <p className="text-muted small mt-2 mb-0">
                {liveMode
                  ? "This permanently deletes the transfer record from the database."
                  : "This only removes the row from the list in the browser until you sign in to TillFlow."}
              </p>
              {deleteError ? (
                <p className="text-danger small mt-2 mb-0">{deleteError}</p>
              ) : null}
              <div className="modal-footer-btn mt-3 d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                  onClick={() => {
                    setDeleteTargetId(null);
                    setDeleteError("");
                  }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StockTransfer;
