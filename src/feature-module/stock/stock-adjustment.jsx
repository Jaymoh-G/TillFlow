import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import TableTopHead from "../../components/table-top-head";
import CommonSelect from "../../components/select/common-select";
import CommonFooter from "../../components/footer/commonFooter";
import { stockData } from "../../core/json/stock-data";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createStockAdjustmentRequest,
  listStockAdjustmentsForProductRequest,
  listStockAdjustmentsRequest
} from "../../tillflow/api/stockAdjustments";
import { listProductsRequest } from "../../tillflow/api/products";
import { listStoresRequest } from "../../tillflow/api/stores";
import { TillFlowApiError } from "../../tillflow/api/errors";
import ImportRecordsModal from "../../tillflow/components/ImportRecordsModal";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { readTillflowStoredToken } from "../../tillflow/auth/tillflowToken";
import { downloadRowsExcel, downloadRowsPdf } from "../../tillflow/utils/listExport";
import {
  downloadStockAdjustmentImportTemplate,
  parseStockAdjustmentImportFile
} from "../../tillflow/utils/stockAdjustmentImport";

const STOCK_ADJUST_COLUMN_VISIBILITY_KEY = "tillflow.admin.stockAdjustment.columnVisibility";

function readStockAdjustColumnVisibility() {
  try {
    const raw = localStorage.getItem(STOCK_ADJUST_COLUMN_VISIBILITY_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function hideBsModal(id) {
  const el = document.getElementById(id);
  if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
    const inst =
      window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.hide();
  }
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatWhen(isoOrDemo) {
  if (isoOrDemo == null || isoOrDemo === "") {
    return "—";
  }
  const s = String(isoOrDemo);
  if (/^\d{1,2}\s+\w+\s+\d{4}/.test(s)) {
    return s;
  }
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function formatRecordedBy(createdBy) {
  if (!createdBy || typeof createdBy !== "object") {
    return "—";
  }
  const name = String(createdBy.name ?? "").trim();
  return name || "—";
}

function mapDemoRows() {
  return stockData.slice(0, 12).map((d, i) => {
    const isAdd = i % 2 === 0;
    const qty = (i % 5) + 1;
    const after =
      typeof d.qty === "number" ? d.qty : parseInt(String(d.qty), 10) || 0;
    const before = isAdd ? after - qty : after + qty;
    return {
      id: `demo-${d.id}`,
      product_id: null,
      type: isAdd ? "add" : "remove",
      quantity: qty,
      qty_before: before,
      qty_after: after,
      reference: `DEMO-${d.id}`,
      notes: isAdd ? "Demo stock received" : "Demo damage write-off",
      created_at: d.date,
      product: {
        name: d.product.name,
        sku: "—",
        displayImage: d.product.image
      },
      storeLabel: "—",
      recordedBy: d.person?.name ? String(d.person.name) : "—",
      isDemo: true
    };
  });
}

function mapApiRow(a) {
  const p = a.product ?? {};
  const logo = p.brand?.logo_url ?? null;
  const imageUrl = p.image_url ?? null;
  const createdBy = a.created_by ?? a.createdBy;
  return {
    id: a.id,
    product_id: a.product_id ?? a.product?.id ?? null,
    type: a.type,
    quantity: a.quantity,
    qty_before: a.qty_before,
    qty_after: a.qty_after,
    reference: a.reference ?? "—",
    notes: a.notes ?? "",
    created_at: a.created_at,
    product: {
      name: p.name ?? "—",
      sku: p.sku ?? "—",
      displayImage: imageUrl || logo
    },
    storeLabel: a.store?.store_name ?? "—",
    recordedBy: formatRecordedBy(createdBy),
    isDemo: false
  };
}

const StockAdjustment = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/admin");
  const auth = useOptionalAuth();
  const token = auth?.token ?? readTillflowStoredToken();
  const recordAsLabel = auth?.user?.name?.trim() || null;
  const liveMode = Boolean(token);

  const [adjustments, setAdjustments] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const demoRows = useMemo(() => mapDemoRows(), []);
  const [loading, setLoading] = useState(() => Boolean(readTillflowStoredToken()));
  const [listError, setListError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);

  const [addProductId, setAddProductId] = useState(null);
  const [addType, setAddType] = useState("add");
  const [addQty, setAddQty] = useState("1");
  const [addReference, setAddReference] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [stores, setStores] = useState([]);
  const [addStoreId, setAddStoreId] = useState(null);

  const [notesModalText, setNotesModalText] = useState("");
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [columnVisibility, setColumnVisibility] = useState(readStockAdjustColumnVisibility);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const loadList = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const data = await listStockAdjustmentsRequest(token);
      setAdjustments(data.adjustments ?? []);
    } catch (e) {
      setAdjustments([]);
      if (e instanceof TillFlowApiError) {
        setListError(
          e.status === 403 ? `${e.message} (needs stock adjustment permission)` : e.message
        );
      } else {
        setListError("Failed to load adjustments");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadProducts = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const data = await listProductsRequest(token);
      setCatalogProducts(data.products ?? []);
    } catch {
      setCatalogProducts([]);
    }
  }, [token]);

  const loadStores = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const data = await listStoresRequest(token);
      const rows = Array.isArray(data?.stores) ? data.stores : [];
      setStores(rows);
    } catch {
      setStores([]);
    }
  }, [token]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (token) {
      void loadProducts();
      void loadStores();
    }
  }, [token, loadProducts, loadStores]);

  const liveRows = useMemo(
    () => adjustments.map(mapApiRow),
    [adjustments]
  );

  const productSelectOptions = useMemo(
    () =>
      catalogProducts.map((p) => ({
        label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
        value: p.id
      })),
    [catalogProducts]
  );

  const storeSelectOptions = useMemo(
    () =>
      stores.map((s) => ({
        label: s.name || `Store ${s.id}`,
        value: s.id
      })),
    [stores]
  );

  const displayRows = useMemo(() => {
    const base = liveMode ? liveRows : demoRows;
    let out = base;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const name = r.product?.name ?? "";
        const sku = r.product?.sku ?? "";
        const ref = r.reference ?? "";
        const notes = r.notes ?? "";
        return (
          String(name).toLowerCase().includes(q) ||
          String(sku).toLowerCase().includes(q) ||
          String(ref).toLowerCase().includes(q) ||
          String(notes).toLowerCase().includes(q) ||
          String(r.storeLabel ?? "").toLowerCase().includes(q) ||
          String(r.recordedBy ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (typeFilter != null) {
      out = out.filter((r) => r.type === typeFilter);
    }
    return out;
  }, [liveMode, liveRows, demoRows, searchQuery, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, typeFilter, liveMode]);

  const totalRecords = displayRows.length;

  const handleExportExcel = useCallback(async () => {
    const records = displayRows.map((r) => ({
      Date: formatWhen(r.created_at),
      Product: String(r.product?.name ?? ""),
      SKU: String(r.product?.sku ?? ""),
      Store: String(r.storeLabel ?? ""),
      Type: r.type === "add" ? "Add" : "Remove",
      Qty: r.quantity,
      Before: r.qty_before,
      After: r.qty_after,
      Reference: String(r.reference ?? ""),
      "Recorded by": String(r.recordedBy ?? ""),
      Notes: String(r.notes ?? "")
    }));
    await downloadRowsExcel(records, "Stock adjustments", "stock-adjustments");
  }, [displayRows]);

  const handleExportPdf = useCallback(async () => {
    const body = displayRows.map((r) => [
      formatWhen(r.created_at),
      String(r.product?.name ?? ""),
      String(r.product?.sku ?? ""),
      String(r.storeLabel ?? ""),
      r.type === "add" ? "Add" : "Remove",
      String(r.quantity ?? ""),
      String(r.qty_before ?? ""),
      String(r.qty_after ?? ""),
      String(r.reference ?? ""),
      String(r.recordedBy ?? ""),
      String(r.notes ?? "")
    ]);
    await downloadRowsPdf(
      "Stock adjustments",
      [
        "Date",
        "Product",
        "SKU",
        "Store",
        "Type",
        "Qty",
        "Before",
        "After",
        "Reference",
        "Recorded by",
        "Notes"
      ],
      body,
      "stock-adjustments"
    );
  }, [displayRows]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!token || !liveMode) {
      return;
    }
    if (!addProductId) {
      setListError("Select a product");
      return;
    }
    if (!addStoreId) {
      setListError("Select a store");
      return;
    }
    const qty = parseInt(addQty, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setListError("Enter a quantity of at least 1");
      return;
    }
    setAddSubmitting(true);
    setListError("");
    try {
      await createStockAdjustmentRequest(token, {
        product_id: addProductId,
        store_id: addStoreId,
        type: addType,
        quantity: qty,
        reference: addReference.trim() || null,
        notes: addNotes.trim() || null
      });
      hideBsModal("add-stock-adjustment");
      setAddProductId(null);
      setAddType("add");
      setAddQty("1");
      setAddReference("");
      setAddNotes("");
      await loadList();
      await loadProducts();
      await loadStores();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError("Could not record adjustment");
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const openProductHistory = useCallback(
    async (r) => {
      const title = r.product?.name ?? "Product";
      setHistoryTitle(title);
      setHistoryRows([]);
      setHistoryError("");
      setHistoryLoading(true);

      const modalEl = document.getElementById("view-product-adjustment-history");
      if (modalEl && typeof window !== "undefined" && window.bootstrap?.Modal) {
        const inst =
          window.bootstrap.Modal.getInstance(modalEl) ??
          new window.bootstrap.Modal(modalEl);
        inst.show();
      }

      try {
        if (liveMode && token) {
          if (r.product_id == null) {
            setHistoryError("Missing product reference for this row.");
            return;
          }
          const data = await listStockAdjustmentsForProductRequest(token, r.product_id);
          setHistoryRows((data.adjustments ?? []).map(mapApiRow));
        } else {
          const name = r.product?.name ?? "";
          const matches = demoRows
            .filter((x) => (x.product?.name ?? "") === name)
            .slice(0, 30);
          setHistoryRows(matches);
        }
      } catch (e) {
        setHistoryRows([]);
        if (e instanceof TillFlowApiError) {
          setHistoryError(e.message);
        } else {
          setHistoryError("Could not load history");
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [liveMode, token, demoRows]
  );

  const columns = useMemo(
    () => [
      {
        columnId: "date",
        label: "Date",
        hideable: true,
        header: "Date",
        field: "created_at",
        key: "created_at",
        body: (r) => formatWhen(r.created_at)
      },
      {
        columnId: "product",
        label: "Product",
        hideable: true,
        header: "Product",
        field: "product",
        key: "product",
        body: (r) => (
          <div className="d-flex align-items-center">
            <span className="avatar avatar-md me-2 bg-light text-dark d-inline-flex align-items-center justify-content-center overflow-hidden">
              {r.product?.displayImage ? (
                <img src={r.product.displayImage} alt="" />
              ) : (
                <span className="small fw-semibold px-1">{initials(r.product?.name)}</span>
              )}
            </span>
            <span className="text-body">{r.product?.name ?? "—"}</span>
          </div>
        )
      },
      {
        columnId: "sku",
        label: "SKU",
        hideable: true,
        header: "SKU",
        field: "sku",
        key: "sku",
        body: (r) => r.product?.sku ?? "—"
      },
      {
        columnId: "store",
        label: "Store",
        hideable: true,
        header: "Store",
        field: "storeLabel",
        key: "storeLabel",
        body: (r) => r.storeLabel ?? "—"
      },
      {
        columnId: "type",
        label: "Type",
        hideable: true,
        header: "Type",
        field: "type",
        key: "type",
        body: (r) => (
          <span className={`badge ${r.type === "add" ? "bg-success" : "bg-warning text-dark"}`}>
            {r.type === "add" ? "Add" : "Remove"}
          </span>
        )
      },
      {
        columnId: "qty",
        label: "Qty",
        hideable: true,
        header: "Qty",
        field: "quantity",
        key: "quantity",
        body: (r) => (
          <span className={r.type === "add" ? "text-success fw-semibold" : "text-warning fw-semibold"}>
            {r.type === "add" ? "+" : "−"}
            {r.quantity}
          </span>
        )
      },
      {
        columnId: "before",
        label: "Before",
        hideable: true,
        header: "Before",
        field: "qty_before",
        key: "qty_before"
      },
      {
        columnId: "after",
        label: "After",
        hideable: true,
        header: "After",
        field: "qty_after",
        key: "qty_after"
      },
      {
        columnId: "reference",
        label: "Reference",
        hideable: true,
        header: "Reference",
        field: "reference",
        key: "reference",
        body: (r) => r.reference || "—"
      },
      {
        columnId: "recorded_by",
        label: "Recorded by",
        hideable: true,
        header: "Recorded by",
        field: "recordedBy",
        key: "recordedBy",
        body: (r) => <span className="text-body text-break">{r.recordedBy ?? "—"}</span>
      },
      {
        columnId: "actions",
        label: "Actions",
        hideable: false,
        header: "",
        field: "actions",
        key: "actions",
        sortable: false,
        body: (r) => (
          <div className="d-flex align-items-center gap-1 flex-nowrap">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary border rounded d-flex align-items-center px-2 py-1"
              onClick={() => void openProductHistory(r)}
              title="View up to 30 latest adjustments for this item">
              <i className="feather icon-clock" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary border rounded d-flex align-items-center px-2 py-1"
              data-bs-toggle="modal"
              data-bs-target="#view-adjustment-notes"
              onClick={() => setNotesModalText(r.notes || "—")}
              title="Notes">
              <i className="feather icon-file-text" />
            </button>
          </div>
        )
      }
    ],
    [openProductHistory]
  );

  const visibleColumns = useMemo(
    () =>
      columns.filter((c) => {
        if (c.hideable === false) {
          return true;
        }
        return columnVisibility[c.columnId] !== false;
      }),
    [columns, columnVisibility]
  );

  const toggleColumnVisibility = useCallback((columnId) => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      if (next[columnId] === false) {
        delete next[columnId];
      } else {
        next[columnId] = false;
      }
      try {
        localStorage.setItem(STOCK_ADJUST_COLUMN_VISIBILITY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const resetColumnVisibility = useCallback(() => {
    setColumnVisibility({});
    try {
      localStorage.removeItem(STOCK_ADJUST_COLUMN_VISIBILITY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const runImportAdjustments = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createStockAdjustmentRequest(token, row);
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(
          `Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : "Could not create adjustment."}`
        );
      }
    }
    await loadList();
    await loadProducts();
    await loadStores();
    setImportSummary({ created, skipped: 0, failed, details });
    setImporting(false);
  }, [token, importRows, loadList, loadProducts, loadStores]);

  return (
    <>
      <div
        className={`page-wrapper stock-adjustment-page${inTillflowShell ? " stock-adjustment-page--tillflow" : ""}`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Adjust Stock</h4>
                <h6>
                  {liveMode
                    ? inTillflowShell
                      ? "Record additions and removals with a full audit trail"
                      : "Live adjustments — use TillFlow admin for the same session token"
                    : "Sample rows — sign in to TillFlow to post real adjustments"}
                </h6>
              </div>
            </div>
            <TableTopHead
              onRefresh={liveMode ? () => void loadList() : undefined}
              onExportPdf={
                loading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportPdf()
              }
              onExportExcel={
                loading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportExcel()
              }
              onImport={liveMode ? () => setShowImport(true) : undefined}
            />
            <div className="page-btn d-flex gap-2 flex-wrap">
              {liveMode && (
                <Link to="/admin/items" className="btn btn-outline-secondary">
                  <i className="feather icon-package me-1" />
                  Item list
                </Link>
              )}
              <button
                type="button"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-stock-adjustment"
                onClick={() => {
                  if (liveMode && catalogProducts.length) {
                    setAddProductId((prev) => prev ?? catalogProducts[0].id);
                  }
                  if (liveMode && stores.length && addStoreId == null) {
                    setAddStoreId(stores[0].id);
                  }
                }}>
                <i className="ti ti-circle-plus me-1" />
                Add Adjustment
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={(v) => setSearchQuery(v ?? "")}
                rows={rows}
                setRows={setRows}
              />
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                <div style={{ minWidth: "11rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={[
                      { label: "All types", value: null },
                      { label: "Addition", value: "add" },
                      { label: "Removal", value: "remove" }
                    ]}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.value ?? null)}
                    placeholder="Type"
                    filter={false}
                  />
                </div>
                <div className="dropdown">
                  <button
                    type="button"
                    className="btn btn-white btn-md rounded d-inline-flex align-items-center justify-content-center p-0 border"
                    style={{ width: 38, height: 38 }}
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                    aria-expanded="false"
                    aria-haspopup="true"
                    title="Show, hide, or reset table columns">
                    <span className="visually-hidden">Show or hide columns</span>
                    <i className="feather icon-grid" style={{ fontSize: "1.15rem" }} aria-hidden="true" />
                  </button>
                  <ul
                    className="dropdown-menu dropdown-menu-end p-2 shadow-sm"
                    style={{ minWidth: 240 }}
                    onClick={(e) => e.stopPropagation()}>
                    <li className="dropdown-header px-2 py-1 small" style={{ color: "#000" }}>
                      Visible columns
                    </li>
                    {columns
                      .filter((c) => c.hideable !== false)
                      .map((c) => (
                        <li key={c.columnId} className="px-1 py-1">
                          <label className="d-flex align-items-center gap-2 mb-0 small w-100 cursor-pointer user-select-none">
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              checked={columnVisibility[c.columnId] !== false}
                              onChange={() => toggleColumnVisibility(c.columnId)}
                            />
                            <span>{c.label}</span>
                          </label>
                        </li>
                      ))}
                    <li>
                      <hr className="dropdown-divider my-2" />
                    </li>
                    <li className="px-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100"
                        onClick={resetColumnVisibility}>
                        Show all columns
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            {listError ? (
              <div className="px-3 pt-3">
                <div className="alert alert-warning mb-0 py-2">{listError}</div>
              </div>
            ) : null}
            <div className="card-body p-0">
              <div className="table-responsive">
                <PrimeDataTable
                  column={visibleColumns}
                  data={displayRows}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  loading={loading}
                  selectionMode="checkbox"
                  selection={selectedRows}
                  onSelectionChange={(e) => setSelectedRows(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-stock-adjustment">
        <div className="modal-dialog modal-dialog-centered stock-adjust-modal">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add adjustment</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {liveMode ? (
                  <>
                    {recordAsLabel ? (
                      <p className="text-muted small mb-3">
                        Logged in as <strong>{recordAsLabel}</strong> — this adjustment will be
                        attributed to that account.
                      </p>
                    ) : null}
                    <div className="mb-3">
                      <label className="form-label">
                        Product <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={productSelectOptions}
                        value={addProductId}
                        onChange={(e) => setAddProductId(e.value)}
                        placeholder="Select product"
                        filter
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Store <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={storeSelectOptions}
                        value={addStoreId}
                        onChange={(e) => setAddStoreId(e.value)}
                        placeholder="Select store"
                        filter={false}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Type <span className="text-danger ms-1">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={[
                          { label: "Addition", value: "add" },
                          { label: "Removal", value: "remove" }
                        ]}
                        value={addType}
                        onChange={(e) => setAddType(e.value)}
                        placeholder="Type"
                        filter={false}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Quantity <span className="text-danger ms-1">*</span>
                      </label>
                    <input
                        type="number"
                        min={1}
                      className="form-control"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Reference (optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        maxLength={120}
                        value={addReference}
                        onChange={(e) => setAddReference(e.target.value)}
                        placeholder="PO #, ticket #, etc."
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Notes (optional)</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                        placeholder="Reason for adjustment"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-muted mb-0">
                    Sign in through{" "}
                    <Link to="/tillflow" className="fw-semibold">
                      TillFlow
                    </Link>{" "}
                    to post adjustments against your catalog.
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    !liveMode ||
                    addSubmitting ||
                    catalogProducts.length === 0 ||
                    stores.length === 0
                  }>
                  {addSubmitting ? "Saving…" : "Record adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="view-adjustment-notes">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Notes</h5>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                {notesModalText}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ImportRecordsModal
        show={showImport}
        title="Import stock adjustments"
        helpText='Required columns: product_id, store_id, type ("add"/"remove"), quantity.'
        previewColumns={[
          { key: "sheetRow", label: "Row", render: (r) => r.sheetRow },
          { key: "product_id", label: "Product ID", render: (r) => r.product_id },
          { key: "store_id", label: "Store ID", render: (r) => r.store_id },
          { key: "type", label: "Type", render: (r) => r.type },
          { key: "quantity", label: "Qty", render: (r) => r.quantity }
        ]}
        previewRows={importRows}
        parseErrors={importErrors}
        summary={importSummary}
        importing={importing}
        onClose={() => {
          if (!importing) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        onDownloadTemplate={() => void downloadStockAdjustmentImportTemplate()}
        onChooseFile={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = "";
          if (!file) return;
          const parsed = await parseStockAdjustmentImportFile(file);
          setImportRows(parsed.rows);
          setImportErrors(parsed.errors);
          setImportSummary(null);
        }}
        onImport={() => void runImportAdjustments()}
      />

      <div className="modal fade" id="view-product-adjustment-history" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Recent adjustments — {historyTitle}</h5>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {historyLoading ? (
                <p className="text-muted mb-0">Loading…</p>
              ) : historyError ? (
                <div className="alert alert-warning mb-0 py-2">{historyError}</div>
              ) : historyRows.length === 0 ? (
                <p className="text-muted mb-0">No adjustment history found for this item.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Store</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Before</th>
                        <th>After</th>
                        <th>Reference</th>
                        <th>Recorded by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((h) => (
                        <tr key={h.id}>
                          <td>{formatWhen(h.created_at)}</td>
                          <td>{h.storeLabel ?? "—"}</td>
                          <td>
                            <span
                              className={`badge ${
                                h.type === "add" ? "bg-success" : "bg-warning text-dark"
                              }`}>
                              {h.type === "add" ? "Add" : "Remove"}
                            </span>
                          </td>
                          <td>
                            {h.type === "add" ? "+" : "−"}
                            {h.quantity}
                          </td>
                          <td>{h.qty_before}</td>
                          <td>{h.qty_after}</td>
                          <td className="text-break">{h.reference || "—"}</td>
                          <td className="text-break">{h.recordedBy ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StockAdjustment;
