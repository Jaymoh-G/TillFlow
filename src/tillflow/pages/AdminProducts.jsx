import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PrimeDataTable from "../../components/data-table";
import { TillFlowApiError } from "../api/errors";
import { deleteProductRequest, listProductsRequest, listTrashedProductsRequest, restoreProductRequest } from "../api/products";
import { useAuth } from "../auth/AuthContext";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { downloadItemsExcel, downloadItemsPdf } from "../utils/itemListExport";

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
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [viewTrash, setViewTrash] = useState(false);
  const [restoreSubmittingId, setRestoreSubmittingId] = useState(null);

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
  }, [viewTrash]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return products;
    }
    return products.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) || (p.sku && String(p.sku).toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows]);

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
    if (!filtered.length) {
      window.alert("No items to export.");
      return;
    }
    try {
      await downloadItemsExcel(filtered, viewTrash);
    } catch {
      window.alert("Could not export Excel. Try again or check download settings.");
    }
  }, [filtered, viewTrash]);

  const handleExportPdf = useCallback(async () => {
    if (!filtered.length) {
      window.alert("No items to export.");
      return;
    }
    try {
      await downloadItemsPdf(filtered, viewTrash);
    } catch {
      window.alert("Could not export PDF. Try again or check download settings.");
    }
  }, [filtered, viewTrash]);

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
            <div className="avatar avatar-md me-2">{initials(p.name)}</div>
            <span>{p.name}</span>
          </div>
        )
      },
      { header: "Category", field: "category.name", body: (p) => p.category?.name ?? "—" },
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
        header: viewTrash ? "Deleted" : "Created by",
        field: viewTrash ? "deleted_at" : "created_at",
        body: (p) => (
          <span className="userimgname text-muted small">
            {formatListDate(viewTrash ? p.deleted_at : p.created_at)}
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
        <ul className="table-top-head">
          <li>
            <button
              type="button"
              title="Export PDF"
              disabled={loading}
              onClick={() => void handleExportPdf()}>
              <i className="feather icon-file-text" />
            </button>
          </li>
          <li>
            <button
              type="button"
              title="Export Excel"
              disabled={loading}
              onClick={() => void handleExportExcel()}>
              <i className="feather icon-download" />
            </button>
          </li>
          <li>
            <button type="button" title="Refresh" onClick={() => void load()}>
              <i className="feather icon-refresh-cw" />
            </button>
          </li>
        </ul>
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
          <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
                aria-expanded="false">
                Item
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown">
                Created By
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown">
                Category
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
            </div>
            <div className="dropdown me-2">
              <button
                type="button"
                className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                data-bs-toggle="dropdown">
                Brand
              </button>
              <ul className="dropdown-menu dropdown-menu-end p-3">
                <li>
                  <span className="dropdown-item rounded-1 text-muted">Filter (placeholder)</span>
                </li>
              </ul>
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
