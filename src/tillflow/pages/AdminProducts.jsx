import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PrimeDataTable from "../../components/data-table";
import { TillFlowApiError } from "../api/errors";
import {
  deleteProductRequest,
  listProductsRequest,
  listTrashedProductsRequest,
  restoreProductRequest,
  updateProductRequest
} from "../api/products";
import { listStoresRequest } from "../api/stores";
import { listCategoriesRequest } from "../api/categories";
import { listBrandsRequest } from "../api/brands";
import { listUnitsRequest } from "../api/units";
import { useAuth } from "../auth/AuthContext";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { downloadItemsExcel, downloadItemsPdf } from "../utils/itemListExport";
import TableTopHead from "../../components/table-top-head";

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

function formatListDate(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function formatPrice(val) {
  if (val == null || val === "") {
    return "—";
  }
  const n = Number(val);
  if (Number.isNaN(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSummary, setBulkSummary] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkStoreId, setBulkStoreId] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkBrandId, setBulkBrandId] = useState("");
  const [bulkUnitId, setBulkUnitId] = useState("");
  const [bulkQty, setBulkQty] = useState("");
  const [bulkBuyingPrice, setBulkBuyingPrice] = useState("");
  const [bulkSellingPrice, setBulkSellingPrice] = useState("");
  const [bulkPriceAdjustMode, setBulkPriceAdjustMode] = useState("none");
  const [bulkPriceAdjustOp, setBulkPriceAdjustOp] = useState("increase");
  const [bulkPriceAdjustValue, setBulkPriceAdjustValue] = useState("");
  const [bulkStores, setBulkStores] = useState([]);
  const [bulkCategories, setBulkCategories] = useState([]);
  const [bulkBrands, setBulkBrands] = useState([]);
  const [bulkUnits, setBulkUnits] = useState([]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const data = viewTrash ? await listTrashedProductsRequest(token) : await listProductsRequest(token);
      setProducts(data.products ?? []);
    } catch (e) {
      setProducts([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message);
      } else {
        setListError("Failed to load items");
      }
    } finally {
      setLoading(false);
    }
  }, [token, viewTrash]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProducts([]);
    setBulkSummary(null);
    setBulkError("");
  }, [viewTrash]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [storesData, categoriesData, brandsData, unitsData] = await Promise.all([
          listStoresRequest(token),
          listCategoriesRequest(token),
          listBrandsRequest(token),
          listUnitsRequest(token)
        ]);
        if (cancelled) {
          return;
        }
        setBulkStores(Array.isArray(storesData?.stores) ? storesData.stores : []);
        setBulkCategories(Array.isArray(categoriesData?.categories) ? categoriesData.categories : []);
        setBulkBrands(Array.isArray(brandsData?.brands) ? brandsData.brands : []);
        setBulkUnits(Array.isArray(unitsData?.units) ? unitsData.units : []);
      } catch {
        if (!cancelled) {
          setBulkStores([]);
          setBulkCategories([]);
          setBulkBrands([]);
          setBulkUnits([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const storeNameById = useMemo(() => {
    const map = new Map();
    bulkStores.forEach((s) => {
      const id = String(s?.id ?? "").trim();
      const name = String(s?.name ?? "").trim();
      if (id && name) {
        map.set(id, name);
      }
    });
    return map;
  }, [bulkStores]);

  const normalizedProducts = useMemo(
    () =>
      products.map((p) => {
        const fallbackStoreId = p?.store_id ?? p?.store?.id ?? null;
        const explicitStoreName =
          String(p?.store?.name ?? "").trim() ||
          String(p?.store?.store_name ?? "").trim() ||
          String(p?.store_name ?? "").trim();
        const mappedStoreName = storeNameById.get(String(fallbackStoreId ?? "")) ?? "";
        const resolvedStoreName = explicitStoreName || mappedStoreName;
        if (!resolvedStoreName && !fallbackStoreId) {
          return p;
        }
        return {
          ...p,
          store: {
            ...(p?.store ?? {}),
            id: p?.store?.id ?? fallbackStoreId,
            name: resolvedStoreName || p?.store?.name || ""
          }
        };
      }),
    [products, storeNameById]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let next = normalizedProducts;
    if (q) {
      next = next.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && String(p.sku).toLowerCase().includes(q))
      );
    }
    if (storeFilter) {
      next = next.filter((p) => String(p.store?.id ?? "") === storeFilter);
    }
    if (categoryFilter) {
      next = next.filter((p) => String(p.category?.id ?? "") === categoryFilter);
    }
    if (brandFilter) {
      next = next.filter((p) => String(p.brand?.id ?? "") === brandFilter);
    }
    return next;
  }, [normalizedProducts, searchQuery, storeFilter, categoryFilter, brandFilter]);

  const storeFilterOptions = useMemo(() => {
    const seen = new Map();
    normalizedProducts.forEach((p) => {
      const id = String(p.store?.id ?? "").trim();
      const name = String(p.store?.name ?? "").trim();
      if (!id || !name || seen.has(id)) {
        return;
      }
      seen.set(id, name);
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedProducts]);

  const categoryFilterOptions = useMemo(() => {
    const seen = new Map();
    normalizedProducts.forEach((p) => {
      const id = String(p.category?.id ?? "").trim();
      const name = String(p.category?.name ?? "").trim();
      if (!id || !name || seen.has(id)) {
        return;
      }
      seen.set(id, name);
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedProducts]);

  const brandFilterOptions = useMemo(() => {
    const seen = new Map();
    normalizedProducts.forEach((p) => {
      const id = String(p.brand?.id ?? "").trim();
      const name = String(p.brand?.name ?? "").trim();
      if (!id || !name || seen.has(id)) {
        return;
      }
      seen.set(id, name);
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedProducts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, storeFilter, categoryFilter, brandFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rows) || 1);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const openDeleteModal = useCallback((productId, label) => {
    setDeleteTarget({ id: productId, label });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !token) {
      return;
    }
    const { id: productId } = deleteTarget;
    setDeleteSubmitting(true);
    setListError("");
    try {
      await deleteProductRequest(token, productId);
      setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError("Delete failed");
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, token, load]);

  const handleRestore = useCallback(
    async (productId) => {
      if (!token) {
        return;
      }
      setListError("");
      setRestoreSubmittingId(productId);
      try {
        await restoreProductRequest(token, productId);
        setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
        await load();
      } catch (err) {
        if (err instanceof TillFlowApiError) {
          setListError(err.message);
        } else {
          setListError("Restore failed");
        }
      } finally {
        setRestoreSubmittingId(null);
      }
    },
    [token, load]
  );

  const handleExportExcel = useCallback(async () => {
    const rowsToExport = selectedProducts.length ? selectedProducts : filtered;
    if (!rowsToExport.length) {
      window.alert("No items to export.");
      return;
    }
    try {
      await downloadItemsExcel(rowsToExport, viewTrash);
    } catch {
      window.alert("Could not export Excel. Try again or check download settings.");
    }
  }, [filtered, selectedProducts, viewTrash]);

  const handleExportPdf = useCallback(async () => {
    const rowsToExport = selectedProducts.length ? selectedProducts : filtered;
    if (!rowsToExport.length) {
      window.alert("No items to export.");
      return;
    }
    try {
      await downloadItemsPdf(rowsToExport, viewTrash);
    } catch {
      window.alert("Could not export PDF. Try again or check download settings.");
    }
  }, [filtered, selectedProducts, viewTrash]);

  const selectedIds = useMemo(
    () => selectedProducts.map((p) => Number(p.id)).filter((id) => Number.isFinite(id)),
    [selectedProducts]
  );

  const runBulkOperation = useCallback(
    async (ids, worker, actionLabel) => {
      if (!ids.length || !token) {
        return;
      }
      setBulkSubmitting(true);
      setBulkError("");
      setBulkSummary(null);
      let successCount = 0;
      let failedCount = 0;
      for (const id of ids) {
        try {
          await worker(id);
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      setBulkSummary({ actionLabel, successCount, failedCount });
      setBulkSubmitting(false);
      await load();
      setSelectedProducts([]);
    },
    [token, load]
  );

  const bulkMoveToTrash = useCallback(async () => {
    if (!selectedIds.length) {
      return;
    }
    await runBulkOperation(selectedIds, (id) => deleteProductRequest(token, id), "Move to trash");
  }, [selectedIds, runBulkOperation, token]);

  const bulkRestore = useCallback(async () => {
    if (!selectedIds.length) {
      return;
    }
    await runBulkOperation(selectedIds, (id) => restoreProductRequest(token, id), "Restore");
  }, [selectedIds, runBulkOperation, token]);

  const bulkApplyUpdates = useCallback(async () => {
    if (!selectedProducts.length || !token) {
      return;
    }
    const hasDirectUpdate =
      bulkStoreId ||
      bulkCategoryId ||
      bulkBrandId ||
      bulkUnitId ||
      bulkQty !== "" ||
      bulkBuyingPrice !== "" ||
      bulkSellingPrice !== "";
    const hasPriceAdjust =
      bulkPriceAdjustMode !== "none" && String(bulkPriceAdjustValue).trim() !== "";
    if (!hasDirectUpdate && !hasPriceAdjust) {
      setBulkError("Choose at least one field to update.");
      return;
    }
    const parsedAdjust = Number(bulkPriceAdjustValue);
    if (hasPriceAdjust && (!Number.isFinite(parsedAdjust) || parsedAdjust < 0)) {
      setBulkError("Price adjustment value must be a valid positive number.");
      return;
    }
    setBulkSubmitting(true);
    setBulkError("");
    setBulkSummary(null);
    let successCount = 0;
    let failedCount = 0;
    for (const row of selectedProducts) {
      const payload = {};
      if (bulkStoreId) payload.store_id = Number(bulkStoreId);
      if (bulkCategoryId) payload.category_id = Number(bulkCategoryId);
      if (bulkBrandId) payload.brand_id = Number(bulkBrandId);
      if (bulkUnitId) payload.unit_id = Number(bulkUnitId);
      if (bulkQty !== "") payload.qty = Number(bulkQty);
      if (bulkBuyingPrice !== "") payload.buying_price = Number(bulkBuyingPrice);
      if (bulkSellingPrice !== "") payload.selling_price = Number(bulkSellingPrice);
      if (hasPriceAdjust) {
        const currentSelling = Number(row.selling_price ?? 0);
        const delta =
          bulkPriceAdjustMode === "percent" ? (currentSelling * parsedAdjust) / 100 : parsedAdjust;
        const nextSelling = bulkPriceAdjustOp === "decrease" ? currentSelling - delta : currentSelling + delta;
        payload.selling_price = Number(nextSelling.toFixed(2));
      }
      const sell = Number(payload.selling_price ?? row.selling_price ?? NaN);
      const buy = Number(payload.buying_price ?? row.buying_price ?? NaN);
      if (Number.isFinite(sell) && Number.isFinite(buy) && sell <= buy) {
        failedCount += 1;
        continue;
      }
      try {
        await updateProductRequest(token, row.id, payload);
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
    setBulkSummary({ actionLabel: "Bulk update", successCount, failedCount });
    setBulkSubmitting(false);
    setShowBulkUpdate(false);
    await load();
    setSelectedProducts([]);
  }, [
    selectedProducts,
    token,
    bulkStoreId,
    bulkCategoryId,
    bulkBrandId,
    bulkUnitId,
    bulkQty,
    bulkBuyingPrice,
    bulkSellingPrice,
    bulkPriceAdjustMode,
    bulkPriceAdjustOp,
    bulkPriceAdjustValue,
    load
  ]);

  const columns = useMemo(
    () => [
      {
        header: "SKU",
        field: "sku",
        body: (p) => <span className="tf-mono">{p.sku ?? "—"}</span>
      },
      {
        header: "Item",
        field: "name",
        body: (p) => (
          <div className="d-flex align-items-center">
            <div
              className="me-2 d-inline-flex align-items-center justify-content-center border bg-light overflow-hidden"
              style={{ width: 32, height: 32, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
              {p.image_url || p.image || p.main_image_url ? (
                <img
                  src={p.image_url || p.image || p.main_image_url}
                  alt={p.name || "Item image"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials(p.name)
              )}
            </div>
            <span>{p.name}</span>
          </div>
        )
      },
      { header: "Category", field: "category.name", body: (p) => p.category?.name ?? "—" },
      { header: "Store", field: "store.name", body: (p) => p.store?.name ?? "—" },
      { header: "Brand", field: "brand.name", body: (p) => p.brand?.name ?? "—" },
      {
        header: "Selling",
        field: "selling_price",
        className: "text-end",
        headerClassName: "text-end",
        sortField: "selling_price",
        body: (p) => <span className="text-end d-block">{formatPrice(p.selling_price)}</span>
      },
      {
        header: "Unit",
        field: "unit",
        sortable: false,
        body: (p) => p.unit?.short_name ?? p.unit?.name ?? "—"
      },
      {
        header: "Qty",
        field: "qty",
        className: "text-end",
        headerClassName: "text-end",
        sortField: "qty",
        body: (p) => <span className="text-end d-block">{p.qty != null ? p.qty : "—"}</span>
      },
      {
        header: "Qty Alert",
        field: "qty_alert",
        className: "text-end",
        headerClassName: "text-end",
        sortField: "qty_alert",
        body: (p) => <span className="text-end d-block">{p.qty_alert != null ? p.qty_alert : "—"}</span>
      },
      {
        header: viewTrash ? "Deleted At" : "Updated At",
        field: viewTrash ? "deleted_at" : "updated_at",
        body: (p) => (
          <span className="userimgname text-muted small">
            {formatListDate(viewTrash ? p.deleted_at : p.updated_at)}
          </span>
        )
      },
      {
        header: "Actions",
        field: "actions",
        sortable: false,
        className: "text-end text-nowrap",
        headerClassName: "text-end",
        body: (p) => (
          <div className="edit-delete-action d-flex align-items-center justify-content-end">
            {viewTrash ? (
              <button
                type="button"
                className="p-2 d-flex align-items-center border rounded bg-transparent"
                disabled={restoreSubmittingId === p.id}
                onClick={() => void handleRestore(p.id)}
                title="Restore">
                <i className="feather icon-rotate-ccw" />
              </button>
            ) : (
              <>
                <Link
                  to={`/tillflow/admin/items/${p.id}/edit`}
                  className="me-2 p-2 d-flex align-items-center border rounded bg-transparent text-reset"
                  title="Edit">
                  <i className="feather icon-edit" />
                </Link>
                <button
                  type="button"
                  className="p-2 d-flex align-items-center border rounded bg-transparent"
                  onClick={() => openDeleteModal(p.id, p.name)}
                  title="Move to trash">
                  <i className="feather icon-trash-2" />
                </button>
              </>
            )}
          </div>
        )
      }
    ],
    [viewTrash, restoreSubmittingId, handleRestore, openDeleteModal]
  );

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>{viewTrash ? "Trash" : "Item List"}</h4>
            <h6>{viewTrash ? "Restore deleted items when needed" : "Manage your items"}</h6>
          </div>
        </div>
        <TableTopHead
          onRefresh={() => void load()}
          onExportPdf={loading ? undefined : () => void handleExportPdf()}
          onExportExcel={loading ? undefined : () => void handleExportExcel()}
        />
        <div className="page-header-actions">
          <div className="page-btn">
            {viewTrash ? (
              <span className="btn btn-primary disabled" title="Switch to Active to add items">
                <i className="feather icon-plus-circle me-1" />
                Add New Item
              </span>
            ) : (
              <Link to="/tillflow/admin/add-product" className="btn btn-primary">
                <i className="feather icon-plus-circle me-1" />
                Add New Item
              </Link>
            )}
          </div>
          <div className="page-btn import">
            <button type="button" className="btn btn-secondary color" disabled title="Coming soon">
              <i className="feather icon-download me-2" />
              Import Item
            </button>
          </div>
        </div>
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}
      {bulkSummary ? (
        <div className="alert alert-info py-2">
          {bulkSummary.actionLabel}: {bulkSummary.successCount} succeeded, {bulkSummary.failedCount} failed.
        </div>
      ) : null}
      {bulkError ? <div className="alert alert-warning py-2">{bulkError}</div> : null}

      {selectedIds.length > 0 ? (
        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap align-items-center gap-2">
            <span className="fw-medium me-2">{selectedIds.length} selected</span>
            {viewTrash ? (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={bulkSubmitting}
                onClick={() => void bulkRestore()}>
                Restore selected
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  disabled={bulkSubmitting}
                  onClick={() => void bulkMoveToTrash()}>
                  Move selected to trash
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={bulkSubmitting}
                  onClick={() => setShowBulkUpdate((v) => !v)}>
                  {showBulkUpdate ? "Hide bulk update" : "Bulk update fields"}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={bulkSubmitting}
              onClick={() => void handleExportExcel()}>
              Export selected Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={bulkSubmitting}
              onClick={() => void handleExportPdf()}>
              Export selected PDF
            </button>
          </div>
          {!viewTrash && showBulkUpdate ? (
            <div className="card-body border-top">
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label small mb-1">Store</label>
                  <select className="form-select form-select-sm" value={bulkStoreId} onChange={(e) => setBulkStoreId(e.target.value)}>
                    <option value="">No change</option>
                    {bulkStores.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>
                        {String(s.name ?? "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-1">Category</label>
                  <select className="form-select form-select-sm" value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
                    <option value="">No change</option>
                    {bulkCategories.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {String(c.name ?? "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-1">Brand</label>
                  <select className="form-select form-select-sm" value={bulkBrandId} onChange={(e) => setBulkBrandId(e.target.value)}>
                    <option value="">No change</option>
                    {bulkBrands.map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>
                        {String(b.name ?? "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-1">Unit</label>
                  <select className="form-select form-select-sm" value={bulkUnitId} onChange={(e) => setBulkUnitId(e.target.value)}>
                    <option value="">No change</option>
                    {bulkUnits.map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>
                        {String(u.name ?? u.short_name ?? "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Qty</label>
                  <input className="form-control form-control-sm" type="number" value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} placeholder="No change" />
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Buying</label>
                  <input className="form-control form-control-sm" type="number" value={bulkBuyingPrice} onChange={(e) => setBulkBuyingPrice(e.target.value)} placeholder="No change" />
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Selling</label>
                  <input className="form-control form-control-sm" type="number" value={bulkSellingPrice} onChange={(e) => setBulkSellingPrice(e.target.value)} placeholder="No change" />
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Price adjust</label>
                  <select className="form-select form-select-sm" value={bulkPriceAdjustMode} onChange={(e) => setBulkPriceAdjustMode(e.target.value)}>
                    <option value="none">None</option>
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Direction</label>
                  <select className="form-select form-select-sm" value={bulkPriceAdjustOp} onChange={(e) => setBulkPriceAdjustOp(e.target.value)}>
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">Adjust value</label>
                  <input className="form-control form-control-sm" type="number" value={bulkPriceAdjustValue} onChange={(e) => setBulkPriceAdjustValue(e.target.value)} placeholder="0" />
                </div>
                <div className="col-12">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={bulkSubmitting}
                    onClick={() => void bulkApplyUpdates()}>
                    {bulkSubmitting ? "Applying..." : "Apply bulk update"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card table-list-card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
          <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1">
            <div className="search-set">
              <div className="search-input">
                <span className="btn-searchset">
                  <i className="feather icon-search" />
                </span>
                <div className="dataTables_filter">
                  <label className="mb-0">
                    <input
                      type="search"
                      className="form-control form-control-sm"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search items"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Active or trash">
              <button
                type="button"
                className={`btn ${!viewTrash ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setViewTrash(false)}>
                Active
              </button>
              <button
                type="button"
                className={`btn ${viewTrash ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setViewTrash(true)}>
                Trash
              </button>
            </div>
          </div>
          <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap gap-1 row-gap-1">
            <div style={{ minWidth: 220 }}>
              <select
                className="form-select form-select-sm"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                aria-label="Filter items by store">
                <option value="">All stores</option>
                {storeFilterOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <select
                className="form-select form-select-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter items by category">
                <option value="">All categories</option>
                {categoryFilterOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <select
                className="form-select form-select-sm"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                aria-label="Filter items by brand">
                <option value="">All brands</option>
                {brandFilterOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="dropdown">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown">
                Sort By : Last 7 Days
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Recently Added</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Ascending</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Descending</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Last Month</span>
                </li>
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Last 7 Days</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="custom-datatable-filter table-responsive">
            <PrimeDataTable
              column={columns}
              data={filtered}
              rows={rows}
              setRows={setRows}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={filtered.length}
              loading={loading}
              isPaginationEnabled
              selectionMode="checkbox"
              selection={selectedProducts}
              onSelectionChange={(e) => setSelectedProducts(Array.isArray(e.value) ? e.value : [])}
              dataKey="id"
            />
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        show={deleteTarget != null}
        onHide={() => {
          if (!deleteSubmitting) {
            setDeleteTarget(null);
          }
        }}
        title="Move to trash"
        message={
          deleteTarget
            ? `Move "${deleteTarget.label}" to trash? You can restore it later from the Trash tab.`
            : ""
        }
        confirmLabel="Move to trash"
        submittingLabel="Moving…"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />
    </div>
  );
}
