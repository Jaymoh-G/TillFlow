import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import DeleteModal from "../../components/delete-modal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { stockData } from "../../core/json/stock-data";
import TableTopHead from "../../components/table-top-head";
import { stockImg02 } from "../../utils/imagepath";
import CommonSelect from "../../components/select/common-select";
import CommonFooter from "../../components/footer/commonFooter";
import { listProductsRequest, updateProductRequest } from "../../tillflow/api/products";
import { TillFlowApiError } from "../../tillflow/api/errors";

const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";

function readTillflowToken() {
  try {
    return sessionStorage.getItem(TILLFLOW_TOKEN_KEY);
  } catch {
    return null;
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

function formatUpdatedLabel(value) {
  if (value == null || value === "") {
    return "—";
  }
  const s = String(value);
  if (/^\d{1,2}\s+\w+\s+\d{4}/.test(s)) {
    return s;
  }
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
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

function mapDemoStockRows() {
  return stockData.map((d) => ({
    id: d.id,
    name: d.product.name,
    displayImage: d.product.image,
    sku: "—",
    categoryName: "—",
    unitLabel: "—",
    qty: typeof d.qty === "number" ? d.qty : parseInt(String(d.qty), 10) || 0,
    qty_alert: null,
    updatedLabel: d.date,
    catalogProduct: null
  }));
}

function mapCatalogProduct(p) {
  const logo = p.brand?.logo_url ?? null;
  return {
    id: p.id,
    name: p.name ?? "—",
    displayImage: logo,
    sku: p.sku ?? "—",
    categoryName: p.category?.name ?? "—",
    unitLabel: p.unit?.short_name ?? p.unit?.name ?? "—",
    qty: Number(p.qty) || 0,
    qty_alert: p.qty_alert != null ? Number(p.qty_alert) : null,
    updatedLabel: formatUpdatedLabel(p.updated_at),
    catalogProduct: p
  };
}

const ManageStock = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const [token] = useState(() => readTillflowToken());
  const liveMode = Boolean(token);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const demoRows = useMemo(() => mapDemoStockRows(), []);
  const [loading, setLoading] = useState(Boolean(token));
  const [listError, setListError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [addProductId, setAddProductId] = useState(null);
  const [addQtyDelta, setAddQtyDelta] = useState("1");
  const [addQtyAlert, setAddQtyAlert] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editQtyAlert, setEditQtyAlert] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const data = await listProductsRequest(token);
      setCatalogProducts(data.products ?? []);
    } catch (e) {
      setCatalogProducts([]);
      if (e instanceof TillFlowApiError) {
        setListError(
          e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message
        );
      } else {
        setListError("Failed to load stock from catalog");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadCatalog();
    }
  }, [token, loadCatalog]);

  const liveRows = useMemo(
    () => catalogProducts.map(mapCatalogProduct),
    [catalogProducts]
  );

  const categoryOptions = useMemo(() => {
    if (!liveMode) {
      return [];
    }
    const seen = new Map();
    for (const p of catalogProducts) {
      const c = p.category;
      if (c?.id != null && !seen.has(c.id)) {
        seen.set(c.id, { label: c.name ?? `Category ${c.id}`, value: c.id });
      }
    }
    return [...seen.values()].sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );
  }, [catalogProducts, liveMode]);

  const productSelectOptions = useMemo(
    () =>
      catalogProducts.map((p) => ({
        label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
        value: p.id
      })),
    [catalogProducts]
  );

  const displayRows = useMemo(() => {
    const base = liveMode ? liveRows : demoRows;
    let out = base;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        return (
          String(r.name).toLowerCase().includes(q) ||
          String(r.sku).toLowerCase().includes(q) ||
          String(r.categoryName).toLowerCase().includes(q)
        );
      });
    }

    if (liveMode && categoryFilter != null) {
      out = out.filter((r) => r.catalogProduct?.category_id === categoryFilter);
    }

    if (liveMode && lowStockOnly) {
      out = out.filter((r) => {
        if (r.qty_alert == null) {
          return false;
        }
        return r.qty <= r.qty_alert;
      });
    }

    return out;
  }, [
    liveMode,
    liveRows,
    demoRows,
    searchQuery,
    categoryFilter,
    lowStockOnly
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, categoryFilter, lowStockOnly, liveMode]);

  const totalRecords = displayRows.length;

  const openEditModal = (row) => {
    if (!liveMode || !row?.catalogProduct) {
      return;
    }
    setEditRow(row);
    setEditQty(String(row.qty));
    setEditQtyAlert(
      row.qty_alert != null && !Number.isNaN(row.qty_alert)
        ? String(row.qty_alert)
        : ""
    );
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!token || !liveMode) {
      return;
    }
    const p = catalogProducts.find((x) => x.id === addProductId);
    if (!p) {
      setListError("Select a product");
      return;
    }
    const delta = parseInt(addQtyDelta, 10);
    if (!Number.isFinite(delta) || delta < 1) {
      setListError("Enter a quantity of at least 1");
      return;
    }
    const nextQty = (Number(p.qty) || 0) + delta;
    setAddSubmitting(true);
    setListError("");
    try {
      const body = { qty: nextQty };
      if (addQtyAlert.trim() !== "") {
        const qa = parseInt(addQtyAlert, 10);
        if (Number.isFinite(qa) && qa >= 0) {
          body.qty_alert = qa;
        }
      }
      await updateProductRequest(token, p.id, body);
      hideBsModal("add-stock");
      setAddProductId(null);
      setAddQtyDelta("1");
      setAddQtyAlert("");
      await loadCatalog();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError("Could not update stock");
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!token || !liveMode || !editRow?.catalogProduct) {
      return;
    }
    const q = parseInt(editQty, 10);
    if (!Number.isFinite(q) || q < 0) {
      setListError("Enter a valid quantity");
      return;
    }
    const body = { qty: q };
    if (editQtyAlert.trim() === "") {
      body.qty_alert = null;
    } else {
      const qa = parseInt(editQtyAlert, 10);
      if (!Number.isFinite(qa) || qa < 0) {
        setListError("Enter a valid reorder level");
        return;
      }
      body.qty_alert = qa;
    }
    setEditSubmitting(true);
    setListError("");
    try {
      await updateProductRequest(token, editRow.catalogProduct.id, body);
      hideBsModal("edit-stock");
      setEditRow(null);
      await loadCatalog();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setListError(err.message);
      } else {
        setListError("Could not save stock");
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const columns = [
    {
      header: "Product",
      field: "name",
      key: "name",
      body: (data) => (
        <div className="d-flex align-items-center">
          <span className="avatar avatar-md me-2 bg-light text-dark d-inline-flex align-items-center justify-content-center overflow-hidden">
            {data.displayImage ? (
              <img src={data.displayImage} alt="" />
            ) : (
              <span className="small fw-semibold px-1">{initials(data.name)}</span>
            )}
          </span>
          <span className="text-body">{data.name}</span>
        </div>
      )
    },
    { header: "SKU", field: "sku", key: "sku" },
    { header: "Category", field: "categoryName", key: "categoryName" },
    { header: "Unit", field: "unitLabel", key: "unitLabel" },
    { header: "Qty", field: "qty", key: "qty" },
    {
      header: "Reorder at",
      field: "qty_alert",
      key: "qty_alert",
      body: (data) =>
        data.qty_alert != null && !Number.isNaN(data.qty_alert)
          ? data.qty_alert
          : "—"
    },
    { header: "Updated", field: "updatedLabel", key: "updatedLabel" },
    {
      header: "",
      field: "actions",
      key: "actions",
      sortable: false,
      body: (row) => (
        <div className="d-flex align-items-center edit-delete-action">
          <button
            type="button"
            className="me-2 border rounded d-flex align-items-center p-2 bg-transparent"
            data-bs-toggle={liveMode && row.catalogProduct ? "modal" : undefined}
            data-bs-target={liveMode && row.catalogProduct ? "#edit-stock" : undefined}
            onClick={() => {
              if (liveMode && row.catalogProduct) {
                openEditModal(row);
              }
            }}>
            <i className="feather icon-edit" />
          </button>
          {!liveMode && (
            <button
              type="button"
              className="p-2 border rounded d-flex align-items-center bg-transparent"
              data-bs-toggle="modal"
              data-bs-target="#delete-modal">
              <i className="feather icon-trash-2" />
            </button>
          )}
        </div>
      )
    }
  ];

  const handleSearch = (value) => {
    setSearchQuery(value ?? "");
  };

  return (
    <>
      <div className={`page-wrapper manage-stock-page${inTillflowShell ? " manage-stock-page--tillflow" : ""}`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Manage Stock</h4>
                <h6>
                  {liveMode
                    ? inTillflowShell
                      ? "Catalog quantities for your tenant"
                      : "Catalog quantities — open from TillFlow admin for live data"
                    : "Sample data — sign in to TillFlow to load your catalog"}
                </h6>
              </div>
            </div>
            <TableTopHead
              onRefresh={liveMode ? () => void loadCatalog() : undefined}
            />
            <div className="page-btn d-flex gap-2 flex-wrap">
              {liveMode && (
                <Link to="/tillflow/admin/items" className="btn btn-outline-secondary">
                  <i className="feather icon-package me-1" />
                  Item list
                </Link>
              )}
              <button
                type="button"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-stock"
                onClick={() => {
                  if (liveMode && catalogProducts.length) {
                    setAddProductId((prev) => prev ?? catalogProducts[0].id);
                  }
                }}>
                <i className="ti ti-circle-plus me-1" />
                Add Stock
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi callback={handleSearch} rows={rows} setRows={setRows} />
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                {liveMode && categoryOptions.length > 0 && (
                  <div className="me-2" style={{ minWidth: "12rem" }}>
                    <CommonSelect
                      className="w-100"
                      options={[{ label: "All categories", value: null }, ...categoryOptions]}
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.value ?? null)}
                      placeholder="Category"
                      filter
                    />
                  </div>
                )}
                {liveMode && (
                  <div className="form-check ms-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="low-stock-only"
                      checked={lowStockOnly}
                      onChange={(e) => setLowStockOnly(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="low-stock-only">
                      Low stock only
                    </label>
                  </div>
                )}
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
                  column={columns}
                  data={displayRows}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  loading={loading}
                  selectionMode="checkbox"
                  selection={selectedStocks}
                  onSelectionChange={(e) => setSelectedStocks(e.value)}
                  dataKey="id"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
      <div className="modal fade" id="add-stock">
        <div className="modal-dialog modal-dialog-centered stock-adjust-modal">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add Stock</h4>
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
                  <div className="row">
                    <div className="col-lg-12">
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
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">
                          Quantity to add <span className="text-danger ms-1">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="form-control"
                          value={addQtyDelta}
                          onChange={(e) => setAddQtyDelta(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-0">
                        <label className="form-label">Reorder alert (optional)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-control"
                          placeholder="Leave blank to keep current"
                          value={addQtyAlert}
                          onChange={(e) => setAddQtyAlert(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted mb-0">
                    Sign in through{" "}
                    <Link to="/tillflow" className="fw-semibold">
                      TillFlow
                    </Link>{" "}
                    with an account that has catalog access to adjust stock.
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
                  disabled={!liveMode || addSubmitting || catalogProducts.length === 0}>
                  {addSubmitting ? "Saving…" : "Add Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal fade" id="edit-stock">
        <div className="modal-dialog modal-dialog-centered stock-adjust-modal">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Edit Stock</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editRow?.catalogProduct ? (
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">Product</label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly
                          value={editRow.name}
                        />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="modal-body-table mb-3">
                        <div className="table-responsive">
                          <table className="table datanew">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Category</th>
                                <th>Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <Link to="#" className="avatar avatar-md me-2">
                                      {editRow.displayImage ? (
                                        <img src={editRow.displayImage} alt="" />
                                      ) : (
                                        <span className="small">{initials(editRow.name)}</span>
                                      )}
                                    </Link>
                                    <Link to="#">{editRow.name}</Link>
                                  </div>
                                </td>
                                <td>{editRow.sku}</td>
                                <td>{editRow.categoryName}</td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    className="form-control form-control-sm"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value)}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <label className="form-label">Reorder alert</label>
                      <input
                        type="number"
                        min={0}
                        className="form-control"
                        placeholder="Blank clears reorder level"
                        value={editQtyAlert}
                        onChange={(e) => setEditQtyAlert(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="search-form mb-3">
                        <label className="form-label">
                          Product<span className="text-danger ms-1">*</span>
                        </label>
                        <div className="position-relative">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Select Product"
                            defaultValue="Nike Jordan"
                          />
                          <i className="feather icon-search feather-search" />
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="modal-body-table">
                        <div className="table-responsive">
                          <table className="table datanew">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Category</th>
                                <th>Qty</th>
                                <th className="no-sort" />
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <Link to="#" className="avatar avatar-md me-2">
                                      <img src={stockImg02} alt="product" />
                                    </Link>
                                    <Link to="#">Nike Jordan</Link>
                                  </div>
                                </td>
                                <td>PT002</td>
                                <td>Nike</td>
                                <td>
                                  <div className="product-quantity bg-gray-transparent border-0">
                                    <span className="quantity-btn">
                                      <i className="feather icon-minus-circle feather-search" />
                                    </span>
                                    <input
                                      type="text"
                                      className="quntity-input bg-transparent"
                                      defaultValue={2}
                                    />
                                    <span className="quantity-btn">
                                      +
                                      <i className="feather icon-plus-circle plus-circle" />
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center justify-content-between edit-delete-action">
                                    <Link className="d-flex align-items-center border rounded p-2" to="#">
                                      <i className="feather icon-trash-2" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
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
                  disabled={!liveMode || !editRow?.catalogProduct || editSubmitting}>
                  {editSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <DeleteModal />
    </>
  );
};

export default ManageStock;
