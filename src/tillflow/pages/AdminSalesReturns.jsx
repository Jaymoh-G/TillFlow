import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import CommonFooter from '../../components/footer/commonFooter';
import PrimeDataTable from '../../components/data-table';
import TableTopHead from '../../components/table-top-head';
import { TillFlowApiError } from '../api/errors';
import { listCustomersRequest } from '../api/customers';
import { listInvoicesRequest } from '../api/invoices';
import { listSalesCatalogProductsRequest } from '../api/products';
import { listPosOrdersRequest } from '../api/posOrders';
import {
  createSalesReturnRequest,
  deleteSalesReturnRequest,
  listSalesReturnsRequest,
  updateSalesReturnRequest,
} from '../api/salesReturns';
import { listSalesStoresRequest } from '../api/stores';
import { useAuth } from '../auth/AuthContext';
import { downloadRowsExcel, downloadRowsPdf } from '../utils/listExport';
import {
  downloadSalesReturnsImportTemplate,
  parseSalesReturnsImportFile
} from '../utils/salesReturnsImport';

function defaultDateTimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function makeReturnLine() {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productId: '',
    storeId: '',
    quantity: '1',
    productSearch: '',
  };
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

function populateFormFromRow(row) {
  const lines =
    Array.isArray(row.lines) && row.lines.length > 0
      ? row.lines.map((ln) => ({
          key: `line-${ln.id ?? 'x'}-${Math.random().toString(36).slice(2, 9)}`,
          productId: ln.product_id != null ? String(ln.product_id) : '',
          storeId: ln.store_id != null ? String(ln.store_id) : '',
          quantity: String(ln.quantity ?? '1'),
          productSearch: '',
        }))
      : [makeReturnLine()];
  let returnedAt = defaultDateTimeLocal();
  if (row.returned_at) {
    try {
      const d = new Date(row.returned_at);
      if (!Number.isNaN(d.getTime())) {
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        returnedAt = d.toISOString().slice(0, 16);
      }
    } catch {
      // keep default
    }
  }
  return {
    customerId: row.customer_id != null && row.customer_id !== '' ? String(row.customer_id) : '',
    invoiceId: row.invoice_id != null && row.invoice_id !== '' ? String(row.invoice_id) : '',
    posOrderId: row.pos_order_id != null && row.pos_order_id !== '' ? String(row.pos_order_id) : '',
    lines,
    returnedAt,
    status: row.status ?? 'Pending',
    amountPaid: row.amount_paid != null ? String(row.amount_paid) : '',
    paymentStatus: row.payment_status ?? 'Unpaid',
    notes: row.notes != null ? String(row.notes) : '',
  };
}

function filterCatalogByQuery(products, q, limit = 60) {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return products.slice(0, limit);
  }
  return products
    .filter((p) => {
      const name = String(p?.name ?? '').toLowerCase();
      const sku = String(p?.sku ?? '').toLowerCase();
      return name.includes(needle) || sku.includes(needle);
    })
    .slice(0, limit);
}

export default function AdminSalesReturns() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tableRows, setTableRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [posOrderSearch, setPosOrderSearch] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importWorking, setImportWorking] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    invoiceId: '',
    posOrderId: '',
    lines: [makeReturnLine()],
    returnedAt: defaultDateTimeLocal(),
    status: 'Pending',
    amountPaid: '',
    paymentStatus: 'Unpaid',
    notes: '',
  });

  const filteredCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) {
      return customers.slice(0, 40);
    }
    return customers
      .filter((c) => String(c.name ?? '').toLowerCase().includes(needle))
      .slice(0, 40);
  }, [customers, customerSearch]);

  const filteredInvoices = useMemo(() => {
    let list = Array.isArray(invoices) ? invoices : [];
    if (form.customerId) {
      list = list.filter((inv) => String(inv.customer_id) === String(form.customerId));
    }
    const needle = invoiceSearch.trim().toLowerCase();
    if (!needle) {
      return list.slice(0, 50);
    }
    return list
      .filter((inv) => {
        const ref = String(inv.invoice_ref ?? '').toLowerCase();
        const cname = String(inv.customer_name ?? '').toLowerCase();
        return ref.includes(needle) || cname.includes(needle);
      })
      .slice(0, 50);
  }, [invoices, form.customerId, invoiceSearch]);

  const filteredPosOrders = useMemo(() => {
    let list = Array.isArray(posOrders) ? posOrders : [];
    if (form.customerId) {
      list = list.filter(
        (o) => o.customer_id != null && String(o.customer_id) === String(form.customerId)
      );
    }
    const needle = posOrderSearch.trim().toLowerCase();
    if (!needle) {
      return list.slice(0, 50);
    }
    return list
      .filter((o) => {
        const ono = String(o.order_no ?? '').toLowerCase();
        const cname = String(o.customer_name ?? '').toLowerCase();
        return ono.includes(needle) || cname.includes(needle);
      })
      .slice(0, 50);
  }, [posOrders, form.customerId, posOrderSearch]);

  const selectedCustomer = useMemo(() => {
    const id = Number(form.customerId);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return customers.find((c) => Number(c.id) === id) ?? null;
  }, [form.customerId, customers]);

  const selectedInvoice = useMemo(() => {
    const id = Number(form.invoiceId);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return invoices.find((inv) => Number(inv.id) === id) ?? null;
  }, [form.invoiceId, invoices]);

  const selectedPosOrder = useMemo(() => {
    const id = Number(form.posOrderId);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return posOrders.find((o) => Number(o.id) === id) ?? null;
  }, [form.posOrderId, posOrders]);

  const lineTotals = useMemo(() => {
    return form.lines.map((line) => {
      const p = catalogProducts.find((x) => Number(x.id) === Number(line.productId));
      const unit = roundMoney(p?.selling_price ?? 0);
      const q = Number(String(line.quantity).replace(/,/g, ''));
      const qty = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 0;
      const sub = qty >= 1 ? roundMoney(unit * qty) : 0;
      return { unitPrice: unit, qty, subtotal: sub };
    });
  }, [form.lines, catalogProducts]);

  const computedGrandTotal = useMemo(() => {
    return roundMoney(lineTotals.reduce((s, l) => s + l.subtotal, 0));
  }, [lineTotals]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = await listSalesReturnsRequest(token, {
        q: searchQ.trim() || undefined,
        customer_id: filterCustomerId || undefined,
        status: filterStatus || undefined,
        payment_status: filterPayment || undefined,
        from: from || undefined,
        to: to || undefined,
        sort: sortMode,
      });
      const list = data?.sales_returns ?? data?.data?.sales_returns;
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setRows([]);
      setListError(e instanceof TillFlowApiError ? e.message : 'Could not load sales returns.');
    } finally {
      setLoading(false);
    }
  }, [token, searchQ, filterCustomerId, filterStatus, filterPayment, from, to, sortMode]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [cData, iData] = await Promise.all([listCustomersRequest(token), listInvoicesRequest(token)]);
        if (cancelled) {
          return;
        }
        setCustomers(Array.isArray(cData?.customers) ? cData.customers : []);
        setInvoices(Array.isArray(iData?.invoices) ? iData.invoices : []);
      } catch {
        if (!cancelled) {
          setCustomers([]);
          setInvoices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!showAdd || !token) {
      return;
    }
    let cancelled = false;
    setCustomerSearch('');
    setInvoiceSearch('');
    setPosOrderSearch('');
    (async () => {
      try {
        const [pData, sData, poData] = await Promise.all([
          listSalesCatalogProductsRequest(token),
          listSalesStoresRequest(token),
          listPosOrdersRequest(token),
        ]);
        if (cancelled) {
          return;
        }
        setCatalogProducts(Array.isArray(pData?.products) ? pData.products : []);
        setStores(Array.isArray(sData?.stores) ? sData.stores : []);
        const po = poData?.pos_orders ?? poData?.data?.pos_orders;
        setPosOrders(Array.isArray(po) ? po : []);
      } catch {
        if (!cancelled) {
          setCatalogProducts([]);
          setStores([]);
          setPosOrders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdd, token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQ, tableRows, filterCustomerId, filterStatus, filterPayment, from, to, sortMode]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({
      customerId: '',
      invoiceId: '',
      posOrderId: '',
      lines: [makeReturnLine()],
      returnedAt: defaultDateTimeLocal(),
      status: 'Pending',
      amountPaid: '',
      paymentStatus: 'Unpaid',
      notes: '',
    });
    setCustomerSearch('');
    setInvoiceSearch('');
    setPosOrderSearch('');
    setFormError('');
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setShowAdd(true);
  }, [resetForm]);

  const openEdit = useCallback((row) => {
    if (!row?.id) {
      return;
    }
    setFormError('');
    setCustomerSearch('');
    setInvoiceSearch('');
    setPosOrderSearch('');
    setForm(populateFormFromRow(row));
    setEditingId(row.id);
    setShowAdd(true);
  }, []);

  const closeAdd = useCallback(() => {
    if (!saving) {
      setShowAdd(false);
      setEditingId(null);
    }
  }, [saving]);

  const deleteReturn = useCallback(
    async (row) => {
      if (!token || !row?.id) {
        return;
      }
      const ref = String(row.return_ref ?? row.sales_return_no ?? row.id);
      if (
        !window.confirm(
          `Delete sales return ${ref}? Stock will be adjusted if this return was received. This cannot be undone.`
        )
      ) {
        return;
      }
      try {
        await deleteSalesReturnRequest(token, row.id);
        void load();
      } catch (e) {
        window.alert(e instanceof TillFlowApiError ? e.message : 'Could not delete sales return.');
      }
    },
    [token, load]
  );

  const submitAdd = useCallback(async () => {
    if (!token) {
      return;
    }
    setFormError('');
    const linesPayload = [];
    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];
      const pid = Number(line.productId);
      const sid = Number(line.storeId);
      const qty = Number(String(line.quantity).replace(/,/g, ''));
      if (!Number.isFinite(pid) || pid <= 0) {
        setFormError(`Line ${i + 1}: select a product.`);
        return;
      }
      if (!Number.isFinite(sid) || sid <= 0) {
        setFormError(`Line ${i + 1}: select a store.`);
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        setFormError(`Line ${i + 1}: enter a quantity of at least 1.`);
        return;
      }
      linesPayload.push({
        product_id: Math.floor(pid),
        store_id: Math.floor(sid),
        quantity: Math.floor(qty),
      });
    }
    const paid = Number(String(form.amountPaid).replace(/,/g, ''));
    if (!Number.isFinite(paid) || paid < 0) {
      setFormError('Enter a valid amount paid.');
      return;
    }

    setSaving(true);
    try {
      const cid = Number(form.customerId);
      const body = {
        lines: linesPayload,
        status: form.status,
        amount_paid: paid,
        payment_status: form.paymentStatus,
        notes: String(form.notes ?? '').trim() || null,
      };
      if (Number.isFinite(cid) && cid > 0) {
        body.customer_id = Math.floor(cid);
      }
      if (form.invoiceId) {
        body.invoice_id = Number(form.invoiceId);
      }
      if (form.posOrderId) {
        body.pos_order_id = Number(form.posOrderId);
      }
      if (form.returnedAt) {
        body.returned_at = new Date(form.returnedAt).toISOString();
      }
      if (editingId != null) {
        await updateSalesReturnRequest(token, editingId, body);
      } else {
        await createSalesReturnRequest(token, body);
      }
      setShowAdd(false);
      resetForm();
      void load();
    } catch (e) {
      setFormError(e instanceof TillFlowApiError ? e.message : 'Could not create sales return.');
    } finally {
      setSaving(false);
    }
  }, [token, form, load, resetForm, editingId]);

  const runImport = useCallback(async () => {
    if (!token || importRows.length === 0) {
      return;
    }
    setImportWorking(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createSalesReturnRequest(token, {
          customer_id: Number.isFinite(row.customer_id) ? row.customer_id : undefined,
          invoice_id: Number.isFinite(row.invoice_id) ? row.invoice_id : undefined,
          pos_order_id: Number.isFinite(row.pos_order_id) ? row.pos_order_id : undefined,
          lines: row.lines,
          returned_at: row.returned_at,
          status: row.status,
          amount_paid: row.amount_paid,
          payment_status: row.payment_status,
          notes: row.notes
        });
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(`Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : 'Could not create return.'}`);
      }
    }
    await load();
    setImportSummary({ created, skipped: 0, failed, details });
    setImportWorking(false);
  }, [token, importRows, load]);

  const handleExportExcel = useCallback(async () => {
    const records = rows.map((r) => ({
      'Return #': String(r.return_ref ?? r.sales_return_no ?? ''),
      Invoice: String(r.invoice_ref ?? ''),
      Receipt: String(r.receipt_no ?? ''),
      Product: String(r.product_name ?? ''),
      SKU: String(r.product_sku ?? ''),
      Qty: r.quantity != null && r.quantity !== '' ? String(r.quantity) : '',
      Store: String(r.store_name ?? ''),
      Date: String(r.date_display ?? ''),
      Customer: String(r.customer_name ?? ''),
      Status: String(r.status ?? ''),
      Total: String(r.total_display ?? r.total_amount ?? ''),
      Paid: String(r.paid_display ?? r.amount_paid ?? ''),
      Due: String(r.due_display ?? r.amount_due ?? ''),
      'Payment status': String(r.payment_status ?? ''),
    }));
    await downloadRowsExcel(records, 'Sales returns', 'sales-returns');
  }, [rows]);

  const handleExportPdf = useCallback(async () => {
    const body = rows.map((r) => [
      String(r.return_ref ?? r.sales_return_no ?? ''),
      String(r.invoice_ref ?? ''),
      String(r.receipt_no ?? ''),
      String(r.product_name ?? ''),
      String(r.product_sku ?? ''),
      r.quantity != null && r.quantity !== '' ? String(r.quantity) : '',
      String(r.store_name ?? ''),
      String(r.date_display ?? ''),
      String(r.customer_name ?? ''),
      String(r.status ?? ''),
      String(r.total_display ?? r.total_amount ?? ''),
      String(r.paid_display ?? r.amount_paid ?? ''),
      String(r.due_display ?? r.amount_due ?? ''),
      String(r.payment_status ?? ''),
    ]);
    await downloadRowsPdf(
      'Sales returns',
      [
        'Return #',
        'Invoice',
        'Receipt',
        'Product',
        'SKU',
        'Qty',
        'Store',
        'Date',
        'Customer',
        'Status',
        'Total',
        'Paid',
        'Due',
        'Payment',
      ],
      body,
      'sales-returns'
    );
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        header: 'Return #',
        field: 'return_ref',
        body: (r) => <span className="fw-medium">{r.return_ref ?? r.sales_return_no}</span>,
      },
      {
        header: 'Invoice',
        field: 'invoice_ref',
        body: (r) => <span className="small text-nowrap">{r.invoice_ref || '—'}</span>,
      },
      {
        header: 'Receipt',
        field: 'receipt_no',
        body: (r) => <span className="small text-nowrap">{r.receipt_no || '—'}</span>,
      },
      {
        header: 'Product',
        field: 'product_name',
        body: (r) => (
          <div className="small">
            <div className="text-truncate" style={{ maxWidth: 220 }} title={r.product_name}>
              {r.product_name || '—'}
            </div>
            {r.product_sku ? (
              <div className="text-muted text-truncate" style={{ maxWidth: 220 }} title={r.product_sku}>
                {r.product_sku}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        header: 'Qty',
        field: 'quantity',
        className: 'text-end',
        body: (r) => <span className="text-end d-block">{r.quantity != null && r.quantity !== '' ? r.quantity : '—'}</span>,
      },
      {
        header: 'Store',
        field: 'store_name',
        body: (r) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 140 }} title={r.store_name}>
            {r.store_name || '—'}
          </span>
        ),
      },
      {
        header: 'Date',
        field: 'date_display',
        body: (r) => <span className="text-nowrap small">{r.date_display ?? '—'}</span>,
      },
      {
        header: 'Customer',
        field: 'customer_name',
        body: (r) => (
          <span className="small text-truncate d-inline-block" style={{ maxWidth: 180 }} title={r.customer_name}>
            {r.customer_name || '—'}
          </span>
        ),
      },
      {
        header: 'Status',
        field: 'status',
        body: (r) => (
          <span className={`badge shadow-none ${r.status === 'Pending' ? 'badge-cyan' : 'badge-success'}`}>
            {r.status}
          </span>
        ),
      },
      {
        header: 'Total',
        field: 'total_display',
        className: 'text-end',
        body: (r) => <span className="text-end d-block">{r.total_display ?? r.total_amount}</span>,
      },
      {
        header: 'Paid',
        field: 'paid_display',
        className: 'text-end',
        body: (r) => <span className="text-end d-block">{r.paid_display ?? r.amount_paid}</span>,
      },
      {
        header: 'Due',
        field: 'due_display',
        className: 'text-end',
        body: (r) => <span className="text-end d-block">{r.due_display ?? r.amount_due}</span>,
      },
      {
        header: 'Payment',
        field: 'payment_status',
        body: (r) => (
          <span
            className={`badge badge-xs shadow-none ${
              r.payment_status === 'Unpaid'
                ? 'badge-soft-danger'
                : r.payment_status === 'Paid'
                  ? 'badge-soft-success'
                  : 'badge-soft-warning'
            }`}>
            <i className="ti ti-point-filled me-1" />
            {r.payment_status}
          </span>
        ),
      },
      {
        header: 'Actions',
        field: 'actions',
        className: 'text-end',
        body: (r) => (
          <div className="d-inline-flex gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              title="Edit"
              onClick={() => openEdit(r)}>
              <i className="ti ti-edit" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              title="Delete"
              onClick={() => void deleteReturn(r)}>
              <i className="ti ti-trash" />
            </button>
          </div>
        ),
      },
    ],
    [openEdit, deleteReturn]
  );

  return (
    <div className="page-wrapper invoice-payments-page">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
            <div className="page-title">
              <h4>Sales returns</h4>
              <h6 className="mb-0">Record and track customer returns against invoices.</h6>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <TableTopHead
                onRefresh={() => void load()}
                onExportPdf={loading || rows.length === 0 ? undefined : () => void handleExportPdf()}
                onExportExcel={loading || rows.length === 0 ? undefined : () => void handleExportExcel()}
                onImport={token ? () => setShowImport(true) : undefined}
              />
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                <i className="ti ti-circle-plus me-1" />
                Add a sale return
              </button>
              <Link to="/admin/invoices" className="btn btn-outline-primary">
                <i className="feather icon-arrow-left me-1" />
                Invoices
              </Link>
            </div>
          </div>
        </div>

        {listError ? <div className="alert alert-warning">{listError}</div> : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <label className="form-label small mb-0">Search</label>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Return #, product, customer…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Customer</label>
                <select
                  className="form-select"
                  value={filterCustomerId}
                  onChange={(e) => setFilterCustomerId(e.target.value)}>
                  <option value="">All</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Return status</label>
                <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="Received">Received</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Payment status</label>
                <select
                  className="form-select"
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}>
                  <option value="">All</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-0">From</label>
                <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-0">To</label>
                <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-0">Sort</label>
                <select className="form-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                  <option value="recent">Recent</option>
                  <option value="refAsc">Return # A–Z</option>
                  <option value="refDesc">Return # Z–A</option>
                  <option value="lastMonth">This month</option>
                  <option value="last7">Last 7 days</option>
                </select>
              </div>
            </div>

            <PrimeDataTable
              column={columns}
              data={rows}
              rows={tableRows}
              setRows={setTableRows}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={rows.length}
              loading={loading}
              isPaginationEnabled
            />
          </div>
        </div>
      </div>

      <Modal show={showAdd} onHide={closeAdd} centered size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{editingId != null ? 'Edit sales return' : 'Add a sale return'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
          <div className="row g-2">
            <div className="col-12 col-lg-4">
              <label className="form-label">Customer (optional)</label>
              {selectedCustomer ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="badge bg-light text-dark border py-2 px-3 text-start">
                    <span className="fw-medium">{selectedCustomer.name}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setForm((f) => ({ ...f, customerId: '', invoiceId: '', posOrderId: '' }));
                      setCustomerSearch('');
                    }}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    className="form-control"
                    placeholder="Search customer by name…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <div
                    className="border rounded mt-1 bg-white"
                    style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredCustomers.length === 0 ? (
                      <div className="small text-muted p-2">No matches.</div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="dropdown-item w-100 text-start py-2 border-bottom border-light"
                          onClick={() => {
                            setForm((f) => {
                              let invoiceId = f.invoiceId;
                              let posOrderId = f.posOrderId;
                              if (invoiceId) {
                                const inv = invoices.find((i) => String(i.id) === String(invoiceId));
                                if (inv && String(inv.customer_id) !== String(c.id)) {
                                  invoiceId = '';
                                }
                              }
                              if (posOrderId) {
                                const po = posOrders.find((o) => String(o.id) === String(posOrderId));
                                if (
                                  po &&
                                  po.customer_id != null &&
                                  String(po.customer_id) !== String(c.id)
                                ) {
                                  posOrderId = '';
                                }
                              }
                              return { ...f, customerId: String(c.id), invoiceId, posOrderId };
                            });
                            setCustomerSearch('');
                          }}>
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="col-12 col-lg-4">
              <label className="form-label">Invoice (optional)</label>
              {selectedInvoice ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="badge bg-light text-dark border py-2 px-3 text-start">
                    <span className="fw-medium d-block">{selectedInvoice.invoice_ref}</span>
                    {selectedInvoice.customer_name ? (
                      <span className="text-muted small">{selectedInvoice.customer_name}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setForm((f) => ({ ...f, invoiceId: '' }));
                      setInvoiceSearch('');
                    }}>
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    className="form-control"
                    placeholder={
                      form.customerId
                        ? 'Search invoice # or name…'
                        : 'Select a customer first, or search all invoices…'
                    }
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <div
                    className="border rounded mt-1 bg-white"
                    style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredInvoices.length === 0 ? (
                      <div className="small text-muted p-2">No invoices found.</div>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <button
                          key={inv.id}
                          type="button"
                          className="dropdown-item w-100 text-start py-2 border-bottom border-light"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              invoiceId: String(inv.id),
                              customerId:
                                inv.customer_id != null && inv.customer_id !== ''
                                  ? String(inv.customer_id)
                                  : f.customerId,
                            }));
                            setInvoiceSearch('');
                          }}>
                          <span className="fw-medium d-block">{inv.invoice_ref}</span>
                          <span className="small text-muted">{inv.customer_name ?? ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="col-12 col-lg-4">
              <label className="form-label">POS receipt (optional)</label>
              {selectedPosOrder ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="badge bg-light text-dark border py-2 px-3 text-start">
                    <span className="fw-medium d-block">POS {selectedPosOrder.order_no}</span>
                    {selectedPosOrder.customer_name ? (
                      <span className="text-muted small">{selectedPosOrder.customer_name}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setForm((f) => ({ ...f, posOrderId: '' }));
                      setPosOrderSearch('');
                    }}>
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    className="form-control"
                    placeholder={
                      form.customerId
                        ? 'Search receipt # or customer…'
                        : 'Search POS receipt # (e.g. 00029)…'
                    }
                    value={posOrderSearch}
                    onChange={(e) => setPosOrderSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <div
                    className="border rounded mt-1 bg-white"
                    style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredPosOrders.length === 0 ? (
                      <div className="small text-muted p-2">No receipts found.</div>
                    ) : (
                      filteredPosOrders.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="dropdown-item w-100 text-start py-2 border-bottom border-light"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              posOrderId: String(o.id),
                              customerId:
                                o.customer_id != null && o.customer_id !== ''
                                  ? String(o.customer_id)
                                  : f.customerId,
                            }));
                            setPosOrderSearch('');
                          }}>
                          <span className="fw-medium d-block">POS {o.order_no}</span>
                          <span className="small text-muted">{o.customer_name ?? ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="col-12">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                <label className="form-label mb-0">Returned products</label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setForm((f) => ({ ...f, lines: [...f.lines, makeReturnLine()] }))
                  }>
                  <i className="ti ti-plus me-1" />
                  Add line
                </button>
              </div>
              <div className="table-responsive border rounded">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th style={{ minWidth: 140 }}>Store</th>
                      <th className="text-end" style={{ width: 100 }}>
                        Qty
                      </th>
                      <th className="text-end" style={{ width: 110 }}>
                        Unit (Ksh)
                      </th>
                      <th className="text-end" style={{ width: 110 }}>
                        Line (Ksh)
                      </th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, idx) => {
                      const picked = catalogProducts.find((p) => Number(p.id) === Number(line.productId));
                      const lt = lineTotals[idx] ?? { unitPrice: 0, subtotal: 0 };
                      const rowProducts = filterCatalogByQuery(catalogProducts, line.productSearch);
                      return (
                        <tr key={line.key}>
                          <td>
                            {picked ? (
                              <div className="d-flex align-items-start gap-2 flex-wrap">
                                <span className="small">
                                  <span className="fw-medium d-block">{picked.name}</span>
                                  {picked.sku ? (
                                    <span className="text-muted">{picked.sku}</span>
                                  ) : null}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      lines: f.lines.map((L) =>
                                        L.key === line.key
                                          ? { ...L, productId: '', productSearch: '' }
                                          : L
                                      ),
                                    }))
                                  }>
                                  Change
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="search"
                                  className="form-control form-control-sm"
                                  placeholder="Search name / SKU…"
                                  value={line.productSearch}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      lines: f.lines.map((L) =>
                                        L.key === line.key
                                          ? { ...L, productSearch: e.target.value }
                                          : L
                                      ),
                                    }))
                                  }
                                  autoComplete="off"
                                />
                                <div
                                  className="border rounded mt-1 bg-white"
                                  style={{ maxHeight: 140, overflowY: 'auto' }}>
                                  {rowProducts.length === 0 ? (
                                    <div className="small text-muted p-1">No matches.</div>
                                  ) : (
                                    rowProducts.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className="dropdown-item w-100 text-start py-1 small border-bottom border-light"
                                        onClick={() =>
                                          setForm((f) => ({
                                            ...f,
                                            lines: f.lines.map((L) =>
                                              L.key === line.key
                                                ? {
                                                    ...L,
                                                    productId: String(p.id),
                                                    productSearch: '',
                                                  }
                                                : L
                                            ),
                                          }))
                                        }>
                                        <span className="fw-medium d-block">{p.name}</span>
                                        {p.sku ? (
                                          <span className="text-muted">{p.sku}</span>
                                        ) : null}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={line.storeId}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  lines: f.lines.map((L) =>
                                    L.key === line.key ? { ...L, storeId: e.target.value } : L
                                  ),
                                }))
                              }>
                              <option value="">—</option>
                              {stores.map((s) => (
                                <option key={s.id} value={String(s.id)}>
                                  {s.name || s.code || `Store #${s.id}`}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              className="form-control form-control-sm text-end"
                              value={line.quantity}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  lines: f.lines.map((L) =>
                                    L.key === line.key ? { ...L, quantity: e.target.value } : L
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="text-end small text-muted text-nowrap">
                            {lt.unitPrice.toFixed(2)}
                          </td>
                          <td className="text-end small fw-medium text-nowrap">
                            {lt.subtotal.toFixed(2)}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0"
                              disabled={form.lines.length < 2}
                              title="Remove line"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  lines: f.lines.filter((L) => L.key !== line.key),
                                }))
                              }>
                              <i className="ti ti-trash" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="form-text">
                Total uses each product&apos;s <strong>selling price</strong>. When status is{' '}
                <strong>Received</strong>, quantities are added back to stock at each line&apos;s store.
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label">Returned at</label>
              <input
                type="datetime-local"
                className="form-control"
                value={form.returnedAt}
                onChange={(e) => setForm((f) => ({ ...f, returnedAt: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Return status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="Pending">Pending</option>
                <option value="Received">Received</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Total (Ksh)</label>
              <input
                type="text"
                className="form-control bg-light"
                readOnly
                value={computedGrandTotal.toFixed(2)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Amount paid (Ksh)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-control"
                value={form.amountPaid}
                onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Payment status</label>
              <select
                className="form-select"
                value={form.paymentStatus}
                onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light border" onClick={closeAdd} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submitAdd()}>
            {saving ? 'Saving…' : editingId != null ? 'Update' : 'Save'}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showImport}
        onHide={() => {
          if (!importWorking) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        centered
        size="lg"
        scrollable>
        <Modal.Header closeButton={!importWorking}>
          <Modal.Title>Import sales returns</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!importSummary ? (
            <>
              <div className="d-flex gap-2 flex-wrap mb-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => void downloadSalesReturnsImportTemplate()}>
                  Download template
                </button>
                <label className="btn btn-outline-secondary btn-sm mb-0">
                  Upload file
                  <input
                    type="file"
                    className="d-none"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (e.target) e.target.value = '';
                      if (!file) return;
                      const parsed = await parseSalesReturnsImportFile(file);
                      setImportRows(parsed.rows);
                      setImportErrors(parsed.errors);
                      setImportSummary(null);
                    }}
                  />
                </label>
              </div>
              {importErrors.length > 0 ? (
                <div className="alert alert-warning py-2">
                  <ul className="mb-0 small ps-3">
                    {importErrors.map((er, i) => (
                      <li key={`${er.sheetRow}-${i}`}>
                        Row {er.sheetRow}: {er.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="table-responsive border rounded" style={{ maxHeight: 320 }}>
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Row</th>
                      <th>Customer ID</th>
                      <th>Invoice ID</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 40).map((r) => (
                      <tr key={`imp-sr-${r.sheetRow}`}>
                        <td>{r.sheetRow}</td>
                        <td>{r.customer_id ?? '—'}</td>
                        <td>{r.invoice_id ?? '—'}</td>
                        <td>{r.status}</td>
                        <td>{r.payment_status}</td>
                        <td>{Array.isArray(r.lines) ? r.lines.length : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2">
                <strong>Created:</strong> {importSummary.created}, <strong>Failed:</strong>{' '}
                {importSummary.failed}
              </p>
              <ul className="small mb-0 ps-3" style={{ maxHeight: 220, overflow: 'auto' }}>
                {importSummary.details.map((d, i) => (
                  <li key={`isr-${i}`}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!importSummary ? (
            <>
              <button type="button" className="btn btn-light border" onClick={() => setShowImport(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importWorking || importRows.length === 0}
                onClick={() => void runImport()}>
                {importWorking ? 'Importing...' : 'Import'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setShowImport(false)}>
              Done
            </button>
          )}
        </Modal.Footer>
      </Modal>

      <CommonFooter />
    </div>
  );
}
