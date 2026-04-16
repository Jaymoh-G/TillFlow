import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import CommonDateRangePicker from '../../components/date-range-picker/common-date-range-picker';
import PrimeDataTable from '../../components/data-table';
import { formatInvoiceMoneyKes, formatIsoToDisplay } from '../../feature-module/sales/invoiceViewHelpers';
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
import { fetchSalesSummary, fetchStoreOptions } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { useReportDateRange } from '../hooks/useReportDateRange';
import { downloadRowsPdf } from '../utils/listExport';
import { downloadReportCsv } from '../utils/reportExport';

export default function AdminPosSalesReport() {
  const { token } = useAuth();
  const { from, to, setFrom, setTo, params: dateParams, allDates, setAllDates } = useReportDateRange({
    defaultDays: 30
  });
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const baseParams = useMemo(() => {
    const o = { ...dateParams };
    if (storeId) {
      o.store_id = storeId;
    }
    return o;
  }, [dateParams, storeId]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const d = await fetchSalesSummary(token, baseParams);
      setSummary(d.summary ?? null);
      setRows(
        (d.rows ?? []).map((r, i) => ({
          ...r,
          id: `ps-${i}`
        }))
      );
    } catch (e) {
      setRows([]);
      setSummary(null);
      if (e instanceof TillFlowApiError) {
        setError(e.message);
      } else {
        setError('Failed to load sales summary');
      }
    } finally {
      setLoading(false);
    }
  }, [token, baseParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtKes = (v) => (v == null || v === '' ? '—' : formatInvoiceMoneyKes(v));

  const columns = useMemo(
    () => [
      REPORT_TABLE_CHECKBOX_COLUMN,
      { field: 'order_no', header: 'Order' },
      {
        field: 'completed_at',
        header: 'Completed',
        body: (row) => formatIsoToDisplay(row.completed_at)
      },
      {
        field: 'total_amount',
        header: 'Total',
        body: (row) => fmtKes(row.total_amount)
      },
      {
        field: 'tax_amount',
        header: 'Tax',
        body: (row) => fmtKes(row.tax_amount)
      },
      { field: 'cashier_name', header: 'Cashier' },
      { field: 'store_name', header: 'Store' },
      { field: 'customer_name', header: 'Customer' }
    ],
    []
  );

  const exportFlatColumns = useMemo(
    () => [
      { field: 'order_no', header: 'Order' },
      { field: 'completed_at', header: 'Completed' },
      { field: 'total_amount', header: 'Total' },
      { field: 'tax_amount', header: 'Tax' },
      { field: 'cashier_name', header: 'Cashier' },
      { field: 'store_name', header: 'Store' },
      { field: 'customer_name', header: 'Customer' }
    ],
    []
  );

  const onExportCsv = () => {
    const exportRows = rows.map((r) => ({
      ...r,
      completed_at: formatIsoToDisplay(r.completed_at)
    }));
    downloadReportCsv(exportRows, exportFlatColumns, 'pos-sales');
  };

  const onExportPdf = useCallback(async () => {
    if (!rows.length) {
      return;
    }
    const head = exportFlatColumns.map((c) => c.header);
    const body = rows.map((r) => [
      r.order_no ?? '',
      formatIsoToDisplay(r.completed_at),
      formatInvoiceMoneyKes(r.total_amount),
      formatInvoiceMoneyKes(r.tax_amount),
      r.cashier_name ?? '',
      r.store_name ?? '',
      r.customer_name ?? ''
    ]);
    await downloadRowsPdf('POS sales summary', head, body, 'pos-sales');
  }, [rows, exportFlatColumns]);

  const kpiItems = useMemo(() => {
    const s = summary || {};
    const oc = Number(s.order_count) || 0;
    const gross = Number(s.gross_total) || 0;
    const gp = Number(s.gross_profit);
    const gpNum = Number.isFinite(gp) ? gp : 0;
    const avgOrder = oc > 0 ? gross / oc : 0;
    const avgProfitPerOrder = oc > 0 ? gpNum / oc : 0;
    const fmt = (v) => (v == null || v === '' ? '—' : formatInvoiceMoneyKes(v));

    return [
      {
        key: 'gross',
        label: 'Gross sales',
        value: fmt(s.gross_total),
        variant: 'info'
      },
      {
        key: 'net',
        label: 'Net sales',
        value: fmt(s.net_sales),
        variant: 'success'
      },
      {
        key: 'orders',
        label: 'Orders',
        value: String(oc),
        variant: 'orange',
        iconClassName: 'ti ti-shopping-cart fs-24'
      },
      {
        key: 'avg',
        label: 'Avg. order value',
        value: (
          <Fragment>
            <span className="d-block">{fmt(avgOrder)}</span>
            <small className="text-muted d-block fw-normal fs-6 mt-1">
              Gross profit {fmt(gpNum)}
              {' · '}
              Avg. profit/order {fmt(avgProfitPerOrder)}
            </small>
          </Fragment>
        ),
        variant: 'danger'
      }
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
        title="POS sales"
        subtitle="Completed POS orders in the selected period"
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
                <div className="col-md-4 d-none d-md-block" aria-hidden />
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
        tableTitle="POS sales"
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
