import { useCallback, useEffect, useMemo, useState } from "react";
import { default as Chart } from "react-apexcharts";
import { Link } from "react-router-dom";

import { TillFlowApiError } from "../../../tillflow/api/errors";
import { fetchDashboardOverallInformation } from "../../../tillflow/api/reports";
import { customerChart } from "../dashboardChartConfigs.js";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" }
];

function formatDashboardCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) {
    return "—";
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return String(Math.round(num));
}

export default function DashboardOverallInformationWidget({
  token,
  initialPeriod = "week"
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError("");
    try {
      const json = await fetchDashboardOverallInformation(token, { period });
      setData(json);
    } catch (e) {
      setData(null);
      if (e instanceof TillFlowApiError) {
        setError(
          e.status === 403 ? `${e.message} (needs reports.view)` : e.message
        );
      } else {
        setError("Could not load overall information.");
      }
    }
  }, [token, period]);

  useEffect(() => {
    load();
  }, [load]);

  const periodLabel = useMemo(
    () => PERIODS.find((p) => p.key === period)?.label ?? "This week",
    [period]
  );

  const radialSeries = useMemo(() => {
    const s = data?.radial_series;
    if (Array.isArray(s) && s.length >= 2) {
      return [Number(s[0]) || 0, Number(s[1]) || 0];
    }
    return [0, 0];
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      ...customerChart,
      labels: ["Single visit", "Repeat"]
    }),
    []
  );

  const suppliers = data?.suppliers_count;
  const customers = data?.customers_count;
  const orders = data?.orders_count;
  const firstN = data?.customers_single_order_in_range;
  const repeatN = data?.customers_repeat_in_range;

  if (!token) {
    return (
      <>
        <div className="card-header">
          <div className="d-inline-flex align-items-center">
            <span className="title-icon bg-soft-info fs-16 me-2">
              <i className="ti ti-info-circle" />
            </span>
            <h5 className="card-title mb-0">Overall Information</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="fs-13 mb-0 text-muted">
            Sign in to TillFlow for live supplier, customer, and order stats.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="card-header">
        <div className="d-inline-flex align-items-center">
          <span className="title-icon bg-soft-info fs-16 me-2">
            <i className="ti ti-info-circle" />
          </span>
          <h5 className="card-title mb-0">Overall Information</h5>
        </div>
      </div>
      <div className="card-body">
        {error ? (
          <p className="fs-13 mb-0 text-danger">{error}</p>
        ) : (
          <div className="row g-3">
            <div className="col-md-4">
              <div className="info-item border bg-light p-3 text-center">
                <div className="mb-3 text-info fs-24">
                  <i className="ti ti-user-check" />
                </div>
                <p className="mb-1">Suppliers</p>
                <h5>{suppliers != null ? formatDashboardCount(suppliers) : "—"}</h5>
              </div>
            </div>
            <div className="col-md-4">
              <div className="info-item border bg-light p-3 text-center">
                <div className="mb-3 text-orange fs-24">
                  <i className="ti ti-users" />
                </div>
                <p className="mb-1">Customers</p>
                <h5>{customers != null ? formatDashboardCount(customers) : "—"}</h5>
              </div>
            </div>
            <div className="col-md-4">
              <div className="info-item border bg-light p-3 text-center">
                <div className="mb-3 text-teal fs-24">
                  <i className="ti ti-shopping-cart" />
                </div>
                <p className="mb-1">POS orders</p>
                <h5>{orders != null ? formatDashboardCount(orders) : "—"}</h5>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="card-footer pb-sm-0">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <h6 className="mb-0">Customers overview</h6>
          <div className="dropdown dropdown-wraper">
            <Link
              to="#"
              className="dropdown-toggle btn btn-sm"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              onClick={(e) => e.preventDefault()}>
              <i className="ti ti-calendar me-1" />
              {periodLabel}
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-3">
              {PERIODS.map((p) => (
                <li key={p.key}>
                  <Link
                    to="#"
                    className={`dropdown-item${period === p.key ? " active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setPeriod(p.key);
                    }}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="fs-11 text-muted mb-3 mt-2">
          In this period: customers with one POS order vs two or more (completed
          sales).
        </p>
        <div className="row align-items-center">
          <div className="col-sm-5">
            <div id="customer-chart">
              <Chart
                options={chartOptions}
                series={radialSeries}
                type="radialBar"
                height={130}
              />
            </div>
          </div>
          <div className="col-sm-7">
            <div className="row gx-0">
              <div className="col-sm-6">
                <div className="text-center border-end">
                  <h2 className="mb-1">
                    {firstN != null ? formatDashboardCount(firstN) : "—"}
                  </h2>
                  <p className="text-orange mb-2">Single visit</p>
                  <span className="fs-12 text-muted">
                    {radialSeries[0] != null ? `${radialSeries[0]}%` : ""}
                  </span>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="text-center">
                  <h2 className="mb-1">
                    {repeatN != null ? formatDashboardCount(repeatN) : "—"}
                  </h2>
                  <p className="text-teal mb-2">Repeat</p>
                  <span className="fs-12 text-muted">
                    {radialSeries[1] != null ? `${radialSeries[1]}%` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
