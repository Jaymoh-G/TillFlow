import { Edit2, PlusCircle, Trash2 } from "react-feather";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import CommonFooter from "../../components/footer/commonFooter";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import { listCustomersRequest } from "../../tillflow/api/customers";
import { TillFlowApiError } from "../../tillflow/api/errors";
import {
  createExpenseRequest,
  createExpenseCategoryRequest,
  createExpenseMultipartRequest,
  createExpenseRecurringRuleRequest,
  deleteExpenseRequest,
  listExpenseCategoriesRequest,
  listExpenseRecurringRulesRequest,
  listExpensesRequest,
  runExpenseRecurringNowRequest,
  updateExpenseMultipartRequest
} from "../../tillflow/api/expenses";
import { useOptionalAuth } from "../../tillflow/auth/AuthContext";
import { downloadExpensesExcel, downloadExpensesPdf } from "../../utils/expenseExport";
import { downloadExpenseImportTemplate, parseExpenseImportFile } from "../../utils/expenseImport";

const ALL = { label: "All", value: "" };

function toRow(e) {
  return {
    id: e.id,
    expenseDate: String(e.expense_date ?? ""),
    title: String(e.title ?? ""),
    categoryId: e.category_id ?? null,
    categoryName: String(e.category?.name ?? ""),
    customerId: e.customer_id ?? null,
    customerName: String(e.customer?.name ?? ""),
    payee: String(e.payee ?? ""),
    amount: Number(e.amount ?? 0),
    paymentMode: String(e.payment_mode ?? "cash"),
    paymentStatus: String(e.payment_status ?? "Unpaid"),
    notes: String(e.notes ?? ""),
    receiptPath: String(e.receipt_path ?? "")
  };
}

export default function ExpensesModule() {
  const auth = useOptionalAuth();
  const token = auth?.token ?? null;
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(Boolean(token));
  const [listError, setListError] = useState("");
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [tableRows, setTableRows] = useState(10);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importWorking, setImportWorking] = useState(false);

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTitle, setFormTitle] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPayee, setFormPayee] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formPaymentMode, setFormPaymentMode] = useState("cash");
  const [formPaymentStatus, setFormPaymentStatus] = useState("Paid");
  const [formNotes, setFormNotes] = useState("");
  const [formReceipt, setFormReceipt] = useState(null);
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurringCadence, setFormRecurringCadence] = useState("monthly");
  const [formRecurringInterval, setFormRecurringInterval] = useState("1");
  const [formRecurringStartDate, setFormRecurringStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState("");

  const resolveIdByName = useCallback((items, rawName) => {
    const text = String(rawName ?? "").trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return Number(text);
    const found = items.find((it) => String(it.name ?? "").toLowerCase() === text.toLowerCase());
    return found?.id ?? null;
  }, []);

  const buildImportPayload = useCallback(
    (row) => ({
      expense_date: row.expenseDate,
      title: row.title,
      category_id: resolveIdByName(categories, row.category),
      customer_id: resolveIdByName(customers, row.customer),
      payee: row.payee,
      amount: row.amount,
      payment_mode: row.paymentMode,
      payment_status: row.paymentStatus,
      notes: row.notes
    }),
    [categories, customers, resolveIdByName]
  );

  const importFileInputRef = useRef(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setListError("");
    try {
      const [expensesData, categoriesData, customersData, recurringData] = await Promise.all([
        listExpensesRequest(token, {
          q: searchQuery.trim() || undefined,
          category_id: filterCategory || undefined,
          payment_status: filterStatus || undefined,
          payment_mode: filterMode || undefined
        }),
        listExpenseCategoriesRequest(token),
        listCustomersRequest(token),
        listExpenseRecurringRulesRequest(token)
      ]);
      setRows((expensesData?.expenses ?? []).map(toRow));
      setCategories(categoriesData?.categories ?? []);
      setCustomers(customersData?.customers ?? []);
      setRecurringRules(recurringData?.rules ?? []);
    } catch (e) {
      setRows([]);
      setListError(e instanceof TillFlowApiError ? e.message : "Could not load expenses.");
    } finally {
      setListLoading(false);
    }
  }, [token, searchQuery, filterCategory, filterStatus, filterMode]);

  useEffect(() => {
    if (!token) return;
    const t = window.setTimeout(() => {
      void loadAll();
    }, 250);
    return () => window.clearTimeout(t);
  }, [token, loadAll]);

  const categoryOptions = useMemo(
    () => [ALL, ...categories.map((c) => ({ label: c.name, value: String(c.id) }))],
    [categories]
  );
  const statusOptions = useMemo(
    () => [ALL, { label: "Paid", value: "Paid" }, { label: "Unpaid", value: "Unpaid" }, { label: "Partial", value: "Partial" }],
    []
  );
  const modeOptions = useMemo(
    () => [ALL, "cash", "bank_transfer", "mpesa", "card", "cheque", "other"].map((v) => (v === "" ? ALL : { label: v, value: v })),
    []
  );

  const resetExpenseForm = () => {
    setEditing(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTitle("");
    setFormCategoryId("");
    setFormCustomerId("");
    setFormPayee("");
    setFormAmount("");
    setFormPaymentMode("cash");
    setFormPaymentStatus("Paid");
    setFormNotes("");
    setFormReceipt(null);
    setFormIsRecurring(false);
    setFormRecurringCadence("monthly");
    setFormRecurringInterval("1");
    setFormRecurringStartDate(new Date().toISOString().slice(0, 10));
    setFormError("");
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormDate(row.expenseDate || new Date().toISOString().slice(0, 10));
    setFormTitle(row.title || "");
    setFormCategoryId(row.categoryId != null ? String(row.categoryId) : "");
    setFormCustomerId(row.customerId != null ? String(row.customerId) : "");
    setFormPayee(row.payee || "");
    setFormAmount(String(row.amount ?? ""));
    setFormPaymentMode(row.paymentMode || "cash");
    setFormPaymentStatus(row.paymentStatus || "Paid");
    setFormNotes(row.notes || "");
    setFormReceipt(null);
    setFormIsRecurring(false);
    setFormError("");
    setShowExpenseModal(true);
  };

  const saveExpense = async () => {
    if (!token) return;
    setFormError("");
    if (!formTitle.trim() || !formDate || Number(formAmount) <= 0) {
      setFormError("Title, date and amount are required.");
      return;
    }
    const payload = {
      expense_date: formDate,
      title: formTitle.trim(),
      category_id: formCategoryId ? Number(formCategoryId) : null,
      customer_id: formCustomerId ? Number(formCustomerId) : null,
      payee: formPayee.trim() || null,
      amount: Number(formAmount),
      payment_mode: formPaymentMode,
      payment_status: formPaymentStatus,
      notes: formNotes.trim() || null
    };
    try {
      if (editing?.id) {
        await updateExpenseMultipartRequest(token, editing.id, payload, formReceipt);
      } else {
        await createExpenseMultipartRequest(token, payload, formReceipt);
        if (formIsRecurring) {
          await createExpenseRecurringRuleRequest(token, {
            title: formTitle.trim(),
            cadence: formRecurringCadence,
            interval_value: Number(formRecurringInterval) || 1,
            amount: Number(formAmount),
            start_date: formRecurringStartDate || formDate,
            category_id: formCategoryId ? Number(formCategoryId) : null,
            customer_id: formCustomerId ? Number(formCustomerId) : null,
            payment_mode: formPaymentMode,
            payment_status: formPaymentStatus
          });
        }
      }
      setShowExpenseModal(false);
      resetExpenseForm();
      await loadAll();
    } catch (e) {
      setFormError(e instanceof TillFlowApiError ? e.message : "Could not save expense.");
    }
  };

  const addCategory = async () => {
    if (!token) return;
    setNewCategoryError("");
    if (!newCategoryName.trim()) {
      setNewCategoryError("Category name is required.");
      return;
    }
    try {
      await createExpenseCategoryRequest(token, { name: newCategoryName.trim(), is_active: true });
      setNewCategoryName("");
      setShowCategoryModal(false);
      await loadAll();
    } catch (e) {
      setNewCategoryError(e instanceof TillFlowApiError ? e.message : "Could not create category.");
    }
  };

  const runRecurringNow = async () => {
    if (!token) return;
    try {
      await runExpenseRecurringNowRequest(token);
      await loadAll();
    } catch (e) {
      setListError(e instanceof TillFlowApiError ? e.message : "Could not run recurring generation.");
    }
  };

  const handleDelete = async (row) => {
    if (!token || !row?.id) return;
    if (!window.confirm("Delete this expense?")) return;
    try {
      await deleteExpenseRequest(token, row.id);
      await loadAll();
    } catch (e) {
      setListError(e instanceof TillFlowApiError ? e.message : "Could not delete expense.");
    }
  };

  const handleImportPick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseExpenseImportFile(file);
      setImportRows(parsed.rows);
      setImportErrors(parsed.errors);
      setImportResult(null);
      setShowImportModal(true);
    } catch {
      setListError("Could not read the import file.");
    }
  }, []);

  const runExpenseImport = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImportWorking(true);
    setImportResult(null);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createExpenseRequest(token, buildImportPayload(row));
        created += 1;
      } catch (err) {
        failed += 1;
        details.push(`Row ${row.sheetRow}: ${err instanceof TillFlowApiError ? err.message : "Failed to create expense."}`);
      }
    }
    setImportResult({ created, failed, details });
    setImportWorking(false);
    await loadAll();
  }, [token, importRows, buildImportPayload, loadAll]);

  const columns = useMemo(
    () => [
      { header: "Date", field: "expenseDate", sortable: true },
      { header: "Title", field: "title", sortable: true },
      { header: "Category", field: "categoryName", sortable: true, body: (r) => r.categoryName || "—" },
      { header: "Customer", field: "customerName", sortable: true, body: (r) => r.customerName || "—" },
      { header: "Payee", field: "payee", sortable: true, body: (r) => r.payee || "—" },
      { header: "Mode", field: "paymentMode", sortable: true },
      { header: "Status", field: "paymentStatus", sortable: true },
      { header: "Amount", field: "amount", sortable: true, body: (r) => `Ksh ${Number(r.amount || 0).toFixed(2)}` },
      {
        header: "",
        field: "actions",
        sortable: false,
        body: (row) => (
          <div className="edit-delete-action d-flex align-items-center">
            <button type="button" className="me-2 p-2 d-flex align-items-center border rounded bg-white" onClick={() => openEdit(row)}>
              <Edit2 size={16} />
            </button>
            <button type="button" className="p-2 d-flex align-items-center border rounded bg-white" onClick={() => void handleDelete(row)}>
              <Trash2 size={16} />
            </button>
          </div>
        )
      }
    ],
    []
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex">
            <div className="page-title">
              <h4>Expenses</h4>
              <h6>Track one-off and recurring expenses</h6>
            </div>
          </div>
          <TableTopHead
            onRefresh={loadAll}
            onExportPdf={() => void downloadExpensesPdf(rows)}
            onExportExcel={() => void downloadExpensesExcel(rows)}
            onImport={handleImportPick}
          />
          <div className="page-btn d-flex gap-2">
            <button type="button" className="btn btn-outline-primary" onClick={() => setShowCategoryModal(true)}>
              Categories
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => void runRecurringNow()}>
              Run recurring now
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                resetExpenseForm();
                setShowExpenseModal(true);
              }}>
              <PlusCircle size={18} className="me-1" />
              Add expense
            </button>
          </div>
        </div>
        {listError ? <div className="alert alert-danger">{listError}</div> : null}
        <input
          ref={importFileInputRef}
          type="file"
          className="d-none"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handleImportFileChange}
        />
        <div className="card table-list-card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
            <SearchFromApi callback={(v) => setSearchQuery(v ?? "")} rows={tableRows} setRows={setTableRows} />
            <div className="d-flex align-items-center flex-wrap gap-2">
              <div style={{ minWidth: "12rem" }}>
                <CommonSelect options={categoryOptions} value={filterCategory} onChange={(e) => setFilterCategory(e.value ?? "")} placeholder="Category" />
              </div>
              <div style={{ minWidth: "10rem" }}>
                <CommonSelect options={statusOptions} value={filterStatus} onChange={(e) => setFilterStatus(e.value ?? "")} placeholder="Status" />
              </div>
              <div style={{ minWidth: "10rem" }}>
                <CommonSelect options={modeOptions} value={filterMode} onChange={(e) => setFilterMode(e.value ?? "")} placeholder="Payment mode" />
              </div>
            </div>
          </div>
          <div className="card-body pb-0">
            <PrimeDataTable
              column={columns}
              data={rows}
              totalRecords={rows.length}
              rows={tableRows}
              setRows={setTableRows}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              selectionMode="checkbox"
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              loading={listLoading}
            />
          </div>
        </div>
        <div className="card mt-3">
          <div className="card-header"><h6 className="mb-0">Recurring rules</h6></div>
          <div className="card-body table-responsive">
            <table className="table table-sm mb-0">
              <thead><tr><th>Title</th><th>Cadence</th><th>Interval</th><th>Next run</th><th className="text-end">Amount</th></tr></thead>
              <tbody>
                {recurringRules.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-2">No recurring rules yet.</td></tr> : recurringRules.map((r) => (
                  <tr key={r.id}><td>{r.title}</td><td>{r.cadence}</td><td>{r.interval_value}</td><td>{String(r.next_run_at || "").replace("T", " ").slice(0, 16)}</td><td className="text-end">Ksh {Number(r.amount || 0).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <CommonFooter />

      <Modal show={showExpenseModal} onHide={() => setShowExpenseModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>{editing ? "Edit expense" : "Add expense"}</Modal.Title></Modal.Header>
        <Modal.Body>
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <div className="row g-2">
            <div className="col-6"><label className="form-label">Expense date</label><input type="date" className="form-control" value={formDate} onChange={(e) => setFormDate(e.target.value)} /></div>
            <div className="col-6"><label className="form-label">Amount</label><input type="number" min="0" step="0.01" className="form-control" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} /></div>
            <div className="col-12"><label className="form-label">Title</label><input className="form-control" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} /></div>
            <div className="col-6"><label className="form-label">Category</label><select className="form-select" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="col-6"><label className="form-label">Customer</label><select className="form-select" value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)}><option value="">None</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="col-6"><label className="form-label">Payee</label><input className="form-control" value={formPayee} onChange={(e) => setFormPayee(e.target.value)} /></div>
            <div className="col-6"><label className="form-label">Payment mode</label><select className="form-select" value={formPaymentMode} onChange={(e) => setFormPaymentMode(e.target.value)}>{["cash","bank_transfer","mpesa","card","cheque","other"].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div className="col-6"><label className="form-label">Payment status</label><select className="form-select" value={formPaymentStatus} onChange={(e) => setFormPaymentStatus(e.target.value)}>{["Paid","Unpaid","Partial"].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="col-6"><label className="form-label">Receipt</label><input type="file" className="form-control" onChange={(e) => setFormReceipt(e.target.files?.[0] ?? null)} /></div>
            <div className="col-12"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} /></div>
            {!editing ? (
              <>
                <div className="col-12 pt-1">
                  <div className="form-check">
                    <input id="expense-recurring-toggle" type="checkbox" className="form-check-input" checked={formIsRecurring} onChange={(e) => setFormIsRecurring(e.target.checked)} />
                    <label htmlFor="expense-recurring-toggle" className="form-check-label">Recurring expense</label>
                  </div>
                </div>
                {formIsRecurring ? (
                  <>
                    <div className="col-4"><label className="form-label">Cadence</label><select className="form-select" value={formRecurringCadence} onChange={(e) => setFormRecurringCadence(e.target.value)}>{["weekly","monthly","custom_days"].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-4"><label className="form-label">Interval</label><input type="number" min="1" className="form-control" value={formRecurringInterval} onChange={(e) => setFormRecurringInterval(e.target.value)} /></div>
                    <div className="col-4"><label className="form-label">Start date</label><input type="date" className="form-control" value={formRecurringStartDate} onChange={(e) => setFormRecurringStartDate(e.target.value)} /></div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </Modal.Body>
        <Modal.Footer><button type="button" className="btn btn-light border" onClick={() => setShowExpenseModal(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => void saveExpense()}>{editing ? "Save changes" : "Add expense"}</button></Modal.Footer>
      </Modal>

      <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>New expense category</Modal.Title></Modal.Header>
        <Modal.Body>
          {newCategoryError ? <div className="alert alert-danger py-2">{newCategoryError}</div> : null}
          <label className="form-label">Name</label>
          <input className="form-control" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
        </Modal.Body>
        <Modal.Footer><button type="button" className="btn btn-light border" onClick={() => setShowCategoryModal(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => void addCategory()}>Add category</button></Modal.Footer>
      </Modal>

      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Import expenses</Modal.Title></Modal.Header>
        <Modal.Body>
          {!importResult ? (
            <>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mb-3"
                onClick={() => void downloadExpenseImportTemplate()}>
                Download sample template
              </button>
              {importErrors.length > 0 ? (
                <div className="alert alert-warning py-2">
                  <strong className="d-block mb-1">Parse issues</strong>
                  <ul className="mb-0 small ps-3">
                    {importErrors.map((pe, idx) => (
                      <li key={`exp-pe-${pe.sheetRow}-${idx}`}>Row {pe.sheetRow}: {pe.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="table-responsive border rounded" style={{ maxHeight: 320 }}>
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light position-sticky top-0">
                    <tr>
                      <th>Row</th><th>Date</th><th>Title</th><th>Amount</th><th>Category</th><th>Customer</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 50).map((r) => (
                      <tr key={`${r.sheetRow}-${r.title}-${r.amount}`}>
                        <td>{r.sheetRow}</td>
                        <td>{r.expenseDate}</td>
                        <td>{r.title}</td>
                        <td>{Number(r.amount).toFixed(2)}</td>
                        <td>{r.category ?? "—"}</td>
                        <td>{r.customer ?? "—"}</td>
                        <td>{r.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2"><strong>Created:</strong> {importResult.created}, <strong>Failed:</strong> {importResult.failed}</p>
              {importResult.details.length > 0 ? <ul className="small ps-3 mb-0">{importResult.details.map((d, i) => <li key={`exp-imp-${i}`}>{d}</li>)}</ul> : <p className="text-muted small mb-0">No row errors.</p>}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!importResult ? (
            <>
              <button type="button" className="btn btn-light border" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={importWorking || importRows.length === 0} onClick={() => void runExpenseImport()}>
                {importWorking ? "Importing..." : "Import"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setShowImportModal(false)}>Done</button>
          )}
        </Modal.Footer>
      </Modal>

    </div>
  );
}

