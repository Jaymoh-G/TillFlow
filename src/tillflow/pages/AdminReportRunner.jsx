import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import PrimeDataTable from '../../components/data-table';
import CommonDateRangePicker from '../../components/date-range-picker/common-date-range-picker';
import { formatInvoiceMoneyKes, formatIsoToDisplay } from '../../feature-module/sales/invoiceViewHelpers';
import { TillFlowApiError } from '../api/errors';
import {
    fetchAnnualSummary,
    fetchBestSellers,
    fetchCustomerKpis,
    fetchCustomerOptions,
    fetchCustomerPurchaseLines,
    fetchEmployeeSales,
    fetchExpensesByCategory,
    fetchIncomeSummary,
    fetchPaymentBreakdown,
    fetchProfitLoss,
    fetchProposalsReport,
    fetchReturnSummary,
    fetchReturnsByStaff,
    fetchStockMovements,
    fetchStoreOptions,
    fetchSupplierPurchases,
    fetchTaxSummary,
    fetchZLight
} from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { REPORT_TABLE_CHECKBOX_COLUMN } from '../components/reports/reportTablePrimitives';
import {
    StandardReportDataTableCard,
    StandardReportFilterCard,
    StandardReportKpiRow,
    StandardReportPageHeader,
    StandardReportShell,
    StandardReportTooltipBridge
} from '../components/reports/standardReportLayout';
import { useReportDateRange } from '../hooks/useReportDateRange';
import { downloadRowsPdf } from '../utils/listExport';
import { downloadReportCsv } from '../utils/reportExport';
import { buildKpiItemsForSlug } from '../utils/reportKpiHelpers';

/** Ref column for customer purchase lines: link to POS order or invoice detail. */
function ProposalRefCell({ row }) {
  const id = row.id;
  const ref = row.proposal_ref;
  if (id == null || ref == null || ref === '') {
    return '—';
  }
  return (
    <Link
      to={`/admin/proposals/${encodeURIComponent(String(id))}/edit`}
      className="text-primary">
      {ref}
    </Link>
  );
}

function CustomerPurchaseLineRefCell({ row }) {
  const ref = row.ref;
  const display = ref == null || ref === '' ? '—' : String(ref);
  const posId = row.pos_order_id;
  const invId = row.invoice_id;
  if (row.source === 'pos' && posId != null && Number(posId) > 0) {
    return (
      <Link to={`/admin/orders/${posId}`} className="text-primary">
        {display}
      </Link>
    );
  }
  if (row.source === 'invoice' && invId != null && Number(invId) > 0) {
    return (
      <Link to={`/admin/invoices/${invId}`} className="text-primary">
        {display}
      </Link>
    );
  }
  return display;
}

const SLUGS = new Set([
  'best-sellers',
  'stock-history',
  'supplier-purchases',
  'customer-report',
  'customer-purchase-lines',
  'expense-report',
  'income-report',
  'tax-report',
  'profit-loss',
  'annual-report',
  'payment-breakdown',
  'z-light',
  'return-summary',
  'employee-sales',
  'returns-by-staff',
  'proposal-report'
]);

const SUBTITLES = {
  'best-sellers': 'Top products by revenue in the selected period',
  'stock-history': 'Stock adjustments and transfer lines',
  'supplier-purchases': 'Purchase documents in the selected period',
  'customer-report': 'Customer spend and transaction counts',
  'customer-purchase-lines': 'Line-level history for one customer',
  'expense-report': 'Expenses in the selected period',
  'income-report': 'Income summary (POS and invoices)',
  'tax-report': 'Tax by rate from POS line items',
  'profit-loss': 'Profit & loss (estimated)',
  'annual-report': 'Revenue and estimated profit / loss for the selected year',
  'payment-breakdown': 'Payments by tender type',
  'z-light': 'Light Z from transactional data (no cash drawer)',
  'return-summary': 'Sales returns in the selected period',
  'employee-sales': 'Sales by cashier / employee',
  'returns-by-staff': 'Returns processed by staff',
  'proposal-report': 'Sales proposals in the selected period (by proposed date)'
};

const TITLES = {
  'best-sellers': 'Best sellers',
  'stock-history': 'Stock history',
  'supplier-purchases': 'Supplier purchases',
  'customer-report': 'Customer report',
  'customer-purchase-lines': 'Customer purchase lines',
  'expense-report': 'Expense report',
  'income-report': 'Income report',
  'tax-report': 'Tax report',
  'profit-loss': 'Profit & loss',
  'annual-report': 'Annual report',
  'payment-breakdown': 'Payment breakdown',
  'z-light': 'End of day (Z — light)',
  'return-summary': 'Return summary',
  'employee-sales': 'Employee sales',
  'returns-by-staff': 'Returns by staff',
  'proposal-report': 'Proposal report'
};

const LINE_COLS = [
  { field: 'label', header: 'Line' },
  {
    field: 'amount',
    header: 'Amount',
    body: (row) => (row.amount == null || row.amount === '' ? '—' : formatInvoiceMoneyKes(row.amount))
  }
];

const MONEY_FIELDS_BY_SLUG = {
  'best-sellers': ['revenue', 'profit'],
  'supplier-purchases': ['grand_total', 'due_amount'],
  'customer-report': ['spend_total', 'profit_estimated'],
  'customer-purchase-lines': ['line_total'],
  'expense-report': ['amount'],
  'tax-report': ['line_total'],
  'payment-breakdown': ['amount'],
  'return-summary': ['total_amount'],
  'employee-sales': ['total_amount'],
  'returns-by-staff': ['total_amount'],
  'proposal-report': ['total_amount']
};

const DATE_FIELDS_BY_SLUG = {
  'stock-history': ['at'],
  'supplier-purchases': ['purchase_date'],
  'expense-report': ['expense_date'],
  'return-summary': ['returned_at'],
  'customer-purchase-lines': ['date'],
  'proposal-report': ['proposed_at', 'expires_at']
};

/** @param {string} slug @param {boolean} withCheckbox */
function baseColumnsForSlug(slug, withCheckbox) {
  const map = {
    'best-sellers': [
      { field: 'product_name', header: 'Product' },
      { field: 'sku', header: 'SKU' },
      { field: 'qty_sold', header: 'Qty' },
      { field: 'revenue', header: 'Revenue' },
      { field: 'profit', header: 'Gross profit' }
    ],
    'stock-history': [
      { field: 'type', header: 'Type' },
      { field: 'at', header: 'When' },
      { field: 'product_name', header: 'Product' },
      { field: 'sku', header: 'SKU' },
      { field: 'quantity', header: 'Qty' },
      { field: 'reference', header: 'Ref' }
    ],
    'supplier-purchases': [
      { field: 'reference', header: 'Ref' },
      { field: 'purchase_date', header: 'Date' },
      { field: 'supplier_name', header: 'Supplier' },
      { field: 'grand_total', header: 'Total' },
      { field: 'due_amount', header: 'Due' }
    ],
    'customer-report': [
      { field: 'customer_name', header: 'Customer' },
      { field: 'transaction_count', header: 'Transactions' },
      { field: 'spend_total', header: 'Spend' },
      { field: 'profit_estimated', header: 'Profit (est.)' },
      { field: 'pos_orders', header: 'POS' },
      { field: 'invoices', header: 'Invoices' }
    ],
    'customer-purchase-lines': [
      { field: 'source', header: 'Source' },
      { field: 'ref', header: 'Ref', body: (row) => <CustomerPurchaseLineRefCell row={row} /> },
      { field: 'date', header: 'Date' },
      { field: 'product_name', header: 'Product' },
      { field: 'quantity', header: 'Qty' },
      { field: 'line_total', header: 'Line total' }
    ],
    'expense-report': [
      { field: 'expense_date', header: 'Date' },
      { field: 'title', header: 'Title' },
      { field: 'category', header: 'Category' },
      { field: 'amount', header: 'Amount' },
      { field: 'payment_status', header: 'Status' }
    ],
    'tax-report': [
      { field: 'tax_percent', header: 'Tax %' },
      { field: 'line_total', header: 'Line total' },
      { field: 'line_count', header: 'Lines' }
    ],
    'payment-breakdown': [
      { field: 'label', header: 'Method' },
      { field: 'method', header: 'Code' },
      { field: 'amount', header: 'Amount' }
    ],
    'return-summary': [
      { field: 'sales_return_no', header: 'Return' },
      { field: 'returned_at', header: 'Date' },
      { field: 'total_amount', header: 'Total' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'store_name', header: 'Store' }
    ],
    'employee-sales': [
      { field: 'user_name', header: 'Employee' },
      { field: 'order_count', header: 'Orders' },
      { field: 'total_amount', header: 'Total' },
      { field: 'store_name', header: 'Store' }
    ],
    'returns-by-staff': [
      { field: 'user_name', header: 'Staff' },
      { field: 'return_count', header: 'Returns' },
      { field: 'total_amount', header: 'Amount' },
      { field: 'total_qty', header: 'Qty' }
    ],
    'proposal-report': [
      { field: 'proposal_ref', header: 'Ref', body: (row) => <ProposalRefCell row={row} /> },
      { field: 'proposal_title', header: 'Title' },
      { field: 'status', header: 'Status' },
      { field: 'proposed_at', header: 'Proposed' },
      { field: 'expires_at', header: 'Expires' },
      { field: 'recipient_name', header: 'Recipient' },
      { field: 'lead_code', header: 'Lead' },
      { field: 'biller_name', header: 'Biller' },
      { field: 'total_amount', header: 'Total' }
    ]
  };

  const raw = map[slug] ?? [{ field: 'id', header: '—' }];
  const fmt = (v) => (v == null || v === '' ? '—' : formatInvoiceMoneyKes(v));

  const enhanced = raw.map((c) => {
    const f = c.field;
    if ((MONEY_FIELDS_BY_SLUG[slug] ?? []).includes(f)) {
      return { ...c, body: (row) => fmt(row[f]) };
    }
    if ((DATE_FIELDS_BY_SLUG[slug] ?? []).includes(f)) {
      return { ...c, body: (row) => formatIsoToDisplay(row[f]) };
    }
    return c;
  });

  if (withCheckbox) {
    return [REPORT_TABLE_CHECKBOX_COLUMN, ...enhanced];
  }
  return enhanced;
}

export default function AdminReportRunner() {
  const { slug } = useParams();
  const { token } = useAuth();
  const { from, to, setFrom, setTo, params: dateParams, allDates, setAllDates } = useReportDateRange({
    defaultDays: 30
  });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [zDate, setZDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [zData, setZData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leadExtra, setLeadExtra] = useState('');
  const [meta, setMeta] = useState(() => ({
    pos_tax_total: '',
    returnSummary: null,
    customerPurchaseSummary: null,
    proposalSummary: null
  }));
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const baseParams = useMemo(() => {
    const o = { ...dateParams };
    if (storeId) {
      o.store_id = storeId;
    }
    return o;
  }, [dateParams, storeId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        const data = await fetchStoreOptions(token);
        setStores(data.stores ?? []);
      } catch {
        setStores([]);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || slug !== 'customer-purchase-lines') {
      return;
    }
    (async () => {
      try {
        const data = await fetchCustomerOptions(token);
        setCustomers(data.customers ?? []);
      } catch {
        setCustomers([]);
      }
    })();
  }, [token, slug]);

  const load = useCallback(async () => {
    if (!token || !slug) {
      return;
    }
    setError('');
    setLoading(true);
    setLeadExtra('');
    setMeta({ pos_tax_total: '', returnSummary: null, customerPurchaseSummary: null, proposalSummary: null });
    try {
      if (slug === 'best-sellers') {
        const d = await fetchBestSellers(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `bs-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'stock-history') {
        const d = await fetchStockMovements(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `st-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'supplier-purchases') {
        const d = await fetchSupplierPurchases(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `sup-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'customer-report') {
        const d = await fetchCustomerKpis(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `cu-${i}` })));
        setLines([]);
        setZData(null);
        setLeadExtra(d.note ? String(d.note) : '');
      } else if (slug === 'customer-purchase-lines') {
        const cid = parseInt(customerId, 10);
        if (Number.isNaN(cid) || cid < 1) {
          setRows([]);
          setError('Select a customer.');
          setZData(null);
          setMeta((m) => ({ ...m, customerPurchaseSummary: null }));
          setLoading(false);

          return;
        }
        const d = await fetchCustomerPurchaseLines(token, { customer_id: cid });
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `cpl-${i}` })));
        setLines([]);
        setZData(null);
        setMeta((m) => ({
          ...m,
          customerPurchaseSummary: d.summary ?? null
        }));
      } else if (slug === 'expense-report') {
        const d = await fetchExpensesByCategory(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `ex-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'income-report') {
        const d = await fetchIncomeSummary(token, baseParams);
        setRows([]);
        setLines(d.lines ?? []);
        setZData(null);
        setLeadExtra(d.note ? String(d.note) : '');
      } else if (slug === 'tax-report') {
        const d = await fetchTaxSummary(token, baseParams);
        setRows((d.by_tax_rate ?? []).map((r, i) => ({ ...r, id: `tx-${i}` })));
        setLines([]);
        setZData(null);
        setLeadExtra(`POS tax (header sum): ${d.pos_tax_total ?? '—'}`);
        setMeta((m) => ({ ...m, pos_tax_total: String(d.pos_tax_total ?? '') }));
      } else if (slug === 'profit-loss') {
        const d = await fetchProfitLoss(token, baseParams);
        setRows([]);
        setLines(d.lines ?? []);
        setZData(null);
        setLeadExtra(d.note ? String(d.note) : '');
      } else if (slug === 'annual-report') {
        const d = await fetchAnnualSummary(token, { year });
        setRows([]);
        setLines(d.lines ?? []);
        setZData(null);
        setLeadExtra(d.note ? String(d.note) : '');
      } else if (slug === 'payment-breakdown') {
        const d = await fetchPaymentBreakdown(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `pay-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'z-light') {
        const d = await fetchZLight(token, { date: zDate });
        setRows([]);
        setLines([]);
        setZData(d);
      } else if (slug === 'return-summary') {
        const d = await fetchReturnSummary(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `ret-${i}` })));
        setLines([]);
        setZData(null);
        setLeadExtra(d.summary ? `Returns: ${d.summary.count} · Total: ${d.summary.total_amount}` : '');
        setMeta((m) => ({ ...m, returnSummary: d.summary ?? null }));
      } else if (slug === 'employee-sales') {
        const d = await fetchEmployeeSales(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `emp-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'returns-by-staff') {
        const d = await fetchReturnsByStaff(token, baseParams);
        setRows((d.rows ?? []).map((r, i) => ({ ...r, id: `rs-${i}` })));
        setLines([]);
        setZData(null);
      } else if (slug === 'proposal-report') {
        const d = await fetchProposalsReport(token, baseParams);
        setRows(
          (d.rows ?? []).map((r, i) => ({
            ...r,
            id: r.id != null ? r.id : `pr-${i}`
          }))
        );
        setLines([]);
        setZData(null);
        const s = d.summary ?? null;
        setMeta((m) => ({ ...m, proposalSummary: s }));
        setLeadExtra(
          s
            ? `Proposals: ${s.count ?? 0} · Value: ${formatInvoiceMoneyKes(s.total_amount)} · Accepted: ${s.accepted_count ?? 0}`
            : ''
        );
      }
    } catch (e) {
      setRows([]);
      setLines([]);
      setZData(null);
      if (e instanceof TillFlowApiError) {
        setError(e.message);
      } else {
        setError('Failed to load report');
      }
    } finally {
      setLoading(false);
    }
  }, [token, slug, baseParams, year, zDate, customerId]);

  useEffect(() => {
    if (!slug || !SLUGS.has(slug)) {
      return;
    }
    if (slug === 'customer-purchase-lines') {
      return;
    }
    void load();
  }, [load, slug]);

  const title = slug ? TITLES[slug] ?? 'Report' : 'Report';
  const subtitle = slug ? SUBTITLES[slug] ?? '' : '';

  const isLineMode = slug && ['income-report', 'profit-loss', 'annual-report'].includes(slug);
  const useCheckbox = slug && !isLineMode && slug !== 'z-light';

  const tableColumns = useMemo(
    () => (slug ? baseColumnsForSlug(slug, useCheckbox) : []),
    [slug, useCheckbox]
  );

  const lineTableColumns = useMemo(() => LINE_COLS, []);

  const exportColumnsRaw = useMemo(() => {
    if (!slug) {
      return [];
    }
    return baseColumnsForSlug(slug, false).filter((c) => c.field !== '_pick');
  }, [slug]);

  const kpiItems = useMemo(
    () =>
      buildKpiItemsForSlug(slug ?? '', {
        rows,
        lines,
        zData,
        meta: {
          pos_tax_total: meta.pos_tax_total,
          returnSummary: meta.returnSummary,
          customerPurchaseSummary: meta.customerPurchaseSummary,
          proposalSummary: meta.proposalSummary
        }
      }),
    [slug, rows, lines, zData, meta]
  );

  const onExportCsv = useCallback(() => {
    const name = slug ?? 'report';
    if (lines.length) {
      const lineExportCols = [
        { field: 'label', header: 'Line' },
        { field: 'amount', header: 'Amount' }
      ];
      downloadReportCsv(
        lines.map((ln, i) => ({ ...ln, id: `ln-${i}` })),
        lineExportCols,
        name
      );

      return;
    }
    const flat = exportColumnsRaw.map((c) => ({ field: c.field, header: c.header }));
    downloadReportCsv(rows, flat, name);
  }, [slug, lines, rows, exportColumnsRaw]);

  const onExportPdf = useCallback(async () => {
    const name = slug ?? 'report';
    if (lines.length) {
      const head = ['Line', 'Amount'];
      const body = lines.map((ln) => [
        String(ln.label ?? ''),
        ln.amount == null || ln.amount === '' ? '' : formatInvoiceMoneyKes(ln.amount)
      ]);
      await downloadRowsPdf(title, head, body, name);

      return;
    }
    if (!rows.length || !exportColumnsRaw.length) {
      return;
    }
    const mf = new Set(MONEY_FIELDS_BY_SLUG[slug] ?? []);
    const df = new Set(DATE_FIELDS_BY_SLUG[slug] ?? []);
    const head = exportColumnsRaw.map((c) => c.header);
    const body = rows.map((row) =>
      exportColumnsRaw.map((c) => {
        const v = row[c.field];
        if (v == null || v === '') {
          return '';
        }
        if (mf.has(c.field)) {
          return formatInvoiceMoneyKes(v);
        }
        if (df.has(c.field)) {
          return formatIsoToDisplay(v);
        }
        return String(v);
      })
    );
    await downloadRowsPdf(title, head, body, name);
  }, [slug, lines, rows, exportColumnsRaw, title]);

  const exportDisabledResolved =
    loading || (isLineMode ? !lines.length : !rows.length);

  const datePickerValue = useMemo(() => {
    const a = from ? dayjs(from) : dayjs().subtract(29, 'day');
    const b = to ? dayjs(to) : dayjs();
    const start = a.isValid() ? a : dayjs().subtract(29, 'day');
    const end = b.isValid() ? b : dayjs();
    return [start, end];
  }, [from, to]);

  const onDateRangeChange = (range) => {
    if (!range?.[0] || !range?.[1]) {
      return;
    }
    setAllDates(false);
    setFrom(range[0].format('YYYY-MM-DD'));
    setTo(range[1].format('YYYY-MM-DD'));
  };

  const onAllDatesSelect = () => {
    setAllDates(true);
  };

  const showDate = slug && !['annual-report', 'z-light'].includes(slug);
  const showStore =
    slug &&
    ['best-sellers', 'payment-breakdown', 'tax-report', 'employee-sales', 'return-summary'].includes(
      slug
    );

  if (!slug || !SLUGS.has(slug)) {
    return <Navigate to="/admin/reports" replace />;
  }

  if (slug === 'z-light') {
    return (
      <StandardReportShell>
        <StandardReportTooltipBridge />
        <StandardReportPageHeader title={title} subtitle={subtitle} onRefresh={() => void load()} />
        <StandardReportKpiRow items={kpiItems} />
        <StandardReportFilterCard>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}>
            <div className="row align-items-end">
              <div className="col-lg-10">
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={zDate}
                        onChange={(e) => setZDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-2">
                <div className="mb-3">
                  <button className="btn btn-primary w-100" type="submit">
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </form>
        </StandardReportFilterCard>
        <StandardReportDataTableCard
          tableTitle={title}
          exportDisabled
          onExportPdf={() => {}}
          onExportCsv={() => {}}
          error={error}
          loading={loading}>
          {zData ? (
            <>
              <p className="text-muted small px-3 pt-3 mb-2">{zData.note ?? ''}</p>
              <div className="px-3 pb-3">
                <div className="tf-panel tf-report__zgrid d-grid gap-3">
                  <div>
                    <strong>Date</strong>
                    <p className="mb-0">{zData.date}</p>
                  </div>
                  <div>
                    <strong>POS orders</strong>
                    <p className="mb-0">{zData.pos_order_count}</p>
                  </div>
                  <div>
                    <strong>POS gross</strong>
                    <p className="mb-0">{zData.pos_gross_total}</p>
                  </div>
                  <div>
                    <strong>POS tax</strong>
                    <p className="mb-0">{zData.pos_tax_total}</p>
                  </div>
                  <div>
                    <strong>Returns</strong>
                    <p className="mb-0">{zData.returns_total}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted px-3 py-2">No data.</p>
          )}
        </StandardReportDataTableCard>
      </StandardReportShell>
    );
  }

  const lead = [leadExtra, meta.pos_tax_total ? `POS tax (header): ${meta.pos_tax_total}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <StandardReportShell>
      <StandardReportTooltipBridge />
      <StandardReportPageHeader title={title} subtitle={subtitle} onRefresh={() => void load()} />

      {lead ? <p className="text-muted small px-1 mb-2">{lead}</p> : null}

      <StandardReportKpiRow items={kpiItems} />

      <StandardReportFilterCard>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}>
          <div className="row align-items-end">
            <div className="col-lg-10">
              <div className="row">
                {showDate ? (
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Choose Date&nbsp;</label>
                      <div className="input-icon-start position-relative">
                        <CommonDateRangePicker
                          value={datePickerValue}
                          onChange={onDateRangeChange}
                          showAllDatesOption
                          allDatesActive={allDates}
                          onAllDatesSelect={onAllDatesSelect}
                        />
                        <span className="input-icon-left">
                          <i className="ti ti-calendar" />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                {slug === 'annual-report' ? (
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Year</label>
                      <input
                        type="number"
                        className="form-control"
                        value={year}
                        min={2000}
                        max={2100}
                        onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                      />
                    </div>
                  </div>
                ) : null}
                {showStore ? (
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Store</label>
                      <select
                        className="form-select"
                        value={storeId}
                        onChange={(e) => setStoreId(e.target.value)}
                        aria-label="Filter by store">
                        <option value="">All stores</option>
                        {stores.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.store_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
                {slug === 'customer-purchase-lines' ? (
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Customer</label>
                      <select
                        className="form-select"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        aria-label="Select customer for purchase lines">
                        <option value="">Choose customer</option>
                        {customers.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="col-lg-2">
              <div className="mb-3">
                <button className="btn btn-primary w-100" type="submit">
                  {slug === 'customer-purchase-lines' ? 'Load report' : 'Generate Report'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </StandardReportFilterCard>

      <StandardReportDataTableCard
        tableTitle={title}
        exportDisabled={exportDisabledResolved}
        onExportPdf={() => void onExportPdf()}
        onExportCsv={onExportCsv}
        error={error}
        loading={loading}>
        <div className="table-responsive">
          {isLineMode ? (
            <PrimeDataTable
              column={lineTableColumns}
              data={lines.map((ln, i) => ({ ...ln, id: `ln-${i}` }))}
              rows={pageSize}
              setRows={setPageSize}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={lines.length}
              loading={false}
              dataKey="id"
            />
          ) : (
            <PrimeDataTable
              column={tableColumns}
              data={rows}
              rows={pageSize}
              setRows={setPageSize}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={rows.length}
              loading={false}
              dataKey="id"
            />
          )}
        </div>
      </StandardReportDataTableCard>
    </StandardReportShell>
  );
}
