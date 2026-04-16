import { useCallback, useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";

import { fetchDashboardTopCategories } from "../../../tillflow/api/reports";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import { categoryDoughnutOptions } from "../dashboardChartConfigs.js";
import {
  DashboardDateFilterControls,
  useDashboardDateFilterParams
} from "./DashboardWidgetDateFilters.jsx";

const DOUGH_COLORS = ["#FE9F43", "#E04F16", "#092C4C", "#0E9384", "#6B7280", "#9333EA", "#0891B2", "#CA8A04"];

function formatQty(q) {
  const n = Number.parseFloat(String(q));
  if (Number.isNaN(n)) return String(q);
  return Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(2);
}

/**
 * Top Categories: POS units sold by catalog category + tenant category/product counts (TillFlow API).
 */
export default function DashboardTopCategoriesWidget({
  token,
  initialDatePreset = "week"
}) {
  const {
    period,
    setPeriod,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    apiParams,
    canFetch
  } = useDashboardDateFilterParams(initialDatePreset);

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ categories_count: 0, products_count: 0 });
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    if (!canFetch) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardTopCategories(token, { ...apiParams, limit: 8 });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotals({
        categories_count: Number(data?.totals?.categories_count ?? 0),
        products_count: Number(data?.totals?.products_count ?? 0)
      });
    } catch (e) {
      setError(e instanceof TillFlowApiError ? e.message : "Could not load top categories.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, canFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    const slice = rows.slice(0, 8);
    if (slice.length === 0) {
      return {
        labels: ["No data"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#E5E7EB"],
            borderWidth: 0,
            cutout: "50%"
          }
        ]
      };
    }
    return {
      labels: slice.map((r) => r.category_name),
      datasets: [
        {
          label: "Units sold",
          data: slice.map((r) => Number.parseFloat(String(r.units_sold)) || 0),
          backgroundColor: slice.map((_, i) => DOUGH_COLORS[i % DOUGH_COLORS.length]),
          borderWidth: 5,
          borderRadius: 10,
          hoverBorderWidth: 0,
          cutout: "50%"
        }
      ]
    };
  }, [rows]);

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);

  const doughnutOptions = useMemo(
    () => ({
      ...categoryDoughnutOptions,
      plugins: {
        ...categoryDoughnutOptions.plugins,
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.parsed;
              const row = rows[ctx.dataIndex];
              const rev = row?.revenue != null ? ` · ${row.revenue}` : "";
              return `${formatQty(v)} units${rev}`;
            }
          }
        }
      }
    }),
    [rows]
  );

  return (
    <>
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-inline-flex align-items-center">
            <span className="title-icon bg-soft-orange fs-16 me-2">
              <i className="ti ti-category" />
            </span>
            <h5 className="card-title mb-0">Top Categories</h5>
          </div>
          <DashboardDateFilterControls
            period={period}
            onPeriodChange={setPeriod}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />
        </div>
      </div>

      {!token ? (
        <div className="card-body">
          <p className="fs-13 text-muted mb-0">Sign in to TillFlow for category sales from the database.</p>
        </div>
      ) : loading && rows.length === 0 && !error ? (
        <div className="card-body py-4 text-center text-muted fs-13">Loading…</div>
      ) : error ? (
        <div className="card-body py-3">
          <p className="text-danger fs-13 mb-0">{error}</p>
        </div>
      ) : (
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-4 mb-4">
            <div>
              <Doughnut
                data={chartData}
                options={doughnutOptions}
                style={{
                  boxSizing: "border-box",
                  height: "230px",
                  width: "200px"
                }}
              />
            </div>
            <div>
              {topThree.length === 0 ? (
                <p className="fs-13 text-muted mb-0">No POS sales in this period.</p>
              ) : (
                topThree.map((r, i) => (
                  <div
                    key={`${r.category_id ?? "u"}-${r.category_name}-${i}`}
                    className={`category-item ${i === 0 ? "category-primary" : i === 1 ? "category-orange" : "category-secondary"}`}>
                    <p className="fs-13 mb-1">{r.category_name}</p>
                    <h2 className="d-flex align-items-center">
                      {formatQty(r.units_sold)}
                      <span className="fs-13 fw-normal text-default ms-1">Units</span>
                    </h2>
                  </div>
                ))
              )}
            </div>
          </div>
          <h6 className="mb-2">Category Statistics</h6>
          <div className="border br-8">
            <div className="d-flex align-items-center justify-content-between border-bottom p-2">
              <p className="d-inline-flex align-items-center mb-0">
                <i className="ti ti-square-rounded-filled text-indigo fs-8 me-2" />
                Total Number Of Categories
              </p>
              <h5>{totals.categories_count}</h5>
            </div>
            <div className="d-flex align-items-center justify-content-between p-2">
              <p className="d-inline-flex align-items-center mb-0">
                <i className="ti ti-square-rounded-filled text-orange fs-8 me-2" />
                Total Number Of Products
              </p>
              <h5>{totals.products_count}</h5>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
