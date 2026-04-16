import { DatePicker, Popover } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";

import { fetchDashboardSalesPurchase } from "../../../tillflow/api/reports";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import { salesDayChart } from "../dashboardChartConfigs.js";
import DashboardSectionCard from "./DashboardSectionCard.jsx";

const { RangePicker } = DatePicker;

const PERIODS = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" }
];

const moneyFmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatKes(amountStr) {
  const n = Number.parseFloat(String(amountStr));
  if (Number.isNaN(n)) return amountStr;
  return moneyFmt.format(n);
}

function formatAxis(val) {
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Visual range for the range picker; aligned with backend `buildSalesPurchaseBuckets` windows. */
function rangeForSalesPurchasePeriod(periodKey) {
  const n = dayjs();
  switch (periodKey) {
    case "1d":
    case "1w":
      return [n.subtract(6, "day").startOf("day"), n.endOf("day")];
    case "1m":
      return [n.subtract(29, "day").startOf("day"), n.endOf("day")];
    case "3m":
      return [n.subtract(89, "day").startOf("day"), n.endOf("day")];
    case "6m": {
      const from = n.subtract(5, "month").startOf("month");
      return [from, n.endOf("day")];
    }
    case "1y":
    default:
      return [n.subtract(11, "month").startOf("month"), n.endOf("day")];
  }
}

/** Map a chosen calendar range to the nearest supported API period. */
function nearestPeriodForRange(start, end) {
  if (!start || !end) return "1y";
  const days = end.endOf("day").diff(start.startOf("day"), "day") + 1;
  if (days <= 7) return "1w";
  if (days <= 31) return "1m";
  if (days <= 93) return "3m";
  if (days <= 186) return "6m";
  return "1y";
}

function salesPurchaseRangePresets() {
  const n = dayjs();
  return [
    {
      label: "Last 7 days",
      value: [n.subtract(6, "day").startOf("day"), n.endOf("day")]
    },
    {
      label: "Last 30 days",
      value: [n.subtract(29, "day").startOf("day"), n.endOf("day")]
    },
    {
      label: "Last 90 days",
      value: [n.subtract(89, "day").startOf("day"), n.endOf("day")]
    },
    {
      label: "Last 6 months",
      value: [n.subtract(5, "month").startOf("month"), n.endOf("day")]
    },
    {
      label: "Last 12 months",
      value: [n.subtract(11, "month").startOf("month"), n.endOf("day")]
    }
  ];
}

/**
 * Sales, Purchases, expenses & Profit line chart; live from TillFlow reports API when `token` is set.
 * Calls `onKpi` with `kpi` object whenever data loads (for parent KPI cards).
 *
 * Optional controlled mode: pass `period` + `onPeriodChange` so the parent can align other widgets (e.g. profit).
 */
export default function DashboardSalesPurchaseSection({
  token = null,
  onKpi = null,
  period: periodProp,
  onPeriodChange = null
}) {
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState("6m");
  const controlled = periodProp !== undefined;
  const period = controlled ? periodProp : uncontrolledPeriod;
  const setPeriod = useCallback(
    (p) => {
      if (controlled) {
        onPeriodChange?.(p);
      } else {
        setUncontrolledPeriod(p);
      }
    },
    [controlled, onPeriodChange]
  );
  const [chartPayload, setChartPayload] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const onKpiRef = useRef(onKpi);
  onKpiRef.current = onKpi;

  const rangePickerValue = useMemo(() => {
    const [from, to] = rangeForSalesPurchasePeriod(period);
    return [from, to];
  }, [period]);

  const load = useCallback(async () => {
    if (!token) {
      setChartPayload(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardSalesPurchase(token, { period });
      if (typeof onKpiRef.current === "function" && data?.kpi) {
        onKpiRef.current(data.kpi);
      }
      setChartPayload(data?.chart ?? null);
    } catch (e) {
      setChartPayload(null);
      setError(e instanceof TillFlowApiError ? e.message : "Could not load sales & purchase chart.");
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartOptions = useMemo(() => {
    const labels = chartPayload?.labels?.length
      ? chartPayload.labels
      : salesDayChart.xaxis.categories;

    return {
      chart: {
        type: "line",
        height: 245,
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      /** Series order: Sales, Purchase, Expenses, Profit (est.) */
      colors: ["#2563eb", "#9333ea", "#ef4444", "#22c55e"],
      stroke: {
        curve: "smooth",
        width: 2
      },
      markers: {
        size: 3,
        strokeColors: "#fff",
        strokeWidth: 1,
        hover: { size: 5 }
      },
      dataLabels: { enabled: false },
      grid: salesDayChart.grid,
      xaxis: {
        categories: labels,
        labels: {
          ...salesDayChart.xaxis.labels,
          rotate: labels.length > 14 ? -35 : 0,
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        labels: {
          formatter: formatAxis,
          offsetX: -15,
          style: {
            colors: "#6B7280",
            fontSize: "13px"
          }
        }
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "right"
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (val) => formatKes(String(val ?? 0))
        }
      }
    };
  }, [chartPayload]);

  const series = useMemo(() => {
    if (chartPayload?.sales?.length) {
      const n = chartPayload.sales.length;
      const profitData =
        Array.isArray(chartPayload.profit) && chartPayload.profit.length === n
          ? chartPayload.profit
          : chartPayload.sales.map(() => 0);
      return [
        { name: "Sales", data: chartPayload.sales },
        { name: "Purchase", data: chartPayload.purchases },
        { name: "Expenses", data: chartPayload.expenses },
        { name: "Profit (est.)", data: profitData }
      ];
    }
    const z = salesDayChart.series[0].data.map(() => 0);
    return [
      salesDayChart.series[0],
      salesDayChart.series[1],
      { name: "Expenses", data: z },
      { name: "Profit (est.)", data: z }
    ];
  }, [chartPayload]);

  const totals = useMemo(() => {
    if (chartPayload?.totals) {
      return chartPayload.totals;
    }
    const sum = (idx) =>
      salesDayChart.series[idx].data.reduce((a, b) => a + Number(b), 0);
    return {
      sales: String(sum(0)),
      purchases: String(sum(1)),
      expenses: "0",
      profit: "0"
    };
  }, [chartPayload]);

  return (
    <div className="col-xxl-8 col-xl-7 col-sm-12 col-12 d-flex">
      <DashboardSectionCard
        title="Sales, Purchases, expenses & Profit"
        titleIconClass="bg-soft-primary"
        titleIcon="ti ti-shopping-cart"
        bodyClassName="pb-0"
        headerRight={
          <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0 flex-wrap justify-content-end">
            <div
              className="overflow-x-auto"
              style={{ WebkitOverflowScrolling: "touch", maxWidth: "min(100%, 70vw)" }}>
              <ul className="nav btn-group custom-btn-group flex-nowrap mb-0">
                {PERIODS.map((p) => (
                  <li key={p.key} className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-outline-light${
                        period === p.key ? " active" : ""
                      }`}
                      onClick={() => setPeriod(p.key)}>
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {token ? (
              <Popover
                placement="bottomRight"
                trigger="click"
                open={calendarOpen}
                onOpenChange={setCalendarOpen}
                destroyOnHidden
                overlayClassName="dashboard-widget-range-popover"
                content={
                  <div className="py-1" style={{ minWidth: 280 }}>
                    <RangePicker
                      size="small"
                      className="w-100"
                      format="DD MMM YYYY"
                      value={rangePickerValue}
                      presets={salesPurchaseRangePresets()}
                      allowClear={false}
                      getPopupContainer={() => document.body}
                      onChange={(dates) => {
                        if (dates?.[0] && dates?.[1]) {
                          setPeriod(
                            nearestPeriodForRange(dates[0], dates[1])
                          );
                          setCalendarOpen(false);
                        }
                      }}
                    />
                  </div>
                }>
                <button
                  type="button"
                  className="btn btn-sm btn-white d-inline-flex align-items-center justify-content-center px-2 flex-shrink-0"
                  title="Pick a date range"
                  aria-label="Pick a date range"
                  aria-haspopup="dialog">
                  <i className="ti ti-calendar" />
                </button>
              </Popover>
            ) : null}
          </div>
        }>
        {loading ? (
          <div className="py-4 text-center text-muted fs-13">Loading chart…</div>
        ) : error ? (
          <div className="py-3 px-3">
            <p className="text-danger fs-13 mb-0">{error}</p>
          </div>
        ) : (
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="border p-2 br-8">
                <p className="d-inline-flex align-items-center mb-1">
                  <i
                    className="ti ti-circle-filled fs-8 me-1"
                    style={{ color: "#2563eb" }}
                  />
                  Total Sales
                </p>
                <h4 className="mb-0">{formatKes(totals.sales)}</h4>
              </div>
              <div className="border p-2 br-8">
                <p className="d-inline-flex align-items-center mb-1">
                  <i
                    className="ti ti-circle-filled fs-8 me-1"
                    style={{ color: "#9333ea" }}
                  />
                  Total Purchase
                </p>
                <h4 className="mb-0">{formatKes(totals.purchases)}</h4>
              </div>
              <div className="border p-2 br-8">
                <p className="d-inline-flex align-items-center mb-1">
                  <i
                    className="ti ti-circle-filled fs-8 me-1"
                    style={{ color: "#ef4444" }}
                  />
                  Total Expenses
                </p>
                <h4 className="mb-0">{formatKes(totals.expenses)}</h4>
              </div>
              <div className="border p-2 br-8">
                <p className="d-inline-flex align-items-center mb-1">
                  <i
                    className="ti ti-circle-filled fs-8 me-1"
                    style={{ color: "#22c55e" }}
                  />
                  Profit (est.)
                </p>
                <h4 className="mb-0">
                  {formatKes(totals.profit != null ? totals.profit : "0")}
                </h4>
              </div>
            </div>
            <div id="sales-daychart">
              <Chart options={chartOptions} series={series} type="line" height={245} />
            </div>
          </div>
        )}
      </DashboardSectionCard>
    </div>
  );
}
