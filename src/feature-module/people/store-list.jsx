import { Edit2, Eye, PlusCircle, Trash2 } from "react-feather";
import { storeListData } from "../../core/json/store-list";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import {
  downloadStoreManagersExcel,
  downloadStoreManagersPdf
} from "../../utils/storeManagerExport";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CommonFooter from "../../components/footer/commonFooter";
import {
  createStoreManagerRequest,
  deleteStoreManagerRequest,
  listStoreManagersRequest,
  updateStoreManagerRequest
} from "../../tillflow/api/storeManagers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { Modal } from "bootstrap";

const ALL = { label: "All", value: "" };

const STORAGE_KEY = "retailpos_store_managers_v1";

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
  el.addEventListener("hidden.bs.modal", () => cleanupStaleModalUi(), { once: true });
  inst.hide();
  window.setTimeout(cleanupStaleModalUi, 450);
}

function loadStoredManagers() {
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

function getInitialManagerRows() {
  try {
    if (typeof window !== "undefined" && window.location.pathname.includes("/tillflow/admin")) {
      return [];
    }
  } catch {
    /* ignore */
  }
  const stored = loadStoredManagers();
  if (stored) {
    return stored;
  }
  return storeListData.map((r) => ({ ...r }));
}

function apiStoreManagerToRow(m) {
  return {
    id: m.id,
    code: m.code,
    store: m.store_name,
    username: m.username,
    email: m.email ?? "",
    phone: m.phone,
    location: m.location ?? "",
    status: m.status
  };
}

function nextStoreManagerCode(list) {
  let max = 0;
  for (const r of list) {
    const match = /^SM(\d+)$/i.exec(String(r.code ?? ""));
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return `SM${String(max + 1).padStart(3, "0")}`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

const StoreList = () => {
  const routeLocation = useLocation();
  const inTillflowShell = routeLocation.pathname.includes("/tillflow/admin");

  const auth = useOptionalAuth();
  const token = auth?.token ?? null;

  const [managers, setManagers] = useState(getInitialManagerRows);
  const [listLoading, setListLoading] = useState(() => Boolean(token));
  const [listError, setListError] = useState("");
  const listLoadGenRef = useRef(0);

  const loadManagers = useCallback(async () => {
    if (!token) {
      return;
    }
    const gen = ++listLoadGenRef.current;
    setListLoading(true);
    setListError("");
    try {
      const data = await listStoreManagersRequest(token);
      if (gen !== listLoadGenRef.current) {
        return;
      }
      setManagers((data.store_managers ?? []).map(apiStoreManagerToRow));
    } catch (e) {
      if (gen !== listLoadGenRef.current) {
        return;
      }
      setManagers([]);
      if (e instanceof TillFlowApiError) {
        setListError(
          e.status === 403 ? `${e.message} (needs users.manage)` : e.message
        );
      } else {
        setListError("Failed to load store managers.");
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
    loadManagers();
  }, [token, loadManagers]);

  useEffect(() => {
    if (inTillflowShell) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(managers));
    } catch {
      /* ignore */
    }
  }, [managers, inTillflowShell]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedStores, setSelectedStores] = useState([]);
  const [showPasswordAdd, setShowPasswordAdd] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  const [addStoreName, setAddStoreName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addStatusActive, setAddStatusActive] = useState(true);
  const [addError, setAddError] = useState("");

  const [editingCode, setEditingCode] = useState(null);
  const [editingManagerId, setEditingManagerId] = useState(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatusActive, setEditStatusActive] = useState(true);
  const [editError, setEditError] = useState("");

  const [viewRow, setViewRow] = useState(null);
  const [deleteCode, setDeleteCode] = useState(null);
  const [deleteManagerId, setDeleteManagerId] = useState(null);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...managers];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.store).toLowerCase().includes(q) ||
          String(r.username).toLowerCase().includes(q) ||
          String(r.email ?? "").toLowerCase().includes(q) ||
          String(r.phone).toLowerCase().includes(q) ||
          String(r.code).toLowerCase().includes(q) ||
          String(r.location ?? "").toLowerCase().includes(q)
      );
    }
    if (filterStatus) {
      list = list.filter((r) => r.status === filterStatus);
    }
    const locQ = filterLocation.trim().toLowerCase();
    if (locQ) {
      list = list.filter((r) => String(r.location ?? "").toLowerCase().includes(locQ));
    }
    return list;
  }, [managers, searchQuery, filterStatus, filterLocation]);

  const totalRecords = displayRows.length;

  const tableRowSignature = useMemo(
    () => displayRows.map((r) => r.code).join("|"),
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
  }, [searchQuery, rows, filterStatus, filterLocation]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterLocation("");
    setCurrentPage(1);
    if (token) {
      loadManagers();
    }
  }, [token, loadManagers]);

  const handleExportPdf = useCallback(async () => {
    try {
      await downloadStoreManagersPdf(displayRows);
    } catch {
      setListError("Could not export PDF. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const handleExportExcel = useCallback(async () => {
    try {
      await downloadStoreManagersExcel(displayRows);
    } catch {
      setListError("Could not export Excel. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const resetAddForm = useCallback(() => {
    setAddStoreName("");
    setAddUsername("");
    setAddPassword("");
    setAddEmail("");
    setAddPhone("");
    setAddLocation("");
    setAddStatusActive(true);
    setAddError("");
    setShowPasswordAdd(false);
  }, []);

  const openAddModal = useCallback(() => {
    resetAddForm();
  }, [resetAddForm]);

  const openEditManager = useCallback((row) => {
    setEditingCode(row.code);
    setEditingManagerId(row.id ?? null);
    setEditStoreName(row.store ?? "");
    setEditUsername(row.username ?? "");
    setEditPassword("");
    setEditEmail(row.email ?? "");
    setEditPhone(row.phone);
    setEditLocation(row.location ?? "");
    setEditStatusActive(row.status === "Active");
    setEditError("");
    setShowPasswordEdit(false);
  }, []);

  const openViewManager = useCallback((row) => {
    setViewRow(row);
  }, []);

  const openDeleteManager = useCallback((row) => {
    setDeleteCode(row.code);
    setDeleteManagerId(row.id ?? null);
  }, []);

  const saveNewManager = useCallback(async () => {
    setAddError("");
    const storeName = addStoreName.trim();
    const username = addUsername.trim();
    const password = addPassword;
    const em = addEmail.trim();
    const ph = addPhone.trim();
    const loc = addLocation.trim();
    if (!storeName || !username || !ph) {
      setAddError("Please fill in store name, user name, and phone.");
      return;
    }
    if (token && password.length < 8) {
      setAddError("Password must be at least 8 characters.");
      return;
    }
    if (!token && password.trim().length < 8) {
      setAddError("Password must be at least 8 characters.");
      return;
    }
    if (em && !isValidEmail(em)) {
      setAddError("Enter a valid email address.");
      return;
    }
    if (
      em &&
      managers.some((m) => String(m.email ?? "").toLowerCase() === em.toLowerCase())
    ) {
      setAddError("A store manager with this email already exists.");
      return;
    }
    if (managers.some((m) => String(m.username ?? "").toLowerCase() === username.toLowerCase())) {
      setAddError("This user name is already in use.");
      return;
    }
    if (managers.some((m) => String(m.phone ?? "").trim() === ph)) {
      setAddError("This phone number is already in use.");
      return;
    }
    const status = addStatusActive ? "Active" : "Inactive";

    if (token) {
      try {
        const data = await createStoreManagerRequest(token, {
          store_name: storeName,
          username,
          password,
          email: em || null,
          phone: ph,
          location: loc || null,
          status
        });
        if (!data?.store_manager) {
          setAddError("Unexpected response from server.");
          return;
        }
        await loadManagers();
        setSelectedStores([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setAddError(e.message);
        } else {
          setAddError("Could not create store manager.");
        }
        return;
      }
    } else {
      setManagers((prev) => {
        if (prev.some((m) => String(m.username ?? "").toLowerCase() === username.toLowerCase())) {
          return prev;
        }
        if (prev.some((m) => String(m.phone ?? "").trim() === ph)) {
          return prev;
        }
        const code = nextStoreManagerCode(prev);
        return [
          ...prev,
          {
            code,
            store: storeName,
            username,
            email: em,
            phone: ph,
            location: loc,
            status
          }
        ];
      });
    }

    resetAddForm();
    hideBsModal("add-store");
  }, [
    addStoreName,
    addUsername,
    addPassword,
    addEmail,
    addPhone,
    addLocation,
    addStatusActive,
    managers,
    resetAddForm,
    token,
    loadManagers
  ]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    saveNewManager();
  };

  const saveManagerEdits = useCallback(async () => {
    setEditError("");
    if (!editingCode) {
      return;
    }
    const storeName = editStoreName.trim();
    const username = editUsername.trim();
    const newPassword = editPassword.trim();
    const em = editEmail.trim();
    const ph = editPhone.trim();
    const loc = editLocation.trim();
    if (!storeName || !username || !ph) {
      setEditError("Please fill in store name, user name, and phone.");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setEditError("New password must be at least 8 characters.");
      return;
    }
    if (em && !isValidEmail(em)) {
      setEditError("Enter a valid email address.");
      return;
    }
    const emailDup =
      em &&
      managers.some(
        (m) =>
          m.code !== editingCode &&
          String(m.email ?? "").toLowerCase() === em.toLowerCase()
      );
    if (emailDup) {
      setEditError("Another record already uses this email.");
      return;
    }
    const userDup = managers.some(
      (m) =>
        m.code !== editingCode &&
        String(m.username ?? "").toLowerCase() === username.toLowerCase()
    );
    if (userDup) {
      setEditError("Another record already uses this user name.");
      return;
    }
    const phoneDup = managers.some(
      (m) => m.code !== editingCode && String(m.phone ?? "").trim() === ph
    );
    if (phoneDup) {
      setEditError("Another record already uses this phone number.");
      return;
    }
    const status = editStatusActive ? "Active" : "Inactive";

    if (token && editingManagerId != null) {
      try {
        const body = {
          store_name: storeName,
          username,
          email: em || null,
          phone: ph,
          location: loc || null,
          status
        };
        if (newPassword) {
          body.password = newPassword;
        }
        const data = await updateStoreManagerRequest(token, editingManagerId, body);
        if (!data?.store_manager) {
          setEditError("Unexpected response from server.");
          return;
        }
        await loadManagers();
        setSelectedStores([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setEditError(e.message);
        } else {
          setEditError("Could not save changes.");
        }
        return;
      }
    } else {
      setManagers((prev) =>
        prev.map((m) =>
          m.code === editingCode
            ? {
                ...m,
                store: storeName,
                username,
                email: em,
                phone: ph,
                location: loc,
                status
              }
            : m
        )
      );
    }

    setEditingCode(null);
    setEditingManagerId(null);
    setEditPassword("");
    hideBsModal("edit-store");
  }, [
    editingCode,
    editingManagerId,
    editStoreName,
    editUsername,
    editPassword,
    editEmail,
    editPhone,
    editLocation,
    editStatusActive,
    managers,
    token,
    loadManagers
  ]);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    saveManagerEdits();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCode) {
      return;
    }
    if (token && deleteManagerId != null) {
      try {
        await deleteStoreManagerRequest(token, deleteManagerId);
        await loadManagers();
        setSelectedStores([]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setListError(e.message);
        } else {
          setListError("Could not delete store manager.");
        }
        return;
      }
    } else {
      setManagers((prev) => prev.filter((m) => m.code !== deleteCode));
      setSelectedStores((sel) => sel.filter((m) => m.code !== deleteCode));
    }
    setDeleteCode(null);
    setDeleteManagerId(null);
    hideBsModal("delete-store-manager-modal");
  };

  const columns = useMemo(
    () => [
      { header: "Code", field: "code", sortable: true },
      {
        header: "Store",
        field: "store",
        sortable: true,
        body: (row) => (
          <Link to="#" className="text-dark">
            {row.store}
          </Link>
        )
      },
      { header: "User name", field: "username", sortable: true },
      {
        header: "Email",
        field: "email",
        sortable: true,
        body: (row) => (row.email ? row.email : "—")
      },
      { header: "Phone", field: "phone", sortable: true },
      {
        header: "Location",
        field: "location",
        sortable: true,
        body: (row) => (row.location ? row.location : "—")
      },
      {
        header: "Status",
        field: "status",
        sortable: true,
        body: (row) => (
          <span
            className={`d-inline-flex align-items-center p-1 pe-2 rounded-1 text-white fs-10 ${
              row.status === "Active" ? "bg-success" : "bg-danger"
            }`}>
            <span
              className="rounded-circle bg-white align-self-center me-1 flex-shrink-0 d-inline-block"
              style={{ width: 6, height: 6 }}
              aria-hidden
            />
            {row.status}
          </span>
        )
      },
      {
        header: "",
        field: "actions",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action d-flex align-items-center">
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#view-store-manager"
              onClick={(e) => {
                e.preventDefault();
                openViewManager(row);
              }}>
              <Eye size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#edit-store"
              onClick={(e) => {
                e.preventDefault();
                openEditManager(row);
              }}>
              <Edit2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-store-manager-modal"
              onClick={(e) => {
                e.preventDefault();
                openDeleteManager(row);
              }}>
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        )
      }
    ],
    [openDeleteManager, openEditManager, openViewManager]
  );

  return (
    <>
      <div
        className={`page-wrapper store-managers-page${
          inTillflowShell ? " store-managers-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4 className="fw-bold">Store managers</h4>
                <h6>POS store accounts — search, filter by location or status.</h6>
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
            <div className="page-btn">
              <Link
                to="#"
                className="btn btn-primary text-white"
                data-bs-toggle="modal"
                data-bs-target="#add-store"
                onClick={(e) => {
                  e.preventDefault();
                  openAddModal();
                }}>
                <PlusCircle size={18} strokeWidth={1.75} className="me-1" aria-hidden />
                Add store manager
              </Link>
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
                <div style={{ minWidth: "12rem" }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Location"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    aria-label="Filter by location"
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
              </div>
            </div>
            <div className="card-body p-0">
              <div className="custom-datatable-filter table-responsive">
                <PrimeDataTable
                  key={tableRowSignature}
                  column={columns}
                  data={displayRows}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  loading={listLoading}
                  selectionMode="checkbox"
                  selection={selectedStores}
                  onSelectionChange={(e) => setSelectedStores(e.value)}
                  dataKey="code"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-store">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add store manager</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    Store name<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={addStoreName}
                    onChange={(e) => setAddStoreName(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    User name<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="input-blocks mb-3">
                  <label className="form-label">
                    Password<span className="text-danger ms-1">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={showPasswordAdd ? "text" : "password"}
                      className="form-control pass-input"
                      autoComplete="new-password"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                    />
                    <span
                      className={`fas toggle-password ${showPasswordAdd ? "fa-eye" : "fa-eye-slash"}`}
                      onClick={() => setShowPasswordAdd((v) => !v)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowPasswordAdd((v) => !v);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      aria-label={showPasswordAdd ? "Hide password" : "Show password"}
                    />
                  </div>
                  <p className="text-muted small mt-1 mb-0">At least 8 characters.</p>
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Optional"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Phone<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional"
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value)}
                  />
                </div>
                <div className="mb-0">
                  <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                    <span className="status-label">Status</span>
                    <input
                      type="checkbox"
                      id="sm-add-status"
                      className="check"
                      checked={addStatusActive}
                      onChange={(e) => setAddStatusActive(e.target.checked)}
                    />
                    <label htmlFor="sm-add-status" className="checktoggle" />
                  </div>
                </div>
                {addError ? (
                  <p className="text-danger small mt-2 mb-0">{addError}</p>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary fs-13 fw-medium p-2 px-3"
                  onClick={saveNewManager}>
                  Add store manager
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
              <div className="page-title">
                <h4>Edit store manager</h4>
                {editingCode ? (
                  <p className="text-muted small mb-0 mt-1">Code: {editingCode}</p>
                ) : null}
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    Store name<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    User name<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="input-blocks mb-3">
                  <label className="form-label">New password</label>
                  <div className="pass-group">
                    <input
                      type={showPasswordEdit ? "text" : "password"}
                      className="form-control pass-input"
                      autoComplete="new-password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                    <span
                      className={`fas toggle-password ${showPasswordEdit ? "fa-eye" : "fa-eye-slash"}`}
                      onClick={() => setShowPasswordEdit((v) => !v)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowPasswordEdit((v) => !v);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      aria-label={showPasswordEdit ? "Hide password" : "Show password"}
                    />
                  </div>
                  <p className="text-muted small mt-1 mb-0">
                    {token && editingManagerId != null
                      ? "Optional. At least 8 characters when changing."
                      : "Optional for local list only."}
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Optional"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Phone<span className="text-danger ms-1">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                  />
                </div>
                <div className="mb-0">
                  <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                    <span className="status-label">Status</span>
                    <input
                      type="checkbox"
                      id="sm-edit-status"
                      className="check"
                      checked={editStatusActive}
                      onChange={(e) => setEditStatusActive(e.target.checked)}
                    />
                    <label htmlFor="sm-edit-status" className="checktoggle" />
                  </div>
                </div>
                {editError ? (
                  <p className="text-danger small mt-2 mb-0">{editError}</p>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary fs-13 fw-medium p-2 px-3"
                  onClick={saveManagerEdits}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="view-store-manager">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Store manager details</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {viewRow ? (
                <dl className="row mb-0">
                  <dt className="col-sm-4 text-muted small">Code</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.code}</dd>
                  <dt className="col-sm-4 text-muted small">Store</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.store}</dd>
                  <dt className="col-sm-4 text-muted small">User name</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.username}</dd>
                  <dt className="col-sm-4 text-muted small">Phone</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.phone || "—"}</dd>
                  <dt className="col-sm-4 text-muted small">Email</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.email || "—"}</dd>
                  <dt className="col-sm-4 text-muted small">Location</dt>
                  <dd className="col-sm-8 mb-2">{viewRow.location || "—"}</dd>
                  <dt className="col-sm-4 text-muted small">Status</dt>
                  <dd className="col-sm-8 mb-0">{viewRow.status}</dd>
                </dl>
              ) : (
                <p className="text-muted mb-0">No store manager selected.</p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete-store-manager-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content p-5 px-3 text-center">
                <span className="rounded-circle d-inline-flex p-2 bg-danger-transparent mb-2">
                  <Trash2 size={28} strokeWidth={1.75} className="text-danger" aria-hidden />
                </span>
                <h4 className="mb-0 delete-account-font">Delete this store manager?</h4>
                {deleteCode ? (
                  <p className="text-muted small mt-2 mb-0">
                    {token && deleteManagerId != null ? (
                      <>
                        Record <strong>{deleteCode}</strong> will be removed from the database.
                      </>
                    ) : (
                      <>
                        Code <strong>{deleteCode}</strong> will be removed from this device&apos;s saved list.
                      </>
                    )}
                  </p>
                ) : null}
                <div className="modal-footer-btn mt-3 d-flex justify-content-center">
                  <button
                    type="button"
                    className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                    data-bs-dismiss="modal"
                    onClick={() => {
                      setDeleteCode(null);
                      setDeleteManagerId(null);
                    }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger fs-13 fw-medium p-2 px-3 text-white"
                    onClick={handleDeleteConfirm}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreList;
