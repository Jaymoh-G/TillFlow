import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import TableTopHead from "../../components/table-top-head";
import CommonFooter from "../../components/footer/commonFooter";
import { Link, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { useStores } from "../../stores/useStores";
import {
  addStore,
  deleteStore,
  updateStore
} from "../../stores/storesRegistry";

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
  const inTillflowShell = location.pathname.includes("/tillflow/admin");
  const stores = useStores();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [selectedRows, setSelectedRows] = useState([]);

  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editError, setEditError] = useState("");

  const [deleteId, setDeleteId] = useState(null);

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

  const openEdit = useCallback((row) => {
    setEditRow(row);
    setEditName(row.name);
    setEditCode(row.code ?? "");
    setEditError("");
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    setAddError("");
    const res = addStore({ name: addName, code: addCode });
    if (!res.ok) {
      setAddError(res.error);
      return;
    }
    setAddName("");
    setAddCode("");
    hideBsModal("add-store");
  };

  const handleEditSave = (e) => {
    e.preventDefault();
    if (!editRow) {
      return;
    }
    setEditError("");
    const res = updateStore(editRow.id, {
      name: editName,
      code: editCode
    });
    if (!res.ok) {
      setEditError(res.error);
      return;
    }
    setEditRow(null);
    hideBsModal("edit-store");
  };

  const confirmDelete = () => {
    if (deleteId == null) {
      return;
    }
    deleteStore(deleteId);
    setSelectedRows((s) => s.filter((r) => r.id !== deleteId));
    setDeleteId(null);
    hideBsModal("delete-store");
  };

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
                <h6>
                  Inventory locations used for stock transfer. Stored in this
                  browser (add a backend later to sync).
                </h6>
              </div>
            </div>
            <TableTopHead />
            <div className="page-btn d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add-store"
                onClick={() => {
                  setAddError("");
                  setAddName("");
                  setAddCode("");
                }}>
                <i className="ti ti-circle-plus me-1" />
                Add store
              </button>
              <Link
                to={
                  inTillflowShell
                    ? "/tillflow/admin/stock-transfer"
                    : "/stock-transfer"
                }
                className="btn btn-outline-secondary">
                <i className="feather icon-corner-up-right me-1" />
                Stock transfer
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
                  <label className="form-label">Code</label>
                  <input
                    className="form-control"
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value)}
                    placeholder="Short code (optional)"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
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
                <div className="mb-0">
                  <label className="form-label">Code</label>
                  <input
                    className="form-control"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-bs-dismiss="modal"
                  onClick={() => setEditRow(null)}>
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
}
