import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import CommonFooter from "../../components/footer/commonFooter";
import TableTopHead from "../../components/table-top-head";
import PrimeDataTable from "../../components/data-table";
import { TillFlowApiError } from "../api/errors";
import {
  INVOICE_PAYMENT_METHOD_OPTIONS,
  deleteInvoicePaymentRequest,
  listAllInvoicePaymentsRequest,
  paymentMethodLabel,
  updateInvoicePaymentRequest
} from "../api/invoicePayments";
import { useAuth } from "../auth/AuthContext";
import { downloadRowsExcel, downloadRowsPdf } from "../utils/listExport";

function formatKes(n) {
  const x = Number(n);
  if (Number.isNaN(x)) {
    return "—";
  }
  const num = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
  return `Ksh${num}`;
}

function formatPaidAt(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

export default function AdminInvoicePayments() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [tableRows, setTableRows] = useState(10);
  const [tableCurrentPage, setTableCurrentPage] = useState(1);

  const [editRow, setEditRow] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editTransactionId, setEditTransactionId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError("");
    setLoading(true);
    try {
      const data = await listAllInvoicePaymentsRequest(token, {
        q: searchQ.trim() || undefined,
        from: from || undefined,
        to: to || undefined
      });
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) {
      setPayments([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError("Failed to load payments.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, searchQ, from, to]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  const openEdit = useCallback((p) => {
    setEditRow(p);
    setEditAmount(String(p?.amount ?? ""));
    setEditMethod(String(p?.payment_method ?? "cash"));
    const iso = p?.paid_at ? String(p.paid_at) : "";
    setEditPaidAt(iso ? iso.slice(0, 16) : "");
    setEditTransactionId(String(p?.transaction_id ?? ""));
    setEditNotes(String(p?.notes ?? ""));
    setEditError("");
  }, []);

  const closeEdit = useCallback(() => {
    setEditRow(null);
    setEditSaving(false);
    setEditError("");
  }, []);

  const editMethodOptions = useMemo(() => {
    const o = [...INVOICE_PAYMENT_METHOD_OPTIONS];
    if (editRow?.payment_method === "opening_balance") {
      o.unshift({ value: "opening_balance", label: "Opening balance" });
    }
    return o;
  }, [editRow]);

  const saveEdit = useCallback(async () => {
    if (!token || !editRow) {
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const body = {
        amount: Number(String(editAmount).replace(/,/g, "")) || 0,
        payment_method: editMethod,
        paid_at: editPaidAt ? new Date(editPaidAt).toISOString() : undefined,
        transaction_id: editTransactionId.trim() || null,
        notes: editNotes.trim() || null
      };
      await updateInvoicePaymentRequest(token, editRow.invoice_id, editRow.id, body);
      closeEdit();
      void load();
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setEditError(e.message);
      } else {
        setEditError("Could not update payment.");
      }
    } finally {
      setEditSaving(false);
    }
  }, [token, editRow, editAmount, editMethod, editPaidAt, editTransactionId, editNotes, closeEdit, load]);

  const customerOptions = useMemo(() => {
    return [...new Set(payments.map((p) => String(p.customer_name ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [payments]);

  const filtered = useMemo(() => {
    if (!customerFilter) {
      return payments;
    }
    return payments.filter((p) => String(p.customer_name ?? "").trim() === customerFilter);
  }, [payments, customerFilter]);

  const handleExportExcel = useCallback(async () => {
    const records = filtered.map((p) => ({
      Receipt: String(p.receipt_ref ?? ""),
      Paid: formatPaidAt(p.paid_at),
      Invoice: String(p.invoice_ref ?? ""),
      Customer: String(p.customer_name ?? ""),
      Amount: formatKes(p.amount),
      Method: paymentMethodLabel(p.payment_method),
      "Txn ID": String(p.transaction_id ?? ""),
      Notes: String(p.notes ?? "")
    }));
    await downloadRowsExcel(records, "Invoice payments", "invoice-payments");
  }, [filtered]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((p) => [
      String(p.receipt_ref ?? ""),
      formatPaidAt(p.paid_at),
      String(p.invoice_ref ?? ""),
      String(p.customer_name ?? ""),
      formatKes(p.amount),
      paymentMethodLabel(p.payment_method),
      String(p.transaction_id ?? ""),
      String(p.notes ?? "")
    ]);
    await downloadRowsPdf(
      "Invoice payments",
      ["Receipt", "Paid", "Invoice", "Customer", "Amount", "Method", "Txn ID", "Notes"],
      body,
      "invoice-payments"
    );
  }, [filtered]);

  const deletePayment = useCallback(
    async (row) => {
      if (!token || !row?.invoice_id || !row?.id) {
        return;
      }
      const ok = window.confirm(`Delete payment ${row.receipt_ref || `#${row.id}`}? This cannot be undone.`);
      if (!ok) {
        return;
      }
      try {
        await deleteInvoicePaymentRequest(token, row.invoice_id, row.id);
        await load();
      } catch (e) {
        if (e instanceof TillFlowApiError) {
          window.alert(e.message);
        } else {
          window.alert("Could not delete payment.");
        }
      }
    },
    [token, load]
  );

  const columns = useMemo(
    () => [
      {
        header: "Receipt",
        field: "receipt_ref",
        body: (p) => (
          <Link to={`/tillflow/admin/invoice-payments/${p.id}`} className="fw-medium">
            {p.receipt_ref}
          </Link>
        )
      },
      { header: "Paid", field: "paid_at", body: (p) => <span className="text-nowrap small">{formatPaidAt(p.paid_at)}</span> },
      {
        header: "Invoice",
        field: "invoice_ref",
        body: (p) => <Link to={`/tillflow/admin/invoices/${p.invoice_id}`}>{p.invoice_ref}</Link>
      },
      { header: "Customer", field: "customer_name", body: (p) => p.customer_name || "—" },
      {
        header: "Amount",
        field: "amount",
        className: "text-end",
        body: (p) => <span className="text-end fw-medium d-block">{formatKes(p.amount)}</span>
      },
      { header: "Method", field: "payment_method", body: (p) => paymentMethodLabel(p.payment_method) },
      { header: "Txn ID", field: "transaction_id", body: (p) => <span className="small text-break">{p.transaction_id || "—"}</span> },
      {
        header: "Actions",
        field: "action",
        sortable: false,
        className: "text-end",
        body: (p) => (
          <div className="text-end edit-delete-action">
            <Dropdown align="end" drop="down">
              <Dropdown.Toggle
                variant="light"
                id={`invoice-payment-actions-${String(p.id)}`}
                className="btn btn-sm btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center tf-invoice-payments-kebab"
                aria-label="Payment actions">
                <i className="ti ti-dots-vertical" />
              </Dropdown.Toggle>
              <Dropdown.Menu popperConfig={{ strategy: "fixed" }} renderOnMount>
                <Dropdown.Item as={Link} to={`/tillflow/admin/invoice-payments/${p.id}`}>
                  <i className="ti ti-eye text-dark" aria-hidden />
                  View
                </Dropdown.Item>
                <Dropdown.Item
                  as="button"
                  type="button"
                  onClick={() => navigate(`/tillflow/admin/invoices/${p.invoice_id}?emailCustomer=1`)}>
                  <i className="ti ti-send text-dark" aria-hidden />
                  Send to customer
                </Dropdown.Item>
                <Dropdown.Item as="button" type="button" onClick={() => openEdit(p)}>
                  <i className="ti ti-edit text-dark" aria-hidden />
                  Edit
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  as="button"
                  type="button"
                  className="text-danger"
                  disabled={String(p.payment_method ?? "") === "opening_balance"}
                  onClick={() => void deletePayment(p)}>
                  <i className="ti ti-trash" aria-hidden />
                  Delete
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )
      }
    ],
    [deletePayment, navigate, openEdit]
  );

  return (
    <div className="page-wrapper invoice-payments-page">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
            <div className="page-title">
              <h4>Invoice payments</h4>
              <h6 className="mb-0">Receipts recorded against invoices — search, filter by date, or edit.</h6>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <TableTopHead
                onRefresh={() => void load()}
                onExportPdf={
                  loading || filtered.length === 0 ? undefined : () => void handleExportPdf()
                }
                onExportExcel={
                  loading || filtered.length === 0 ? undefined : () => void handleExportExcel()
                }
              />
              <Link to="/tillflow/admin/invoices" className="btn btn-outline-primary">
                <i className="feather icon-arrow-left me-1" />
                Invoices
              </Link>
            </div>
          </div>
        </div>

        {listError ? (
          <div className="alert alert-warning" role="alert">
            {listError}
          </div>
        ) : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label small mb-0">Search</label>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Receipt, invoice, customer…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">From</label>
                <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">To</label>
                <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Customer</label>
                <select
                  className="form-select"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}>
                  <option value="">All customers</option>
                  {customerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <PrimeDataTable
                column={columns}
                data={filtered}
                rows={tableRows}
                setRows={setTableRows}
                currentPage={tableCurrentPage}
                setCurrentPage={setTableCurrentPage}
                totalRecords={filtered.length}
                loading={loading}
                isPaginationEnabled
              />
            </div>
          </div>
        </div>
      </div>

      <Modal show={Boolean(editRow)} onHide={closeEdit} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
          <div className="mb-2">
            <label className="form-label">Amount (Ksh)</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className="form-control"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Method</label>
            <select className="form-select" value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
              {editMethodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Paid at</label>
            <input
              type="datetime-local"
              className="form-control"
              value={editPaidAt}
              onChange={(e) => setEditPaidAt(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Transaction ID</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. M-Pesa confirmation code"
              value={editTransactionId}
              onChange={(e) => setEditTransactionId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="mb-0">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={closeEdit}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={editSaving} onClick={() => void saveEdit()}>
            {editSaving ? "Saving…" : "Save"}
          </button>
        </Modal.Footer>
      </Modal>

      <CommonFooter />
    </div>
  );
}
