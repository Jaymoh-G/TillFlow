import { stockTransferData } from "../../core/json/stock-transfer-data";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { downloadImg } from "../../utils/imagepath";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStores } from "../../stores/useStores";
import { storeLabel } from "../../stores/storesRegistry";
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

function summarizeLines(lines) {
  const qty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  return { noOfProducts: lines.length, quantityTransferred: qty };
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

  const [token] = useState(() => readTillflowToken());
  const liveMode = Boolean(token);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(Boolean(token));
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
    stockTransferData.map((r) => ({
      ...r,
      lines: Array.isArray(r.lines) ? r.lines : []
    }))
  );
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
  /** @type {null | number | string} — product id (API) or demo SKU */
  const [addProductValue, setAddProductValue] = useState(null);
  const [addLineQty, setAddLineQty] = useState("1");
  const [formError, setFormError] = useState("");

  const [editing, setEditing] = useState(null);
  const [editFrom, setEditFrom] = useState(null);
  const [editTo, setEditTo] = useState(null);
  const [editRef, setEditRef] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState([]);
  const [editProductValue, setEditProductValue] = useState(null);
  const [editLineQty, setEditLineQty] = useState("1");
  const [editError, setEditError] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState(null);

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

  const productSelectOptions = useMemo(() => {
    const head = { label: "Select product", value: null };
    if (liveMode) {
      return [
        head,
        ...catalogProducts.map((p) => ({
          label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
          value: p.id
        }))
      ];
    }
    return [
      head,
      ...DEMO_PRODUCTS.map((p) => ({
        label: `${p.name} (${p.sku})`,
        value: p.sku
      }))
    ];
  }, [liveMode, catalogProducts]);

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
        const d = parseRowDate(r.date);
        return d && d >= startOfMonth;
      });
    } else if (sortMode === "last7") {
      list = list.filter((r) => {
        const d = parseRowDate(r.date);
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
        const da = parseRowDate(a.date);
        const db = parseRowDate(b.date);
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

  const resetAddForm = useCallback(() => {
    setAddFrom(null);
    setAddTo(null);
    setAddRef("");
    setAddNotes("");
    setAddLines([]);
    setAddProductValue(null);
    setAddLineQty("1");
    setFormError("");
  }, []);

  const openEdit = useCallback((row) => {
    setEditing(row);
    setEditFrom(row.fromStoreId ?? null);
    setEditTo(row.toStoreId ?? null);
    setEditRef(row.refNumber);
    setEditNotes(row.notes ?? "");
    setEditProductValue(null);
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
    if (addProductValue == null || addProductValue === "") {
      setFormError("Select a product.");
      return;
    }
    const q = parseInt(addLineQty, 10);
    if (!Number.isFinite(q) || q < 1) {
      setFormError("Enter a quantity of at least 1.");
      return;
    }
    setFormError("");
    if (liveMode) {
      const p = catalogProducts.find((x) => x.id === addProductValue);
      if (!p) {
        return;
      }
      setAddLines((prev) => [
        ...prev,
        {
          lineId: `ln-${Date.now()}`,
          productId: p.id,
          name: p.name ?? "—",
          sku: p.sku ?? "—",
          category: p.category?.name ?? "—",
          qty: q
        }
      ]);
    } else {
      const p = DEMO_PRODUCTS.find((x) => x.sku === addProductValue);
      if (!p) {
        return;
      }
      setAddLines((prev) => [
        ...prev,
        {
          lineId: `ln-${Date.now()}`,
          name: p.name,
          sku: p.sku,
          category: p.category,
          qty: q
        }
      ]);
    }
    setAddProductValue(null);
    setAddLineQty("1");
  };

  const handleEditAddLine = () => {
    if (editProductValue == null || editProductValue === "") {
      setEditError("Select a product.");
      return;
    }
    const q = parseInt(editLineQty, 10);
    if (!Number.isFinite(q) || q < 1) {
      setEditError("Enter a quantity of at least 1.");
      return;
    }
    setEditError("");
    if (liveMode) {
      const p = catalogProducts.find((x) => x.id === editProductValue);
      if (!p) {
        return;
      }
      setEditLines((prev) => [
        ...prev,
        {
          lineId: `ln-${Date.now()}`,
          productId: p.id,
          name: p.name ?? "—",
          sku: p.sku ?? "—",
          category: p.category?.name ?? "—",
          qty: q
        }
      ]);
    } else {
      const p = DEMO_PRODUCTS.find((x) => x.sku === editProductValue);
      if (!p) {
        return;
      }
      setEditLines((prev) => [
        ...prev,
        {
          lineId: `ln-${Date.now()}`,
          name: p.name,
          sku: p.sku,
          category: p.category,
          qty: q
        }
      ]);
    }
    setEditProductValue(null);
    setEditLineQty("1");
  };

  const handleCreateTransfer = (e) => {
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
    const ref =
      addRef.trim() ||
      `#ST-${Date.now().toString(36).toUpperCase()}`;
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
        refNumber: ref.startsWith("#") ? ref : `#${ref.replace(/^#/, "")}`,
        date: when,
        notes: addNotes.trim() || undefined,
        lines: addLines.map(({ lineId: _lid, ...rest }) => ({ ...rest }))
      },
      ...prev
    ]);
    resetAddForm();
    hideBsModal("add-stock-transfer");
  };

  const handleSaveEdit = (e) => {
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
    const { noOfProducts, quantityTransferred } = summarizeLines(editLines);
    const ref =
      editRef.trim().startsWith("#") ? editRef.trim() : `#${editRef.replace(/^#/, "")}`;

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

  const confirmDelete = () => {
    if (deleteTargetId == null) {
      return;
    }
    setTransfers((prev) => prev.filter((r) => r.id !== deleteTargetId));
    setSelectedTransfers((sel) => sel.filter((r) => r.id !== deleteTargetId));
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
            onClick={() => setDeleteTargetId(row.id)}
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
                <h4>Stock transfer</h4>
                <h6>
                  {inTillflowShell
                    ? "Plan moves between inventory stores. Products on each transfer line are loaded from your Items catalog (same list as Manage stock)."
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
                setTransfers(
                  stockTransferData.map((r) => ({
                    ...r,
                    lines: Array.isArray(r.lines) ? r.lines : []
                  }))
                );
                setCurrentPage(1);
                void loadCatalog();
              }}
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
                  to="/tillflow/admin/manage-stocks"
                  className="btn btn-outline-secondary">
                  <i className="feather icon-layers me-1" />
                  Manage stock
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
                    <label className="form-label">
                      Products <span className="text-danger ms-1">*</span>
                    </label>
                    <div className="row g-2 align-items-end mb-2">
                      <div className="col-md-7">
                        <CommonSelect
                          className="w-100"
                          options={productSelectOptions}
                          value={addProductValue}
                          onChange={(e) => {
                            const v = e.value;
                            setAddProductValue(
                              v == null || v === "" ? null : v
                            );
                          }}
                          placeholder="Product"
                          filter
                          disabled={liveMode && (productsLoading || !!productsError)}
                        />
                      </div>
                      <div className="col-md-3">
                        <input
                          type="number"
                          min={1}
                          className="form-control"
                          value={addLineQty}
                          onChange={(e) => setAddLineQty(e.target.value)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary w-100"
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
                    <label className="form-label">Products</label>
                    <div className="row g-2 align-items-end mb-2">
                      <div className="col-md-7">
                        <CommonSelect
                          className="w-100"
                          options={productSelectOptions}
                          value={editProductValue}
                          onChange={(e) => {
                            const v = e.value;
                            setEditProductValue(
                              v == null || v === "" ? null : v
                            );
                          }}
                          placeholder="Product"
                          filter
                          disabled={liveMode && (productsLoading || !!productsError)}
                        />
                      </div>
                      <div className="col-md-3">
                        <input
                          type="number"
                          min={1}
                          className="form-control"
                          value={editLineQty}
                          onChange={(e) => setEditLineQty(e.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary w-100"
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
                              <td className="text-end" style={{ minWidth: "7rem" }}>
                                <input
                                  type="number"
                                  min={1}
                                  className="form-control form-control-sm text-end"
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
                This only removes the row from the list in the browser until a
                server API is connected.
              </p>
              <div className="modal-footer-btn mt-3 d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                  onClick={() => setDeleteTargetId(null)}>
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
