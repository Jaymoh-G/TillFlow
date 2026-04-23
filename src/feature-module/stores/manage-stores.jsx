import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadRowsExcel, downloadRowsPdf } from "../../tillflow/utils/listExport";
import { useStores } from "../../stores/useStores";
import {
  saveStores
} from "../../stores/storesRegistry";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { TillFlowApiError } from "../../tillflow/api/errors";
import ImportRecordsModal from "../../tillflow/components/ImportRecordsModal";
import {
  createStoreRequest,
  deleteStoreRequest,
  listStoresRequest,
  updateStoreRequest
} from "../../tillflow/api/stores";
import {
  downloadStoresImportTemplate,
  parseStoresImportFile
} from "../../tillflow/utils/storesImport";

function hideBsModal(id) {
  const el = document.getElementById(id);
  if (el && typeof window !== "undefined" && window.bootstrap?.Modal) {
    const inst =
      window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.hide();
  }
}

function formatWhen(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

export default function ManageStores() {
  const location = useLocation();
  const inTillflowShell = location.pathname.includes("/admin");
  const auth = useOptionalAuth();
  const token = auth?.token ?? null;
  const stores = useStores();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [selectedRows, setSelectedRows] = useState([]);
  const [listLoading, setListLoading] = useState(() => Boolean(token));
  const [listError, setListError] = useState("");

  const [addName, setAddName] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const loadStoresFromApi = useCallback(async () => {
    if (!token) {
      return;
    }
    setListLoading(true);
    setListError("");
    try {
      const data = await listStoresRequest(token);
      const rows = Array.isArray(data?.stores) ? data.stores : [];
      const normalized = rows.map((s) => ({
        id: Number(s.id),
        name: String(s.name ?? ""),
        code: String(s.code ?? ""),
        location: s.location ?? null,
        totalQty:
          s.total_qty != null && s.total_qty !== ""
            ? Number(s.total_qty)
            : 0,
        createdAt: s.created_at ?? null,
        updatedAt: s.updated_at ?? null
      }));
      saveStores(normalized);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError("Could not load stores.");
      }
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setListLoading(false);
      return;
    }
    void loadStoresFromApi();
  }, [token, loadStoresFromApi]);

  const displayRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return stores;
    }
    return stores.filter(
      (s) =>
        String(s.name).toLowerCase().includes(q) ||
        String(s.code).toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  const handleExportExcel = useCallback(async () => {
    const records = displayRows.map((s) => ({
      "Store name": String(s.name ?? ""),
      Code: String(s.code ?? ""),
      "Total Qty": s.totalQty != null ? String(s.totalQty) : "0",
      Location: String(s.location ?? ""),
      Updated: formatWhen(s.updatedAt)
    }));
    await downloadRowsExcel(records, "Stores", "stores");
  }, [displayRows]);

  const handleExportPdf = useCallback(async () => {
    const body = displayRows.map((s) => [
      String(s.name ?? ""),
      String(s.code ?? ""),
      s.totalQty != null ? String(s.totalQty) : "0",
      String(s.location ?? ""),
      formatWhen(s.updatedAt)
    ]);
    await downloadRowsPdf(
      "Stores",
      [
        "Store name",
        "Code",
        "Total Qty",
        "Location",
        "Updated"
      ],
      body,
      "stores"
    );
  }, [displayRows]);

  const openEdit = useCallback((row) => {
    setEditRow(row);
    setEditName(row.name);
    setEditLocation(row.location ?? "");
    setEditError("");
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    const name = String(addName || "").trim();
    const location = String(addLocation || "").trim();
    if (!name) {
      setAddError("Name is required.");
      return;
    }
    if (!token) {
      setAddError("Sign in to add stores.");
      return;
    }
    setAddSubmitting(true);
    try {
      await createStoreRequest(token, {
        name,
        store_name: name,
        location: location || null
      });
      await loadStoresFromApi();
      setAddName("");
      setAddLocation("");
      hideBsModal("add-store");
    } catch (e1) {
      if (e1 instanceof TillFlowApiError) {
        setAddError(e1.message);
      } else {
        setAddError("Could not create store.");
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editRow) {
      return;
    }
    setEditError("");
    if (!token) {
      setEditError("Sign in to edit stores.");
      return;
    }
    const name = String(editName || "").trim();
    const location = String(editLocation || "").trim();
    if (!name) {
      setEditError("Name is required.");
      return;
    }
    setEditSubmitting(true);
    try {
      await updateStoreRequest(token, editRow.id, {
        name,
        store_name: name,
        location: location || null
      });
      await loadStoresFromApi();
      setEditRow(null);
      hideBsModal("edit-store");
    } catch (e2) {
      if (e2 instanceof TillFlowApiError) {
        setEditError(e2.message);
      } else {
        setEditError("Could not update store.");
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId == null) {
      return;
    }
    if (!token) {
      setListError("Sign in to delete stores.");
      return;
    }
    setDeleteSubmitting(true);
    try {
      await deleteStoreRequest(token, deleteId);
      await loadStoresFromApi();
      setSelectedRows((s) => s.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      hideBsModal("delete-store");
    } catch (e3) {
      if (e3 instanceof TillFlowApiError) {
        setListError(e3.message);
      } else {
        setListError("Could not delete store.");
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const runImportStores = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const details = [];
    const existing = new Set(stores.map((s) => String(s.name ?? "").trim().toLowerCase()).filter(Boolean));
    for (const row of importRows) {
      const key = String(row.name ?? "").trim().toLowerCase();
      if (key && existing.has(key)) {
        skipped += 1;
        details.push(`Row ${row.sheetRow}: skipped duplicate store name "${row.name}".`);
        continue;
      }
      try {
        await createStoreRequest(token, {
          name: row.name,
          store_name: row.store_name,
          location: row.location,
          code: row.code ?? undefined
        });
        created += 1;
        if (key) existing.add(key);
      } catch (e) {
        failed += 1;
        details.push(`Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : "Could not create store."}`);
      }
    }
    await loadStoresFromApi();
    setImportSummary({ created, skipped, failed, details });
    setImporting(false);
  }, [token, importRows, stores, loadStoresFromApi]);

  const columns = useMemo(
    () => [
      {
        header: "Store name",
        field: "name",
        key: "name",
        body: (row) => <span className="text-body fw-medium">{row.name}</span>
      },
      {
        header: "Code",
        field: "code",
        key: "code",
        body: (row) => (
          <span className="font-monospace small">{row.code ?? "—"}</span>
        )
      },
      {
        header: "Total Qty",
        field: "totalQty",
        key: "totalQty",
        className: "text-end",
        headerClassName: "text-end",
        sortField: "totalQty",
        body: (row) => (
          <span className="text-end d-block">
            {row.totalQty != null ? Number(row.totalQty).toLocaleString() : "—"}
          </span>
        )
      },
      {
        header: "Location",
        field: "location",
        key: "location",
        body: (row) => <span>{row.location ?? "—"}</span>
      },
      {
        header: "Updated",
        field: "updatedAt",
        key: "updatedAt",
        body: (row) => formatWhen(row.updatedAt)
      },
      {
        header: "",
        field: "actions",
        key: "actions",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action d-flex align-items-center justify-content-center gap-1">
            <button
              type="button"
              className="p-2 border rounded bg-transparent d-flex align-items-center"
              data-bs-toggle="modal"
              data-bs-target="#edit-store"
              onClick={() => openEdit(row)}
              title="Edit">
              <i className="feather icon-edit" />
            </button>
            <button
              type="button"
              className="p-2 border rounded bg-transparent d-flex align-items-center"
              data-bs-toggle="modal"
              data-bs-target="#delete-store"
              onClick={() => setDeleteId(row.id)}
              title="Delete">
              <i className="feather icon-trash-2" />
            </button>
          </div>
        )
      }
    ],
    [openEdit]
  );

  return (
    <>
      <div
        className={`page-wrapper manage-stores-page${
          inTillflowShell ? " manage-stores-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Stores</h4>
                <h6>Inventory locations used for stock transfer.</h6>
              </div>
            </div>
            <TableTopHead
              onRefresh={() => void loadStoresFromApi()}
              onExportPdf={
                listLoading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportPdf()
              }
              onExportExcel={
                listLoading || displayRows.length === 0
                  ? undefined
                  : () => void handleExportExcel()
              }
              onImport={token ? () => setShowImport(true) : undefined}
            />
            {listError ? (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {listError}
              </div>
            ) : null}
            <div className="page-btn d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-store"
                onClick={() => {
                  setAddError("");
                  setAddName("");
                  setAddLocation("");
                }}>
                <i className="ti ti-circle-plus me-1" />
                Add store
              </button>
              <Link
                to={
                  inTillflowShell
                    ? "/admin/stock-transfer"
                    : "/stock-transfer"
                }
                className="btn btn-outline-secondary">
                <i className="feather icon-corner-up-right me-1" />
                Transfer Stock
              </Link>
              {inTillflowShell ? (
                <Link
                  to="/admin/stock-adjustment"
                  className="btn btn-outline-secondary">
                  <i className="feather icon-trending-up me-1" />
                  Adjust Stock
                </Link>
              ) : null}
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={(v) => {
                  setSearchQuery(v ?? "");
                  setCurrentPage(1);
                }}
                rows={rows}
                setRows={setRows}
              />
            </div>
            <div className="card-body p-0">
              <PrimeDataTable
                column={columns}
                data={displayRows}
                rows={rows}
                setRows={setRows}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalRecords={displayRows.length}
                selectionMode="checkbox"
                selection={selectedRows}
                onSelectionChange={(e) => setSelectedRows(e.value)}
                dataKey="id"
                loading={listLoading}
              />
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-store">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add store</h4>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                {addError ? (
                  <div className="alert alert-warning py-2 mb-3">{addError}</div>
                ) : null}
                <div className="mb-3">
                  <label className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Main outlet"
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Location</label>
                  <input
                    className="form-control"
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value)}
                    placeholder="Location (optional)"
                  />
                </div>
                <p className="text-muted small mb-0 mt-3">
                  Store code is generated on save until the API assigns canonical codes
                  (e.g. ST-001).
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addSubmitting}>
                  {addSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit-store">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit store</h4>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={() => setEditRow(null)}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body">
                {editError ? (
                  <div className="alert alert-warning py-2 mb-3">{editError}</div>
                ) : null}
                <div className="mb-3">
                  <label className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Location</label>
                  <input
                    className="form-control"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Location (optional)"
                  />
                </div>
                {editRow?.code ? (
                  <p className="text-muted small mb-0">
                    Store code:{" "}
                    <span className="font-monospace">{editRow.code}</span>{" "}
                    (assigned when created)
                  </p>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                  onClick={() => setEditRow(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete-store">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="content p-5 px-3 text-center">
              <span className="rounded-circle d-inline-flex p-2 bg-danger-transparent mb-2">
                <i className="ti ti-trash fs-24 text-danger" />
              </span>
              <h4 className="mb-0">Delete this store?</h4>
              <p className="text-muted small mt-2 mb-0">
                Transfers that reference this id will show a placeholder name
                until you reassign them.
              </p>
              <div className="mt-3 d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                  onClick={() => setDeleteId(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void confirmDelete()}
                  disabled={deleteSubmitting}>
                  {deleteSubmitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImportRecordsModal
        show={showImport}
        title="Import stores"
        helpText="Required: name. Optional: location, code."
        previewColumns={[
          { key: "sheetRow", label: "Row", render: (r) => r.sheetRow },
          { key: "name", label: "Name", render: (r) => r.name },
          { key: "location", label: "Location", render: (r) => r.location || "—" },
          { key: "code", label: "Code", render: (r) => r.code || "Auto" }
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
        onDownloadTemplate={() => void downloadStoresImportTemplate()}
        onChooseFile={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = "";
          if (!file) return;
          const parsed = await parseStoresImportFile(file);
          setImportRows(parsed.rows);
          setImportErrors(parsed.errors);
          setImportSummary(null);
        }}
        onImport={() => void runImportStores()}
      />
    </>
  );
}
