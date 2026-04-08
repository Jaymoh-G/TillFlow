import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CommonFooter from "../../components/footer/commonFooter";
import { purchasesreturn } from "../../core/json/purchasereturn";
import PrimeDataTable from "../../components/data-table";
import TableTopHead from "../../components/table-top-head";
import SearchFromApi from "../../components/data-table/search";
import DeleteModal from "../../components/delete-modal";
import { stockImg01 } from "../../utils/imagepath";
import CommonSelect from "../../components/select/common-select";
import CommonDatePicker from "../../components/date-picker/common-date-picker";
import { Editor } from "primereact/editor";
import { downloadPurchasesExcel, downloadPurchasesPdf } from "../../utils/purchaseExport";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { TillFlowApiError } from "../../tillflow/api/errors";
import { listSuppliersRequest } from "../../tillflow/api/suppliers";
import {
  createPurchaseReturnRequest,
  deletePurchaseReturnRequest,
  listPurchaseReturnsRequest,
  updatePurchaseReturnRequest
} from "../../tillflow/api/purchaseReturns";
import { getPurchaseRequest, listPurchasesRequest } from "../../tillflow/api/purchases";

function normalizePaymentStatus(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "paid" || raw === "refunded") return "Refunded";
  return "Unrefunded";
}

function toInputDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatKes(value) {
  const n = parseFloat(String(value ?? "0"), 10);
  return `KES ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function nextPurchaseReturnRefLocal(list) {
  let max = 0;
  for (const row of list) {
    const m = /^RT(\d+)$/i.exec(String(row?.reference ?? ""));
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `RT${String(max + 1).padStart(3, "0")}`;
}

const PurchaseReturns = () => {
  const location = useLocation();
  const auth = useOptionalAuth();
  const token = auth?.token ?? (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("tillflow_sanctum_token") : null);
  const [dataSource, setDataSource] = useState(purchasesreturn);
  const [listError, setListError] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOptions, setPurchaseOptions] = useState([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [returnLines, setReturnLines] = useState([]);
  const [sourcePurchasePaidAmount, setSourcePurchasePaidAmount] = useState(0);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingRowId, setEditingRowId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFilter, setPaymentFilter] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formRefunded, setFormRefunded] = useState("0");
  const [formDue, setFormDue] = useState("0");
  const [date, setDate] = useState(new Date());
  const [text, setText] = useState("");
  const [selectedReturns, setSelectedReturns] = useState([]);
  const [viewReturnRow, setViewReturnRow] = useState(null);

  const mapApiRow = useCallback((row) => ({
    id: String(row.id),
    img: stockImg01,
    date: row.return_date || "",
    supplier: row.supplier_name || "—",
    supplierId: row.supplier_id != null ? String(row.supplier_id) : "",
    purchaseId: row.purchase_id != null ? String(row.purchase_id) : "",
    reference: row.reference || "",
    status: row.status || "Pending",
    grandTotal: String(row.grand_total ?? "0"),
    paid: String(row.paid_amount ?? "0"),
    due: String(row.due_amount ?? "0"),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    description: row.description || ""
  }), []);

  const loadPurchaseReturns = useCallback(async () => {
    if (!token) {
      setDataSource(purchasesreturn);
      setListError("");
      return;
    }
    try {
      setListError("");
      const data = await listPurchaseReturnsRequest(token);
      const rows = Array.isArray(data.purchase_returns)
        ? data.purchase_returns.map(mapApiRow)
        : [];
      setDataSource(rows);
    } catch (err) {
      setListError(err instanceof TillFlowApiError ? err.message : "Could not load purchase returns.");
    }
  }, [mapApiRow, token]);

  const loadSuppliers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listSuppliersRequest(token);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch {
      setSuppliers([]);
    }
  }, [token]);

  const loadPurchases = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listPurchasesRequest(token);
      const rows = Array.isArray(data.purchases) ? data.purchases : [];
      setPurchaseOptions(
        rows.map((row) => ({
          label: `${row.reference || `Purchase #${row.id}`} - ${row.supplier_name || "Supplier"}`,
          value: String(row.id)
        }))
      );
    } catch {
      setPurchaseOptions([]);
    }
  }, [token]);

  useEffect(() => {
    void loadPurchaseReturns();
    void loadSuppliers();
    void loadPurchases();
  }, [loadPurchaseReturns, loadSuppliers, loadPurchases]);

  const loadPurchaseLines = useCallback(async (purchaseId) => {
    if (!token || !purchaseId) {
      setReturnLines([]);
      setSourcePurchasePaidAmount(0);
      return;
    }
    try {
      const data = await getPurchaseRequest(token, purchaseId);
      const purchase = data?.purchase ?? data;
      const lines = Array.isArray(purchase?.lines) ? purchase.lines : [];
      setReturnLines(
        lines.map((line) => ({
          lineId: String(line.id),
          productName: line.product_name || "—",
          receivedQty: Number(line.received_qty || 0),
          unitRefund: Number(line.qty || 0) > 0 ? Number(line.line_total || 0) / Number(line.qty || 1) : 0,
          qtyReturned: Number(line.received_qty || 0)
        }))
      );
      const paid = Number(purchase?.paid_amount || 0);
      setSourcePurchasePaidAmount(paid);
      setFormRefunded(paid.toFixed(2));
      if (purchase?.supplier_id != null) {
        setSelectedSupplier(String(purchase.supplier_id));
      }
    } catch {
      setReturnLines([]);
      setSourcePurchasePaidAmount(0);
      setFormRefunded("0");
    }
  }, [token]);

  const filteredRows = useMemo(() => {
    let out = dataSource;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        [r.supplier, r.reference, r.status, r.paymentStatus, r.date]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (paymentFilter) {
      out = out.filter((r) => normalizePaymentStatus(r.paymentStatus) === paymentFilter);
    }
    return out;
  }, [dataSource, paymentFilter, searchQuery]);

  const exportRows = useMemo(
    () =>
      filteredRows.map((r) => ({
        supplierName: r.supplier,
        reference: r.reference,
        date: r.date,
        purchaseType: "Return",
        status: r.status,
        total: formatKes(r.grandTotal),
        paid: formatKes(r.paid),
        due: formatKes(r.due),
        orderedQty: "",
        remainingQty: "",
        paymentStatus: normalizePaymentStatus(r.paymentStatus)
      })),
    [filteredRows]
  );

  const columns = [
 
  {
    header: "Product Image",
    field: "img",
    body: (text) =>
    <Link to="#" className="avatar avatar-md me-2">
          <img src={text?.img} alt="product" />
        </Link>

  },
  {
    header: "Date",
    field: "date"
  },

  {
    header: "Supplier Name",
    field: "supplier"
  },
  {
    header: "Reference",
    field: "reference"
  },

  {
    header: "Status",
    field: "status",
    body: (text) =>
    <span
      className={`badges status-badge fs-10 p-1 px-2 rounded-1 ${
      text?.status === "Pending" ?
      "badge-pending" :
      text?.status === "Received" || text?.status === "Returned" ?
      "text-success bg-success-transparent" :
      ""}`
      }>
      
          {text?.status}
        </span>

  },
  {
    header: "Total",
    field: "grandTotal",
    body: (row) => formatKes(row?.grandTotal)
  },
  {
    header: "Refunded",
    field: "paid",
    body: (row) => formatKes(row?.paid)
  },
  {
    header: "Due",
    field: "due",
    body: (row) => formatKes(row?.due)
  },
  {
    header: "Payment Status",
    field: "paymentStatus",
    body: (text) =>
    <span
      className={`p-1 pe-2 rounded-1  fs-10 ${
      text?.paymentStatus === "Refunded" ?
      "text-success bg-success-transparent" :
      "text-danger bg-danger-transparent "}`
      }>
      
          <i className="ti ti-point-filled me-1 fs-11"> </i>{" "}
          {normalizePaymentStatus(text?.paymentStatus)}
        </span>

  },

  {
    header: "Actions",
    field: "actions",
    key: "actions",
    body: (row) =>
    <div className="action-table-data">
          <div className="edit-delete-action">
            <Link
              to="#"
              className="me-2 p-2"
              data-bs-toggle="modal"
              data-bs-target="#view-return-details"
              onClick={() => {
                setViewReturnRow(row);
              }}>
              <i className="feather icon-eye" />
            </Link>
            <Link
          to="#"
          className="me-2 p-2"
          data-bs-toggle="modal"
          data-bs-target="#edit-sales-new"
          onClick={() => {
            setEditingRowId(String(row.id));
            setSelectedSupplier(String(row.supplierId ?? ""));
            setSelectedPurchaseId(String(row.purchaseId ?? ""));
            if (row.purchaseId) {
              void loadPurchaseLines(String(row.purchaseId));
            } else {
              setReturnLines([]);
            }
            setDate(row.date ? new Date(row.date) : new Date());
            setFormReference(row.reference ?? "");
            setFormRefunded(String(row.paid ?? "0"));
            setFormDue(String(row.due ?? "0"));
            setText(row.description ?? "");
            setFormError("");
          }}
          >
          
              <i className="ti ti-edit" />
            </Link>
            <Link
          data-bs-toggle="modal"
          data-bs-target="#delete-modal"
          className="p-2"
          to="#"
          onClick={() => {
            setDeleteId(String(row.id));
          }}>
          
              <i className="ti ti-trash" />
            </Link>
          </div>
        </div>

  }];

  const handleSearch = (value) => {
    setSearchQuery(typeof value === "string" ? value : "");
    setCurrentPage(1);
  };

  const hideModalById = useCallback((modalId) => {
    if (typeof window === "undefined" || !window.bootstrap?.Modal) return;
    const el = document.getElementById(modalId);
    if (!el) return;
    const inst = window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
    inst.hide();
  }, []);

  const resetFormState = useCallback(() => {
    setEditingRowId("");
    setSelectedPurchaseId("");
    setReturnLines([]);
    setSourcePurchasePaidAmount(0);
    setSelectedSupplier("");
    setDate(new Date());
    setFormReference(nextPurchaseReturnRefLocal(dataSource));
    setFormRefunded("0");
    setFormDue("0");
    setText("");
    setFormError("");
  }, [dataSource]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search || "");
    const purchaseId = String(qs.get("purchaseId") || "").trim();
    if (!purchaseId) return;
    resetFormState();
    setSelectedPurchaseId(purchaseId);
    void loadPurchaseLines(purchaseId);
    if (typeof window !== "undefined" && window.bootstrap?.Modal) {
      const el = document.getElementById("add-sales-new");
      if (el) {
        const inst = window.bootstrap.Modal.getInstance(el) ?? new window.bootstrap.Modal(el);
        inst.show();
      }
    }
  }, [loadPurchaseLines, location.search, resetFormState]);

  const handleCreateSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!token) return;
    setFormBusy(true);
    setFormError("");
    try {
      const payloadLines = returnLines
        .map((line) => ({
          line_id: Number(line.lineId),
          qty_returned: Number(line.qtyReturned || 0)
        }))
        .filter((line) => line.qty_returned > 0);
      const payload = {
        supplier_id: Number(selectedSupplier),
        purchase_id: selectedPurchaseId ? Number(selectedPurchaseId) : null,
        reference: formReference.trim(),
        return_date: toInputDate(date) || new Date().toISOString().slice(0, 10),
        status: "Returned",
        grand_total: 0,
        paid_amount: Number(formRefunded || 0),
        due_amount: Number(formDue || 0),
        refund_amount: Number(formRefunded || 0),
        payment_status: "Refunded",
        description: text ? String(text).replace(/<[^>]*>/g, " ").trim() : null,
        lines: payloadLines
      };
      if (
        selectedPurchaseId &&
        Math.abs(Number(formRefunded || 0) - Number(sourcePurchasePaidAmount || 0)) > 0.0001
      ) {
        setFormError("Money refunded must be exactly equal to the paid amount.");
        setFormBusy(false);
        return;
      }
      await createPurchaseReturnRequest(token, payload);
      await loadPurchaseReturns();
      resetFormState();
      hideModalById("add-sales-new");
    } catch (err) {
      setFormError(err instanceof TillFlowApiError ? err.message : "Could not create purchase return.");
    } finally {
      setFormBusy(false);
    }
  }, [date, formDue, formRefunded, formReference, hideModalById, loadPurchaseReturns, resetFormState, returnLines, selectedPurchaseId, selectedSupplier, sourcePurchasePaidAmount, text, token]);

  const handleUpdateSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!token || !editingRowId) return;
    setFormBusy(true);
    setFormError("");
    try {
      const payloadLines = returnLines
        .map((line) => ({
          line_id: Number(line.lineId),
          qty_returned: Number(line.qtyReturned || 0)
        }))
        .filter((line) => line.qty_returned > 0);
      const payload = {
        supplier_id: Number(selectedSupplier),
        purchase_id: selectedPurchaseId ? Number(selectedPurchaseId) : null,
        reference: formReference.trim(),
        return_date: toInputDate(date) || new Date().toISOString().slice(0, 10),
        status: "Returned",
        grand_total: 0,
        paid_amount: Number(formRefunded || 0),
        due_amount: Number(formDue || 0),
        refund_amount: Number(formRefunded || 0),
        payment_status: "Refunded",
        description: text ? String(text).replace(/<[^>]*>/g, " ").trim() : null,
        lines: payloadLines
      };
      if (
        selectedPurchaseId &&
        Math.abs(Number(formRefunded || 0) - Number(sourcePurchasePaidAmount || 0)) > 0.0001
      ) {
        setFormError("Money refunded must be exactly equal to the paid amount.");
        setFormBusy(false);
        return;
      }
      await updatePurchaseReturnRequest(token, editingRowId, payload);
      await loadPurchaseReturns();
      hideModalById("edit-sales-new");
    } catch (err) {
      setFormError(err instanceof TillFlowApiError ? err.message : "Could not update purchase return.");
    } finally {
      setFormBusy(false);
    }
  }, [date, editingRowId, formDue, formRefunded, formReference, hideModalById, loadPurchaseReturns, returnLines, selectedPurchaseId, selectedSupplier, sourcePurchasePaidAmount, text, token]);

  useEffect(() => {
    setFormDue(Number(sourcePurchasePaidAmount || 0).toFixed(2));
  }, [sourcePurchasePaidAmount]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteId) return;
    try {
      await deletePurchaseReturnRequest(token, deleteId);
      setDeleteId("");
      await loadPurchaseReturns();
    } catch (err) {
      setListError(err instanceof TillFlowApiError ? err.message : "Could not delete purchase return.");
    }
  }, [deleteId, loadPurchaseReturns, token]);

  const handleExportPdf = useCallback(async () => {
    await downloadPurchasesPdf(exportRows);
  }, [exportRows]);

  const handleExportExcel = useCallback(async () => {
    await downloadPurchasesExcel(exportRows);
  }, [exportRows]);

  const supplierOptions = useMemo(() => {
    const apiOptions = suppliers.map((s) => ({
      label: String(s.name ?? "").trim() || `Supplier #${s.id}`,
      value: String(s.id)
    }));
    if (token) {
      return [{ label: "Select", value: "" }, ...apiOptions];
    }
    return [
      { label: "Select", value: "" },
      { label: "Electro Mart", value: "Electro Mart" },
      { label: "Quantum Gadgets", value: "Quantum Gadgets" },
      { label: "Prime Bazaar", value: "Prime Bazaar" },
      { label: "Modern Automobile", value: "Modern Automobile" },
      { label: "AIM Infotech", value: "AIM Infotech" }
    ];
  }, [suppliers, token]);


  return (
    <div>
      <div className="page-wrapper purchase-returns-page">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Purchase Return List</h4>
                <h6>Manage your purchase return</h6>
              </div>
            </div>
            <TableTopHead
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
              onRefresh={token ? () => void loadPurchaseReturns() : undefined}
            />
          </div>
          {listError ? <p className="text-danger small mb-2">{listError}</p> : null}
          {/* /product list */}
          <div className="card table-list-card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={handleSearch}
                rows={rows}
                setRows={setRows} />
              
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    {paymentFilter ? `Payment: ${paymentFilter}` : "Payment"}
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${paymentFilter === "" ? " active" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setPaymentFilter("");
                          setCurrentPage(1);
                        }}>
                        All
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${paymentFilter === "Refunded" ? " active" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setPaymentFilter("Refunded");
                          setCurrentPage(1);
                        }}>
                        Refunded
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${paymentFilter === "Unrefunded" ? " active" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setPaymentFilter("Unrefunded");
                          setCurrentPage(1);
                        }}>
                        Unrefunded
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Sort By : Last 7 Days
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Desending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last Month
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last 7 Days
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={filteredRows}
                  totalRecords={filteredRows.length}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  selectionMode="checkbox"
                  selection={selectedReturns}
                  onSelectionChange={(e) => setSelectedReturns(e.value)}
                  dataKey="id" />
                
              </div>
            </div>
          </div>
          {/* /product list */}
        </div>
        <CommonFooter />
      </div>
      {/*add popup */}
      <div className="modal fade" id="add-sales-new">
        <div className="modal-dialog add-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4> Add Purchase Return</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">Supplier Name<span className="text-danger ms-1">*</span></label>
                      <CommonSelect
                        filter={false}
                        className="w-100"
                        options={supplierOptions}
                        value={selectedSupplier}
                        onChange={(opt) => setSelectedSupplier(opt.value)}
                        placeholder="Select Supplier"
                      />
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">Date<span className="text-danger ms-1">*</span></label>
                      <div className="input-groupicon calender-input">
                        <i className="info-img feather icon-calendar" />
                        <CommonDatePicker appendTo={"self"} value={date} onChange={setDate} className="w-100" />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">Reference<span className="text-danger ms-1">*</span></label>
                      <input type="text" className="form-control" value={formReference} readOnly />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Source Purchase (for stock and refund logic)</label>
                      <CommonSelect
                        filter={false}
                        className="w-100"
                        options={[{ label: "Select", value: "" }, ...purchaseOptions]}
                        value={selectedPurchaseId}
                        onChange={(opt) => {
                          const id = String(opt.value ?? "");
                          setSelectedPurchaseId(id);
                          void loadPurchaseLines(id);
                        }}
                        placeholder="Select Purchase"
                      />
                    </div>
                  </div>
                  {returnLines.length > 0 ? (
                    <div className="col-12">
                      <div className="table-responsive mb-2">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Received Qty</th>
                              <th>Money Paid (KES)</th>
                              <th>Money Refunded (KES)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{returnLines.map((l) => l.productName).join(", ")}</td>
                              <td>
                                {returnLines
                                  .reduce((sum, line) => sum + Number(line.receivedQty || 0), 0)
                                  .toFixed(2)}
                              </td>
                              <td>{Number(sourcePurchasePaidAmount || 0).toFixed(2)}</td>
                              <td>{Number(formRefunded || 0).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                  <div className="col-lg-3 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">Money Refunded (KES)</label>
                      <input type="number" className="form-control" value={formRefunded} onChange={(e) => setFormRefunded(e.target.value)} />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3 summer-description-box">
                      <label className="form-label">Description</label>
                      <Editor value={text} onTextChange={(e) => setText(e.htmlValue)} style={{ height: "120px" }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {formError ? <p className="text-danger small mb-0 me-auto">{formError}</p> : null}
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal">
                  
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formBusy}>
                  {formBusy ? "Saving..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /add popup */}
      {/* Add Supplier */}
      <div className="modal fade" id="add_customer">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add Supplier</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit}>
              <div className="modal-body">
                <div>
                  <label className="form-label">
                    Supplier<span className="text-danger">*</span>
                  </label>
                  <input type="text" className="form-control" />
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
                  type="submit"
                  className="btn btn-primary fs-13 fw-medium p-2 px-3">
                  
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Supplier */}
      {/*Edit popup */}
      <div className="modal fade" id="edit-sales-new">
        <div className="modal-dialog add-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Edit Purchase Return</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form action="purchase-returns.html">
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Supplier Name<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="row">
                        <div className="col-lg-10 col-sm-10 col-10">
                          <CommonSelect
                            filter={false}
                            className="w-100"
                            options={supplierOptions}
                            value={selectedSupplier}
                            onChange={(opt) => setSelectedSupplier(opt.value)}
                            placeholder="Select Supplier" />
                          
                        </div>
                        <div className="col-lg-2 col-sm-2 col-2 ps-0">
                          <div className="add-icon">
                            <Link
                              to="#"
                              className="choose-add"
                              data-bs-toggle="modal"
                              data-bs-target="#add_customer">
                              
                              <i className="plus feather icon-plus-circle" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Date<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="input-groupicon calender-input">
                        <i className="info-img feather icon-calendar" />
                        <CommonDatePicker
                          appendTo={"self"}
                          value={date}
                          onChange={setDate}
                          className="w-100" />
                        
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Reference<span className="text-danger ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formReference}
                        readOnly
                      />
                      
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Source Purchase (for stock and refund logic)</label>
                      <CommonSelect
                        filter={false}
                        className="w-100"
                        options={[{ label: "Select", value: "" }, ...purchaseOptions]}
                        value={selectedPurchaseId}
                        onChange={(opt) => {
                          const id = String(opt.value ?? "");
                          setSelectedPurchaseId(id);
                          void loadPurchaseLines(id);
                        }}
                        placeholder="Select Purchase"
                      />
                    </div>
                  </div>
                  {returnLines.length > 0 ? (
                    <div className="col-12">
                      <div className="table-responsive mb-2">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Received Qty</th>
                              <th>Money Paid (KES)</th>
                              <th>Money Refunded (KES)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{returnLines.map((l) => l.productName).join(", ")}</td>
                              <td>
                                {returnLines
                                  .reduce((sum, line) => sum + Number(line.receivedQty || 0), 0)
                                  .toFixed(2)}
                              </td>
                              <td>{Number(sourcePurchasePaidAmount || 0).toFixed(2)}</td>
                              <td>{Number(formRefunded || 0).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="row">
                  <div className="col-lg-3 col-sm-6 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Money Refunded<span className="text-danger ms-1">*</span>
                      </label>
                      <div className="input-groupicon select-code">
                        <input
                          type="number"
                          value={formRefunded}
                          onChange={(e) => setFormRefunded(e.target.value)}
                          className="form-control p-2" />
                        
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="summer-description-box">
                      <label className="form-label">Description</label>
                      <Editor
                        value={text}
                        onTextChange={(e) => setText(e.htmlValue)}
                        style={{ height: "120px" }} />
                      
                      <p className="mt-1">Maximum 60 Words</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {formError ? <p className="text-danger small mb-0 me-auto">{formError}</p> : null}
                <button
                  type="button"
                  className="btn me-2 btn-secondary"
                  data-bs-dismiss="modal">
                  
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formBusy}>
                  {formBusy ? "Saving..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* Edit popup */}
      <div className="modal fade" id="view-return-details">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Purchase Return Details</h4>
              </div>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="modal-body">
              {viewReturnRow ? (
                <div className="row g-2">
                  <div className="col-6"><strong>Reference:</strong> {viewReturnRow.reference || "—"}</div>
                  <div className="col-6"><strong>Date:</strong> {viewReturnRow.date || "—"}</div>
                  <div className="col-6"><strong>Supplier:</strong> {viewReturnRow.supplier || "—"}</div>
                  <div className="col-6"><strong>Status:</strong> {viewReturnRow.status || "—"}</div>
                  <div className="col-6"><strong>Refunded:</strong> {formatKes(viewReturnRow.paid)}</div>
                  <div className="col-6"><strong>Due:</strong> {formatKes(viewReturnRow.due)}</div>
                  <div className="col-12"><strong>Payment:</strong> {normalizePaymentStatus(viewReturnRow.paymentStatus)}</div>
                </div>
              ) : (
                <p className="text-muted mb-0">No return selected.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <DeleteModal onConfirm={() => {
        void handleDelete();
      }} />
    </div>);

};

export default PurchaseReturns;