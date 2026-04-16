import { useCallback, useEffect, useState } from "react";

import { fetchBestSellers } from "../../../tillflow/api/reports";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import { product1 as defaultProductImg } from "../../../utils/imagepath";
import {
  DashboardDateFilterControls,
  useDashboardDateFilterParams
} from "./DashboardWidgetDateFilters.jsx";

const moneyFmt = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function formatMoney(amountStr) {
  const n = Number.parseFloat(String(amountStr));
  if (Number.isNaN(n)) return amountStr;
  return moneyFmt.format(n);
}

function formatQty(q) {
  const n = Number.parseFloat(String(q));
  if (Number.isNaN(n)) return String(q);
  return Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(2);
}

/**
 * Top products by POS line revenue (TillFlow API /reports/best-sellers).
 */
export default function DashboardTopSellingProductsWidget({
  token,
  limit = 5,
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
      const data = await fetchBestSellers(token, { ...apiParams, limit });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(e instanceof TillFlowApiError ? e.message : "Could not load top products.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, limit, canFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) {
    return (
      <div className="card-body">
        <p className="fs-13 text-muted mb-0">Sign in to TillFlow for top selling products from the database.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-inline-flex align-items-center">
            <span className="title-icon bg-soft-pink fs-16 me-2">
              <i className="ti ti-box" />
            </span>
            <h5 className="card-title mb-0">Top Selling</h5>
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
      {loading && rows.length === 0 && !error ? (
        <div className="card-body py-4 text-center text-muted fs-13">Loading…</div>
      ) : error ? (
        <div className="card-body py-3">
          <p className="text-danger fs-13 mb-0">{error}</p>
        </div>
      ) : (
        <div className="card-body sell-product">
          {rows.length === 0 ? (
            <p className="fs-13 text-muted mb-0 text-center py-2">No POS sales in this period.</p>
          ) : (
            rows.map((r, i) => {
              const img = r.image_url || defaultProductImg;
              const margin = Number.parseFloat(String(r.margin_percent ?? "0"));
              const positive = !Number.isNaN(margin) && margin >= 0;
              const last = i === rows.length - 1;
              const rowClass = last
                ? "d-flex align-items-center justify-content-between"
                : "d-flex align-items-center justify-content-between border-bottom";

              return (
                <div key={r.product_id ?? i} className={rowClass}>
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-lg">
                      <img src={img} alt="" />
                    </span>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">{r.product_name ?? "—"}</h6>
                      <div className="d-flex align-items-center item-list">
                        <p>{formatMoney(r.revenue)}</p>
                        <p>{formatQty(r.qty_sold)}+ sold</p>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`badge ${positive ? "bg-outline-success" : "bg-outline-danger"} badge-xs d-inline-flex align-items-center`}
                    title="Estimated margin on revenue (POS lines)">
                    <i
                      className={`ti ${positive ? "ti-arrow-up-left" : "ti-arrow-down-left"} me-1`}
                    />
                    {Number.isNaN(margin) ? "—" : `${Math.abs(margin)}%`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
