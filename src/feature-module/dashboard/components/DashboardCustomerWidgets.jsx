import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchDashboardTopCustomers, fetchTopCustomersArrears } from "../../../tillflow/api/reports";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import { customer11 as defaultCustomerAvatar } from "../../../utils/imagepath";
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

function DashboardCustomerRow({
  name,
  avatarUrl,
  subtitle,
  amount,
  last = false,
  nameTo
}) {
  const img = avatarUrl || defaultCustomerAvatar;
  const wrapClass = last
    ? "d-flex align-items-center justify-content-between flex-wrap gap-2"
    : "d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2";

  const title = (
    <h6 className="fs-14 fw-bold mb-1">
      {nameTo ? (
        <Link to={nameTo}>{name}</Link>
      ) : (
        <span>{name}</span>
      )}
    </h6>
  );

  const avatarEl = nameTo ? (
    <Link to={nameTo} className="avatar avatar-lg flex-shrink-0">
      <img src={img} alt="" />
    </Link>
  ) : (
    <span className="avatar avatar-lg flex-shrink-0">
      <img src={img} alt="" />
    </span>
  );

  return (
    <div className={wrapClass}>
      <div className="d-flex align-items-center">
        {avatarEl}
        <div className="ms-2">
          {title}
          <div className="d-flex align-items-center flex-wrap item-list gap-2">{subtitle}</div>
        </div>
      </div>
      <div className="text-end">
        <h5 className="mb-0">{amount}</h5>
      </div>
    </div>
  );
}

/**
 * Top customers by POS + invoiced revenue (TillFlow API).
 */
export function DashboardTopCustomersWidget({
  token,
  limit = 5,
  customerNameLinkBase,
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
      const data = await fetchDashboardTopCustomers(token, { ...apiParams, limit });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(e instanceof TillFlowApiError ? e.message : "Could not load top customers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, limit, apiParams, canFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameTo = customerNameLinkBase;
  const empty = !loading && !error && rows.length === 0;

  const body = useMemo(
    () =>
      rows.map((r, i) => (
        <DashboardCustomerRow
          key={r.customer_id ?? i}
          name={r.customer_name ?? "—"}
          avatarUrl={r.avatar_url}
          nameTo={nameTo}
          last={i === rows.length - 1}
          subtitle={
            <p className="fs-13 mb-0 text-muted">
              {r.transaction_count}{" "}
              {r.transaction_count === 1 ? "transaction" : "transactions"}
              {r.pos_orders > 0 || r.invoices > 0 ? (
                <span className="text-gray-6">
                  {" "}
                  ({r.pos_orders ?? 0} POS · {r.invoices ?? 0} inv.)
                </span>
              ) : null}
            </p>
          }
          amount={formatMoney(r.total_spend)}
        />
      )),
    [rows, nameTo]
  );

  if (!token) {
    return null;
  }

  return (
    <>
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-inline-flex align-items-center">
            <span className="title-icon bg-soft-orange fs-16 me-2">
              <i className="ti ti-users" />
            </span>
            <h5 className="card-title mb-0">Top Customers</h5>
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
      ) : empty ? (
        <div className="card-body py-4 text-center text-muted fs-13">No data for this period.</div>
      ) : (
        <div className="card-body">{body}</div>
      )}
    </>
  );
}

/**
 * Top customers by unpaid invoice balance (TillFlow API).
 */
export function DashboardPendingPaymentsWidget({
  token,
  limit = 5,
  customerNameLinkBase,
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
      const data = await fetchTopCustomersArrears(token, { ...apiParams, limit });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(
        e instanceof TillFlowApiError ? e.message : "Could not load pending balances."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, limit, apiParams, canFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameTo = customerNameLinkBase;
  const empty = !loading && !error && rows.length === 0;

  const body = useMemo(
    () =>
      rows.map((r, i) => (
        <DashboardCustomerRow
          key={r.customer_id ?? i}
          name={r.customer_name ?? "—"}
          avatarUrl={r.avatar_url}
          nameTo={nameTo}
          last={i === rows.length - 1}
          subtitle={
            <>
              <span className="fs-13 mb-0">
                {r.unpaid_invoices} unpaid
                <span className="text-muted ms-1">
                  · {r.overdue_invoices ?? 0} overdue · {r.partially_paid_invoices ?? 0}{" "}
                  partial
                </span>
              </span>
            </>
          }
          amount={formatMoney(r.total_pending)}
        />
      )),
    [rows, nameTo]
  );

  if (!token) {
    return null;
  }

  return (
    <>
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-inline-flex align-items-center">
            <span className="title-icon bg-soft-danger fs-16 me-2">
              <i className="ti ti-alert-circle" />
            </span>
            <h5 className="card-title mb-0">Top unpaid</h5>
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
      ) : empty ? (
        <div className="card-body py-4 text-center text-muted fs-13">
          No outstanding balances in this period.
        </div>
      ) : (
        <div className="card-body">{body}</div>
      )}
    </>
  );
}
