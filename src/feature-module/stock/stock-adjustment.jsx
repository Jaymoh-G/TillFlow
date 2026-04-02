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
  listStockAdjustmentsRequest
} from "../../tillflow/api/stockAdjustments";
import { listProductsRequest } from "../../tillflow/api/products";
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

function mapDemoRows() {
  return stockData.slice(0, 12).map((d, i) => {
    const isAdd = i % 2 === 0;
    const qty = (i % 5) + 1;
    const after =
      typeof d.qty === "number" ? d.qty : parseInt(String(d.qty), 10) || 0;
    const before = isAdd ? after - qty : after + qty;
    return {
      id: `demo-${d.id}`,
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
      isDemo: true
    };
  });
}

function mapApiRow(a) {
  const p = a.product ?? {};
  const logo = p.brand?.logo_url ?? null;
  return {
    id: a.id,
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
      displayImage: logo
    },
    isDemo: false
  };
}

const StockAdjustment = () => {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const [token] = useState(() => readTillflowToken());
  const liveMode = Boolean(token);

  const [adjustments, setAdjustments] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const demoRows = useMemo(() => mapDemoRows(), []);
  const [loading, setLoading] = useState(Boolean(token));
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

  const [notesModalText, setNotesModalText] = useState("");

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
          e.status === 403 ? `${e.message} (needs catalog.manage)` : e.message
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

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (token) {
      void loadProducts();
    }
  }, [token, loadProducts]);

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
          String(notes).toLowerCase().includes(q)
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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!token || !liveMode) {
      return;
    }
    if (!addProductId) {
      setListError("Select a product");
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

  const columns = [
  {
      header: "Date",
      field: "created_at",
      key: "created_at",
      body: (r) => formatWhen(r.created_at)
    },
  {
    header: "Product",
    field: "product",
    key: "product",
      body: (r) => (
    <div className="d-flex align-items-center">
          <span className="avatar avatar-md me-2 bg-light text-dark d-inline-flex align-items-center justify-content-center overflow-hidden">
            {r.product?.displayImage ? (
              <img src={r.product.displayImage} alt="" />
            ) : (
              <span className="small fw-semibold px-1">
                {initials(r.product?.name)}
              </span>
            )}
          </span>
          <span className="text-body">{r.product?.name ?? "—"}</span>
        </div>
      )
    },
    { header: "SKU", field: "sku", key: "sku", body: (r) => r.product?.sku ?? "—" },
    {
      header: "Type",
      field: "type",
      key: "type",
      body: (r) => (
        <span
          className={`badge ${r.type === "add" ? "bg-success" : "bg-warning text-dark"}`}>
          {r.type === "add" ? "Add" : "Remove"}
        </span>
      )
    },
    {
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
    { header: "Before", field: "qty_before", key: "qty_before" },
    { header: "After", field: "qty_after", key: "qty_after" },
    {
      header: "Reference",
      field: "reference",
      key: "reference",
      body: (r) => r.reference || "—"
    },
  {
    header: "",
    field: "actions",
    key: "actions",
    sortable: false,
      body: (r) => (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary border rounded d-flex align-items-center px-2 py-1"
        data-bs-toggle="modal"
          data-bs-target="#view-adjustment-notes"
          onClick={() => setNotesModalText(r.notes || "—")}
          title="Notes">
            <i className="feather icon-file-text" />
        </button>
      )
    }
  ];

  return (
    <>
      <div
        className={`page-wrapper stock-adjustment-page${inTillflowShell ? " stock-adjustment-page--tillflow" : ""}`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Stock Adjustment</h4>
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
            />
            <div className="page-btn d-flex gap-2 flex-wrap">
              {liveMode && (
                <Link to="/tillflow/admin/items" className="btn btn-outline-secondary">
                  <i className="feather icon-package me-1" />
                  Item list
                </Link>
              )}
              {liveMode && (
                <Link to="/tillflow/admin/manage-stocks" className="btn btn-outline-secondary">
                  <i className="feather icon-layers me-1" />
                  Manage stock
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
                  disabled={!liveMode || addSubmitting || catalogProducts.length === 0}>
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
    </>
  );
};

export default StockAdjustment;
