import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import CommonDateRangePicker from '../../components/date-range-picker/common-date-range-picker';
import PrimeDataTable from '../../components/data-table';
import {
  formatInvoiceMoneyKes,
  formatIsoToDisplay,
  invoiceStatusBadgeClass
} from '../../feature-module/sales/invoiceViewHelpers';
import {
  StandardReportDataTableCard,
  StandardReportFilterCard,
  StandardReportKpiRow,
  StandardReportPageHeader,
  StandardReportShell,
  StandardReportTooltipBridge
} from '../components/reports/standardReportLayout';
import { REPORT_TABLE_CHECKBOX_COLUMN } from '../components/reports/reportTablePrimitives';
import { TillFlowApiError } from '../api/errors';
import { fetchCustomerOptions, fetchInvoiceRegister } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { useReportDateRange } from '../hooks/useReportDateRange';
import { downloadRowsPdf } from '../utils/listExport';
import { downloadReportCsv } from '../utils/reportExport';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Partially_paid', label: 'Partially paid' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Overdue', label: 'Overdue' }
];

function statusLabel(st) {
  if (st === 'Partially_paid') {
    return 'Partially paid';
  }
  return st || '—';
}

export default function AdminInvoiceReport() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const { from, to, setFrom, setTo, params: dateParams, allDates, setAllDates } = useReportDateRange({
    defaultDays: 30
  });
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [customers, setCustomers] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!searchParams.has('status')) {
      return;
    }
    const s = searchParams.get('status') ?? '';
    if (STATUS_OPTIONS.some((o) => o.value === s)) {
      setStatus(s);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
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
  }, [token]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = { ...dateParams };
      if (customerId) {
        params.customer_id = customerId;
      }
      if (status) {
        params.status = status;
      }
      const d = await fetchInvoiceRegister(token, params);
      setSummary(d.summary ?? null);
      setRows((d.rows ?? []).map((r) => ({ ...r, id: r.invoice_id ?? r.id })));
    } catch (e) {
      setRows([]);
      setSummary(null);
      if (e instanceof TillFlowApiError) {
        setError(e.message);
      } else {
        setError('Failed to load invoice report');
      }
    } finally {
      setLoading(false);
    }
  }, [token, dateParams, customerId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (v) => {
    if (v == null || v === '') {
      return '—';
    }
    return formatInvoiceMoneyKes(v);
  };

  const columns = [
    REPORT_TABLE_CHECKBOX_COLUMN,
    {
      field: 'invoice_ref',
      header: 'Invoice Number',
      body: (row) => (
        <Link to={`/tillflow/admin/invoices/${row.invoice_id}`} className="text-primary">
          {row.invoice_ref}
        </Link>
      )
    },
    {
      field: 'customer_name',
      header: 'Customer'
    },
    {
      field: 'due_at',
      header: 'Due Date',
      body: (row) => formatIsoToDisplay(row.due_at)
    },
    {
      field: 'total_amount',
      header: 'Amount',
      body: (row) => money(row.total_amount)
    },
    {
      field: 'amount_paid',
      header: 'Paid',
      body: (row) => money(row.amount_paid)
    },
    {
      field: 'balance_due',
      header: 'Amount Due',
      body: (row) => money(row.balance_due)
    },
    {
      field: 'status',
      header: 'Status',
      body: (row) => (
        <span
          className={`badge ${invoiceStatusBadgeClass(row.status)} d-inline-flex align-items-center badge-xs`}>
          <i className="ti ti-point-filled me-1" aria-hidden />
          {statusLabel(row.status)}
        </span>
      )
    }
  ];

  const exportColumns = useMemo(
    () => [
      { field: 'invoice_ref', header: 'Invoice Number' },
      { field: 'issued_at', header: 'Issued' },
      { field: 'due_at', header: 'Due Date' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'total_amount', header: 'Amount' },
      { field: 'amount_paid', header: 'Paid' },
      { field: 'balance_due', header: 'Amount Due' },
      { field: 'status', header: 'Status' }
    ],
    []
  );

  const onExportCsv = () => {
    const exportRows = rows.map((r) => ({
      ...r,
      issued_at: r.issued_at ?? '',
      due_at: r.due_at ?? '',
      status: statusLabel(r.status)
    }));
    downloadReportCsv(exportRows, exportColumns, 'invoice-report');
  };

  const onExportPdf = useCallback(async () => {
    if (!rows.length) {
      return;
    }
    const head = [
      'Invoice Number',
      'Issued',
      'Due Date',
      'Customer',
      'Amount',
      'Paid',
      'Amount Due',
      'Status'
    ];
    const body = rows.map((r) => [
      r.invoice_ref ?? '',
      r.issued_at ?? '',
      formatIsoToDisplay(r.due_at),
      r.customer_name ?? '',
      formatInvoiceMoneyKes(r.total_amount),
      formatInvoiceMoneyKes(r.amount_paid),
      formatInvoiceMoneyKes(r.balance_due),
      statusLabel(r.status)
    ]);
    await downloadRowsPdf('Invoice report', head, body, 'invoice-report');
  }, [rows]);

  const kpiItems = useMemo(() => {
    const fmt = (v) => (v == null || v === '' ? '—' : formatInvoiceMoneyKes(v));
    const s = summary || {};

    return [
      { key: 'ta', label: 'Total Amount', value: fmt(s.total_invoice_amount), variant: 'info' },
      { key: 'tp', label: 'Total Paid', value: fmt(s.total_paid), variant: 'success' },
      { key: 'tu', label: 'Total Unpaid', value: fmt(s.total_balance_due), variant: 'orange' },
      { key: 'ov', label: 'Overdue', value: fmt(s.total_overdue), variant: 'danger' }
    ];
  }, [summary]);

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

  const exportDisabled = loading || !rows.length;

  return (
    <StandardReportShell>
      <StandardReportTooltipBridge />
      <StandardReportPageHeader
        title="Invoice Report"
        subtitle="Manage Your Invoice Report"
        onRefresh={() => void load()}
      />

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
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Customer</label>
                    <select
                      className="form-select"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      aria-label="Filter by customer">
                      <option value="">Choose</option>
                      {customers.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      aria-label="Filter by status">
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value || 'all'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
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
        tableTitle="Invoice Report"
        exportDisabled={exportDisabled}
        onExportPdf={() => void onExportPdf()}
        onExportCsv={onExportCsv}
        error={error}
        loading={loading}>
        <div className="table-responsive">
          <PrimeDataTable
            column={columns}
            data={rows}
            rows={pageSize}
            setRows={setPageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalRecords={rows.length}
            loading={false}
            dataKey="id"
          />
        </div>
      </StandardReportDataTableCard>
    </StandardReportShell>
  );
}
