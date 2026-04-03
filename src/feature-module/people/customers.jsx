import { Edit2, Eye, PlusCircle, Trash2 } from "react-feather";
import { customersData } from "../../core/json/customers-data";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import { downloadCustomersExcel, downloadCustomersPdf } from "../../utils/customerExport";
import { user33 } from "../../utils/imagepath";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CommonFooter from "../../components/footer/commonFooter";
import {
  createCustomerMultipartRequest,
  createCustomerRequest,
  deleteCustomerRequest,
  listCustomersRequest,
  updateCustomerMultipartRequest,
  updateCustomerRequest
} from "../../tillflow/api/customers";
import { TILLFLOW_API_BASE_URL } from "../../tillflow/config";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { Modal } from "bootstrap";

const ALL = { label: "All", value: "" };

const STORAGE_KEY = "retailpos_customers_v1";

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
  const onHidden = () => {
    cleanupStaleModalUi();
  };
  el.addEventListener("hidden.bs.modal", onHidden, { once: true });
  inst.hide();
  window.setTimeout(cleanupStaleModalUi, 450);
}

function loadStoredCustomers() {
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

function getInitialCustomerRows() {
  try {
    if (typeof window !== "undefined" && window.location.pathname.includes("/tillflow/admin")) {
      return [];
    }
  } catch {
    /* ignore */
  }
  const stored = loadStoredCustomers();
  if (stored) {
    return stored;
  }
  return customersData.map((c) => ({ ...c }));
}

function resolveCustomerAvatarUrl(avatarUrl) {
  if (!avatarUrl) {
    return user33;
  }
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  try {
    const origin = new URL(TILLFLOW_API_BASE_URL).origin;
    return avatarUrl.startsWith("/") ? `${origin}${avatarUrl}` : `${origin}/${avatarUrl}`;
  } catch {
    return avatarUrl;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function apiCustomerToRow(c) {
  return {
    id: c.id,
    code: c.code,
    customer: c.name,
    avatar: resolveCustomerAvatarUrl(c.avatar_url),
    email: c.email ?? "",
    phone: c.phone,
    location: c.location ?? "",
    status: c.status
  };
}

function nextCustomerCode(list) {
  let max = 0;
  for (const r of list) {
    const m = /^CU(\d+)$/i.exec(String(r.code ?? ""));
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `CU${String(max + 1).padStart(3, "0")}`;
}

function splitDisplayName(full) {
  const t = String(full ?? "").trim();
  if (!t) {
    return { first: "", last: "" };
  }
  const i = t.indexOf(" ");
  if (i === -1) {
    return { first: t, last: "" };
  }
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

const Customers = () => {
  const routeLocation = useLocation();
  const inTillflowShell = routeLocation.pathname.includes("/tillflow/admin");

  const auth = useOptionalAuth();
  const token = auth?.token ?? null;

  const [customers, setCustomers] = useState(getInitialCustomerRows);
  const [listLoading, setListLoading] = useState(() => Boolean(token));
  const [listError, setListError] = useState("");

  const loadCustomers = useCallback(async () => {
    if (!token) {
      return;
    }
    setListLoading(true);
    setListError("");
    try {
      const data = await listCustomersRequest(token);
      setCustomers((data.customers ?? []).map(apiCustomerToRow));
    } catch (e) {
      setCustomers([]);
      if (e instanceof TillFlowApiError) {
        setListError(
          e.status === 403 ? `${e.message} (needs sales.manage)` : e.message
        );
      } else {
        setListError("Failed to load customers.");
      }
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadCustomers();
  }, [token, loadCustomers]);

  useEffect(() => {
    if (inTillflowShell) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    } catch {
      /* ignore quota */
    }
  }, [customers, inTillflowShell]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addStatusActive, setAddStatusActive] = useState(true);
  const [addError, setAddError] = useState("");
  const addAvatarInputRef = useRef(null);
  const addAvatarBlobRef = useRef(null);
  const [addAvatarFile, setAddAvatarFile] = useState(null);
  const [addAvatarPreview, setAddAvatarPreview] = useState(user33);

  const [editingCode, setEditingCode] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatusActive, setEditStatusActive] = useState(true);
  const [editAvatar, setEditAvatar] = useState(user33);
  const [editError, setEditError] = useState("");
  const editAvatarInputRef = useRef(null);
  const editAvatarBlobRef = useRef(null);
  const [editAvatarFile, setEditAvatarFile] = useState(null);

  const [viewRow, setViewRow] = useState(null);
  const [deleteCode, setDeleteCode] = useState(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState(null);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...customers];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.customer).toLowerCase().includes(q) ||
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
  }, [customers, searchQuery, filterStatus, filterLocation]);

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
      loadCustomers();
    }
  }, [token, loadCustomers]);

  const handleExportPdf = useCallback(async () => {
    try {
      await downloadCustomersPdf(displayRows);
    } catch {
      setListError("Could not export PDF. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const handleExportExcel = useCallback(async () => {
    try {
      await downloadCustomersExcel(displayRows);
    } catch {
      setListError("Could not export Excel. Try again or check the browser download settings.");
    }
  }, [displayRows]);

  const resetAddForm = useCallback(() => {
    if (addAvatarBlobRef.current) {
      URL.revokeObjectURL(addAvatarBlobRef.current);
      addAvatarBlobRef.current = null;
    }
    if (addAvatarInputRef.current) {
      addAvatarInputRef.current.value = "";
    }
    setAddAvatarFile(null);
    setAddAvatarPreview(user33);
    setAddFirstName("");
    setAddLastName("");
    setAddEmail("");
    setAddPhone("");
    setAddLocation("");
    setAddStatusActive(true);
    setAddError("");
  }, []);

  const openAddModal = useCallback(() => {
    resetAddForm();
  }, [resetAddForm]);

  const onAddAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAddError("Please choose an image file.");
      return;
    }
    if (addAvatarBlobRef.current) {
      URL.revokeObjectURL(addAvatarBlobRef.current);
      addAvatarBlobRef.current = null;
    }
    const url = URL.createObjectURL(file);
    addAvatarBlobRef.current = url;
    setAddAvatarPreview(url);
    setAddAvatarFile(file);
    setAddError("");
  };

  const openEditCustomer = useCallback((row) => {
    if (editAvatarBlobRef.current) {
      URL.revokeObjectURL(editAvatarBlobRef.current);
      editAvatarBlobRef.current = null;
    }
    if (editAvatarInputRef.current) {
      editAvatarInputRef.current.value = "";
    }
    setEditAvatarFile(null);
    setEditingCode(row.code);
    setEditingCustomerId(row.id ?? null);
    const { first, last } = splitDisplayName(row.customer);
    setEditFirstName(first);
    setEditLastName(last);
    setEditEmail(row.email ?? "");
    setEditPhone(row.phone);
    setEditLocation(row.location ?? "");
    setEditStatusActive(row.status === "Active");
    setEditAvatar(row.avatar ?? user33);
    setEditError("");
  }, []);

  const onEditAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setEditError("Please choose an image file.");
      return;
    }
    if (editAvatarBlobRef.current) {
      URL.revokeObjectURL(editAvatarBlobRef.current);
      editAvatarBlobRef.current = null;
    }
    const url = URL.createObjectURL(file);
    editAvatarBlobRef.current = url;
    setEditAvatar(url);
    setEditAvatarFile(file);
    setEditError("");
  };

  const openViewCustomer = useCallback((row) => {
    setViewRow(row);
  }, []);

  const openDeleteCustomer = useCallback((row) => {
    setDeleteCode(row.code);
    setDeleteCustomerId(row.id ?? null);
  }, []);

  const saveNewCustomer = useCallback(async () => {
    setAddError("");
    const fn = addFirstName.trim();
    const ln = addLastName.trim();
    const em = addEmail.trim();
    const ph = addPhone.trim();
    const loc = addLocation.trim();
    if (!fn || !ln || !ph) {
      setAddError("Please fill in first name, last name, and phone.");
      return;
    }
    if (em && !isValidEmail(em)) {
      setAddError("Enter a valid email address.");
      return;
    }
    if (
      em &&
      customers.some((c) => String(c.email ?? "").toLowerCase() === em.toLowerCase())
    ) {
      setAddError("A customer with this email already exists.");
      return;
    }
    if (customers.some((c) => String(c.phone ?? "").trim() === ph)) {
      setAddError("A customer with this phone number already exists.");
      return;
    }
    const name = `${fn} ${ln}`.trim();
    const status = addStatusActive ? "Active" : "Inactive";

    if (token) {
      try {
        let data;
        if (addAvatarFile) {
          data = await createCustomerMultipartRequest(
            token,
            {
              name,
              email: em || null,
              phone: ph,
              location: loc || null,
              status
            },
            addAvatarFile
          );
        } else {
          data = await createCustomerRequest(token, {
            name,
            email: em || null,
            phone: ph,
            location: loc || null,
            status,
            avatar_url: null
          });
        }
        const row = apiCustomerToRow(data.customer);
        setCustomers((prev) => [...prev, row]);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setAddError(e.message);
        } else {
          setAddError("Could not create customer.");
        }
        return;
      }
    } else {
      let avatarValue = user33;
      if (addAvatarFile) {
        try {
          avatarValue = await readFileAsDataUrl(addAvatarFile);
        } catch {
          setAddError("Could not read the image file.");
          return;
        }
      }
      setCustomers((prev) => {
        if (em && prev.some((c) => String(c.email ?? "").toLowerCase() === em.toLowerCase())) {
          return prev;
        }
        if (prev.some((c) => String(c.phone ?? "").trim() === ph)) {
          return prev;
        }
        const code = nextCustomerCode(prev);
        const row = {
          code,
          customer: name,
          avatar: avatarValue,
          email: em,
          phone: ph,
          location: loc,
          status
        };
        return [...prev, row];
      });
    }

    resetAddForm();
    hideBsModal("add-customer");
  }, [
    addFirstName,
    addLastName,
    addEmail,
    addPhone,
    addLocation,
    addStatusActive,
    addAvatarFile,
    customers,
    resetAddForm,
    token
  ]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    saveNewCustomer();
  };

  const saveCustomerEdits = useCallback(async () => {
    setEditError("");
    if (!editingCode) {
      return;
    }
    const fn = editFirstName.trim();
    const ln = editLastName.trim();
    const em = editEmail.trim();
    const ph = editPhone.trim();
    const loc = editLocation.trim();
    if (!fn || !ln || !ph) {
      setEditError("Please fill in first name, last name, and phone.");
      return;
    }
    if (em && !isValidEmail(em)) {
      setEditError("Enter a valid email address.");
      return;
    }
    const emailDup =
      em &&
      customers.some(
        (c) =>
          c.code !== editingCode &&
          String(c.email ?? "").toLowerCase() === em.toLowerCase()
      );
    if (emailDup) {
      setEditError("Another customer already uses this email.");
      return;
    }
    const phoneDup = customers.some(
      (c) => c.code !== editingCode && String(c.phone ?? "").trim() === ph
    );
    if (phoneDup) {
      setEditError("Another customer already uses this phone number.");
      return;
    }
    const customerName = `${fn} ${ln}`.trim();
    const status = editStatusActive ? "Active" : "Inactive";

    if (token && editingCustomerId != null) {
      try {
        let data;
        if (editAvatarFile) {
          data = await updateCustomerMultipartRequest(
            token,
            editingCustomerId,
            {
              name: customerName,
              email: em || null,
              phone: ph,
              location: loc || null,
              status
            },
            editAvatarFile
          );
        } else {
          data = await updateCustomerRequest(token, editingCustomerId, {
            name: customerName,
            email: em || null,
            phone: ph,
            location: loc || null,
            status
          });
        }
        const row = apiCustomerToRow(data.customer);
        setCustomers((prev) => prev.map((c) => (c.code === editingCode ? row : c)));
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setEditError(e.message);
        } else {
          setEditError("Could not save changes.");
        }
        return;
      }
    } else {
      let nextAvatar = editAvatar;
      if (editAvatarFile) {
        try {
          nextAvatar = await readFileAsDataUrl(editAvatarFile);
        } catch {
          setEditError("Could not read the image file.");
          return;
        }
      }
      setCustomers((prev) =>
        prev.map((c) =>
          c.code === editingCode
            ? {
                ...c,
                customer: customerName,
                email: em,
                phone: ph,
                location: loc,
                status,
                avatar: nextAvatar
              }
            : c
        )
      );
    }

    if (editAvatarBlobRef.current) {
      URL.revokeObjectURL(editAvatarBlobRef.current);
      editAvatarBlobRef.current = null;
    }
    setEditAvatarFile(null);
    if (editAvatarInputRef.current) {
      editAvatarInputRef.current.value = "";
    }
    setEditingCode(null);
    setEditingCustomerId(null);
    hideBsModal("edit-customer");
  }, [
    editingCode,
    editingCustomerId,
    editFirstName,
    editLastName,
    editEmail,
    editPhone,
    editLocation,
    editStatusActive,
    editAvatar,
    editAvatarFile,
    customers,
    token
  ]);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    saveCustomerEdits();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCode) {
      return;
    }
    if (token && deleteCustomerId != null) {
      try {
        await deleteCustomerRequest(token, deleteCustomerId);
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          setListError(e.message);
        } else {
          setListError("Could not delete customer.");
        }
        return;
      }
    }
    setCustomers((prev) => prev.filter((c) => c.code !== deleteCode));
    setSelectedCustomers((sel) => sel.filter((c) => c.code !== deleteCode));
    setDeleteCode(null);
    setDeleteCustomerId(null);
    hideBsModal("delete-customer-modal");
  };

  const columns = useMemo(
    () => [
      { header: "Code", field: "code", sortable: true },
      {
        header: "Customer",
        field: "customer",
        sortable: true,
        body: (row) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={row.avatar} alt="" />
            </Link>
            <Link to="#">{row.customer}</Link>
          </div>
        )
      },
      { header: "Phone", field: "phone", sortable: true },
      {
        header: "Email",
        field: "email",
        sortable: true,
        body: (row) => (row.email ? row.email : "—")
      },
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
              data-bs-target="#view-customer"
              onClick={(e) => {
                e.preventDefault();
                openViewCustomer(row);
              }}>
              <Eye size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#edit-customer"
              onClick={(e) => {
                e.preventDefault();
                openEditCustomer(row);
              }}>
              <Edit2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              className="p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-customer-modal"
              onClick={(e) => {
                e.preventDefault();
                openDeleteCustomer(row);
              }}>
              <Trash2 size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        )
      }
    ],
    [openDeleteCustomer, openEditCustomer, openViewCustomer]
  );

  return (
    <>
      <div
        className={`page-wrapper customers-page${
          inTillflowShell ? " customers-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4 className="fw-bold">Customers</h4>
                <h6>Directory of retail customers — search, filter by location or status.</h6>
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
                data-bs-target="#add-customer"
                onClick={(e) => {
                  e.preventDefault();
                  openAddModal();
                }}>
                <PlusCircle size={18} strokeWidth={1.75} className="me-1" aria-hidden />
                Add customer
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
                  selection={selectedCustomers}
                  onSelectionChange={(e) => setSelectedCustomers(e.value)}
                  dataKey="code"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <div className="modal fade" id="add-customer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add customer</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form noValidate onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="new-employee-field">
                  <div className="profile-pic-upload">
                    <div className="profile-pic p-2" style={{ minHeight: 120 }}>
                      <img
                        src={addAvatarPreview}
                        alt=""
                        className="object-fit-cover h-100 w-100 rounded-1"
                        style={{ maxHeight: 140 }}
                      />
                    </div>
                    <div className="mb-3">
                      <div className="image-upload mb-0">
                        <input
                          ref={addAvatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={onAddAvatarSelected}
                        />
                        <div className="image-uploads">
                          <h4>Upload image</h4>
                        </div>
                      </div>
                      <p className="mt-2 text-muted small">JPG, PNG, GIF or WebP — max 2 MB. Optional.</p>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      First name<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={addFirstName}
                      onChange={(e) => setAddFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">
                      Last name<span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={addLastName}
                      onChange={(e) => setAddLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                  <div className="col-lg-12 mb-3">
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
                  <div className="col-lg-12 mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-lg-12 mb-3">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={addLocation}
                      onChange={(e) => setAddLocation(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-12">
                    <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                      <span className="status-label">Status</span>
                      <input
                        type="checkbox"
                        id="cust-add-status"
                        className="check"
                        checked={addStatusActive}
                        onChange={(e) => setAddStatusActive(e.target.checked)}
                      />
                      <label htmlFor="cust-add-status" className="checktoggle">
                        {" "}
                      </label>
                    </div>
                  </div>
                  {addError ? (
                    <div className="col-12 mt-2">
                      <p className="text-danger small mb-0">{addError}</p>
                    </div>
                  ) : null}
                </div>
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
                  onClick={saveNewCustomer}>
                  Add customer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit-customer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content">
                <div className="modal-header">
                  <div className="page-title">
                    <h4>Edit customer</h4>
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
                    <div className="new-employee-field">
                      <div className="profile-pic-upload image-field">
                        <div className="profile-pic p-2">
                          <img
                            src={editAvatar}
                            className="object-fit-cover h-100 rounded-1"
                            alt=""
                          />
                        </div>
                        <div className="mb-3">
                          <div className="image-upload mb-0">
                            <input
                              ref={editAvatarInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              onChange={onEditAvatarSelected}
                            />
                            <div className="image-uploads">
                              <h4>Change image</h4>
                            </div>
                          </div>
                          <p className="mt-2 text-muted small">JPG, PNG, GIF or WebP — max 2 MB.</p>
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">
                          First name<span className="text-danger ms-1">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="col-lg-6 mb-3">
                        <label className="form-label">
                          Last name<span className="text-danger ms-1">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                      <div className="col-lg-12 mb-3">
                        <label className="form-label">
                          Phone<span className="text-danger ms-1">*</span>
                        </label>
                        <input
                          type="tel"
                          className="form-control"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          autoComplete="tel"
                        />
                      </div>
                      <div className="col-lg-12 mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          autoComplete="email"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-lg-12 mb-3">
                        <label className="form-label">Location</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                        />
                      </div>
                      <div className="col-lg-12">
                        <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                          <span className="status-label">Status</span>
                          <input
                            type="checkbox"
                            id="cust-edit-status"
                            className="check"
                            checked={editStatusActive}
                            onChange={(e) => setEditStatusActive(e.target.checked)}
                          />
                          <label htmlFor="cust-edit-status" className="checktoggle">
                            {" "}
                          </label>
                        </div>
                      </div>
                      {editError ? (
                        <div className="col-12 mt-2">
                          <p className="text-danger small mb-0">{editError}</p>
                        </div>
                      ) : null}
                    </div>
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
                      onClick={saveCustomerEdits}>
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="view-customer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Customer details</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {viewRow ? (
                <div className="d-flex gap-3 flex-column flex-sm-row align-items-start">
                  <div className="avatar avatar-xl flex-shrink-0">
                    <img src={viewRow.avatar} className="rounded-2" alt="" />
                  </div>
                  <dl className="row mb-0 flex-grow-1">
                    <dt className="col-sm-4 text-muted small">Code</dt>
                    <dd className="col-sm-8 mb-2">{viewRow.code}</dd>
                    <dt className="col-sm-4 text-muted small">Name</dt>
                    <dd className="col-sm-8 mb-2">{viewRow.customer}</dd>
                    <dt className="col-sm-4 text-muted small">Phone</dt>
                    <dd className="col-sm-8 mb-2">{viewRow.phone || "—"}</dd>
                    <dt className="col-sm-4 text-muted small">Email</dt>
                    <dd className="col-sm-8 mb-2">{viewRow.email || "—"}</dd>
                    <dt className="col-sm-4 text-muted small">Location</dt>
                    <dd className="col-sm-8 mb-2">{viewRow.location || "—"}</dd>
                    <dt className="col-sm-4 text-muted small">Status</dt>
                    <dd className="col-sm-8 mb-0">{viewRow.status}</dd>
                  </dl>
                </div>
              ) : (
                <p className="text-muted mb-0">No customer selected.</p>
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

      <div className="modal fade" id="delete-customer-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content p-5 px-3 text-center">
                <span className="rounded-circle d-inline-flex p-2 bg-danger-transparent mb-2">
                  <Trash2 size={28} strokeWidth={1.75} className="text-danger" aria-hidden />
                </span>
                <h4 className="mb-0 delete-account-font">Delete this customer?</h4>
                {deleteCode ? (
                  <p className="text-muted small mt-2 mb-0">
                    {token && deleteCustomerId != null ? (
                      <>
                        Customer <strong>{deleteCode}</strong> will be removed from the database.
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
                      setDeleteCustomerId(null);
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

export default Customers;
