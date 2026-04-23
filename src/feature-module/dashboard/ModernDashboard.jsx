import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { default as Chart } from "react-apexcharts";
import { Link } from "react-router-dom";

import {
  fetchDashboardSalesPurchase,
  fetchInvoiceRegister,
  fetchOutstandingInvoices,
  fetchProposalsReport
} from "../../tillflow/api/reports";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from "chart.js";
import { all_routes } from "../../routes/all_routes";
import {
    customer16,
    product11,
    product12,
    product13,
    product14,
    product15
} from "../../utils/imagepath";

import CommonFooter from "../../components/footer/commonFooter";
import DashboardLowStockBanner from "./components/DashboardLowStockBanner.jsx";
import DashboardOverallInformationWidget from "./components/DashboardOverallInformationWidget.jsx";
import DashboardSectionCard from "./components/DashboardSectionCard.jsx";
import {
  DashboardPendingPaymentsWidget,
  DashboardTopCustomersWidget
} from "./components/DashboardCustomerWidgets.jsx";
import DashboardTopCategoriesWidget from "./components/DashboardTopCategoriesWidget.jsx";
import DashboardTopSellingProductsWidget from "./components/DashboardTopSellingProductsWidget.jsx";
import DashboardRecentTransactionsWidget from "./components/DashboardRecentTransactionsWidget.jsx";
import DashboardSalesPurchaseSection from "./components/DashboardSalesPurchaseSection.jsx";
import RevenueMetricCard from "./components/RevenueMetricCard.jsx";
import SaleMetricCard from "./components/SaleMetricCard.jsx";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);
const kesFmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function fmtKes(amountStr) {
  const n = Number.parseFloat(String(amountStr));
  if (Number.isNaN(n)) return amountStr;
  return kesFmt.format(n);
}

/** Calendar month-to-date (start of month → today), for `dashboard-sales-purchase` `from`/`to`. */
function currentMonthToDateRange() {
  const n = dayjs();
  return {
    from: n.startOf("month").format("YYYY-MM-DD"),
    to: n.format("YYYY-MM-DD")
  };
}

/** Sum balance_due by invoice status; also count invoices with balance due (matches register semantics). */
function summarizeOutstandingFromRows(rows) {
  let unpaid = 0;
  let partial = 0;
  let overdue = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let overdueCount = 0;
  for (const r of rows) {
    const st = String(r.status ?? "").trim();
    const bal = Number.parseFloat(String(r.balance_due ?? r.balance ?? 0));
    if (!Number.isFinite(bal) || bal <= 0) continue;
    if (st === "Partially_paid") {
      partial += bal;
      partialCount += 1;
    } else if (st === "Overdue") {
      overdue += bal;
      overdueCount += 1;
    } else if (st === "Unpaid") {
      unpaid += bal;
      unpaidCount += 1;
    }
  }
  const total = unpaid + partial + overdue;
  return {
    unpaid,
    partial,
    overdue,
    total,
    unpaidCount,
    partialCount,
    overdueCount
  };
}

/**
 * Normalize `/reports/outstanding-invoices` payload: summary object and/or invoice rows.
 */
function normalizeOutstandingPayload(data) {
  if (data == null || typeof data !== "object") {
    return null;
  }
  const s =
    data.summary && typeof data.summary === "object" ? data.summary : data;
  const u = s.unpaid_balance ?? s.unpaid_total ?? s.total_unpaid;
  const p = s.partial_balance ?? s.partial_total ?? s.partially_paid_balance;
  const o = s.overdue_balance ?? s.overdue_total ?? s.total_overdue;
  const t = s.total_outstanding ?? s.total_balance_due ?? s.total;

  if (u != null && p != null && String(u).trim() !== "" && String(p).trim() !== "") {
    const uNum = Number.parseFloat(String(u));
    const pNum = Number.parseFloat(String(p));
    if (Number.isFinite(uNum) && Number.isFinite(pNum)) {
      let oNum =
        o != null && String(o).trim() !== ""
          ? Number.parseFloat(String(o))
          : Number.NaN;
      if (!Number.isFinite(oNum)) {
        if (t != null && String(t).trim() !== "") {
          const tNum = Number.parseFloat(String(t));
          if (Number.isFinite(tNum)) {
            oNum = Math.max(0, tNum - uNum - pNum);
          } else {
            oNum = 0;
          }
        } else {
          oNum = 0;
        }
      }
      const totRaw =
        t != null && String(t).trim() !== ""
          ? Number.parseFloat(String(t))
          : uNum + pNum + oNum;
      const uc = Number.parseInt(String(s.unpaid_count ?? s.unpaid_invoice_count ?? 0), 10);
      const pc = Number.parseInt(String(s.partial_count ?? s.partially_paid_count ?? 0), 10);
      const oc = Number.parseInt(String(s.overdue_count ?? s.overdue_invoice_count ?? 0), 10);
      const base = {
        unpaid: uNum,
        partial: pNum,
        overdue: oNum,
        total: Number.isFinite(totRaw) ? totRaw : uNum + pNum + oNum,
        unpaidCount: Number.isFinite(uc) ? uc : 0,
        partialCount: Number.isFinite(pc) ? pc : 0,
        overdueCount: Number.isFinite(oc) ? oc : 0
      };
      const rowsEarly = data.invoices ?? data.rows ?? data.data;
      if (Array.isArray(rowsEarly) && rowsEarly.length > 0) {
        const fromRows = summarizeOutstandingFromRows(rowsEarly);
        return {
          ...base,
          unpaidCount: fromRows.unpaidCount,
          partialCount: fromRows.partialCount,
          overdueCount: fromRows.overdueCount
        };
      }
      return base;
    }
  }

  const rows = data.invoices ?? data.rows ?? data.data;
  if (Array.isArray(rows) && rows.length > 0) {
    return summarizeOutstandingFromRows(rows);
  }

  if (t != null && String(t).trim() !== "") {
    const tot = Number.parseFloat(String(t));
    if (Number.isFinite(tot)) {
      return {
        unpaid: tot,
        partial: 0,
        overdue: 0,
        total: tot,
        unpaidCount: 0,
        partialCount: 0,
        overdueCount: 0
      };
    }
  }
  return {
    unpaid: 0,
    partial: 0,
    overdue: 0,
    total: 0,
    unpaidCount: 0,
    partialCount: 0,
    overdueCount: 0
  };
}

/** Same date window as `DashboardSalesPurchaseSection` / chart period. */
function salesPurchasePeriodToDateRange(periodKey) {
  const n = dayjs();
  switch (periodKey) {
    case "1d":
    case "1w":
      return {
        from: n.subtract(6, "day").startOf("day").format("YYYY-MM-DD"),
        to: n.endOf("day").format("YYYY-MM-DD")
      };
    case "1m":
      return {
        from: n.subtract(29, "day").startOf("day").format("YYYY-MM-DD"),
        to: n.endOf("day").format("YYYY-MM-DD")
      };
    case "3m":
      return {
        from: n.subtract(89, "day").startOf("day").format("YYYY-MM-DD"),
        to: n.endOf("day").format("YYYY-MM-DD")
      };
    case "6m":
      return {
        from: n.subtract(5, "month").startOf("month").format("YYYY-MM-DD"),
        to: n.endOf("day").format("YYYY-MM-DD")
      };
    case "1y":
    default:
      return {
        from: n.subtract(11, "month").startOf("month").format("YYYY-MM-DD"),
        to: n.endOf("day").format("YYYY-MM-DD")
      };
  }
}

/** Sum cash received: prefer `amount_paid`, else invoice total (register row). */
function sumRegisterAmountPaidFromRows(rows) {
  return rows.reduce((acc, r) => {
    const ap = Number.parseFloat(String(r.amount_paid ?? ""));
    if (Number.isFinite(ap)) {
      return acc + ap;
    }
    const v = Number.parseFloat(String(r.total_amount ?? r.amount ?? 0));
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

/** Parse invoice-register response (summary and/or rows). `total` is amount paid / received. */
function parsePaidInvoicesFromRegister(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const s = data.summary ?? {};
  const rows = Array.isArray(data.rows)
    ? data.rows
    : Array.isArray(data.data)
      ? data.data
      : [];
  const meta = data.meta ?? data.pagination ?? {};
  const countRaw =
    s.paid_invoice_count ??
    s.invoice_count ??
    s.count ??
    meta.total ??
    meta.total_count ??
    (rows.length > 0 ? rows.length : 0);

  let total;
  if (rows.length > 0) {
    total = sumRegisterAmountPaidFromRows(rows);
  } else {
    const raw =
      s.total_amount_paid ??
      s.total_paid_amount ??
      s.total_paid ??
      s.total_invoice_amount ??
      s.total_amount;
    total = raw == null ? 0 : Number.parseFloat(String(raw));
    if (!Number.isFinite(total)) {
      total = 0;
    }
  }

  const count = Number.parseInt(String(countRaw ?? 0), 10) || 0;
  return { count, total };
}

/** Single `/reports/proposals` payload for both proposal widgets (r3 + r4). */
function parseProposalsReportForDashboard(data) {
  const s = data?.summary ?? {};
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.data) ? data.data : [];

  const summaryUsable =
    s.count != null ||
    s.total_amount != null ||
    s.sent_count != null ||
    s.accepted_count != null ||
    s.draft_count != null ||
    s.expired_count != null ||
    s.declined_count != null ||
    (s.accepted_total_amount != null && String(s.accepted_total_amount).trim() !== "");

  if (summaryUsable || rows.length === 0) {
    const sent = Number.parseInt(String(s.sent_count ?? 0), 10) || 0;
    const accepted = Number.parseInt(String(s.accepted_count ?? 0), 10) || 0;
    let acceptedTotal = Number.parseFloat(String(s.accepted_total_amount ?? 0));
    if (!Number.isFinite(acceptedTotal)) {
      acceptedTotal = 0;
    }
    const draft = Number.parseInt(String(s.draft_count ?? 0), 10) || 0;
    const declined = Number.parseInt(String(s.declined_count ?? 0), 10) || 0;
    const expired = Number.parseInt(String(s.expired_count ?? 0), 10) || 0;
    const totalCount = Number.parseInt(String(s.count ?? 0), 10) || 0;
    let totalAmount = Number.parseFloat(String(s.total_amount ?? 0));
    if (!Number.isFinite(totalAmount)) {
      totalAmount = 0;
    }
    return {
      sent,
      accepted,
      acceptedTotal,
      draft,
      declined,
      expired,
      totalCount,
      totalAmount
    };
  }

  let sent = 0;
  let accepted = 0;
  let acceptedTotal = 0;
  let draft = 0;
  let declined = 0;
  let expired = 0;
  let totalAmount = 0;
  for (const r of rows) {
    const st = String(r.status ?? "").trim();
    const amt = Number.parseFloat(String(r.total_amount ?? 0));
    const a = Number.isFinite(amt) ? amt : 0;
    totalAmount += a;
    if (st === "Sent") {
      sent += 1;
    }
    if (st === "Draft") {
      draft += 1;
    }
    if (st === "Declined") {
      declined += 1;
    }
    if (st === "Expired") {
      expired += 1;
    }
    if (st === "Accepted") {
      accepted += 1;
      acceptedTotal += a;
    }
  }
  return {
    sent,
    accepted,
    acceptedTotal,
    draft,
    declined,
    expired,
    totalCount: rows.length,
    totalAmount
  };
}

const TF_INVOICE_REPORT = "/admin/reports/invoice-report";
const TF_PROPOSALS = "/admin/proposals";
const DASHBOARD_BREAKDOWN_LINK =
  "fs-11 link-secondary link-underline link-underline-opacity-50";
/** Bold status label before the count in second-row KPI breakdowns. */
const BD_STATUS = "fw-bold";

/** Draft → Sent → Accepted → Expired; omits statuses with count 0. */
function renderProposalStatusBreakdown(stat) {
  const items = [
    { status: "Draft", label: "Draft", count: Number(stat?.draft) || 0 },
    { status: "Sent", label: "Sent", count: Number(stat?.sent) || 0 },
    { status: "Accepted", label: "Accepted", count: Number(stat?.accepted) || 0 },
    { status: "Expired", label: "Expired", count: Number(stat?.expired) || 0 }
  ].filter((x) => x.count > 0);

  if (items.length === 0) {
    return <span className="fs-11 text-muted">—</span>;
  }

  return (
    <span className="fs-11 text-muted">
      {items.map((item, i) => (
        <span key={item.status}>
          {i > 0 ? ", " : null}
          <Link
            to={`${TF_PROPOSALS}?status=${encodeURIComponent(item.status)}`}
            className={DASHBOARD_BREAKDOWN_LINK}>
            <span className={BD_STATUS}>{item.label}</span>{" "}
            <span className="text-gray-9 fw-medium">{item.count}</span>
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Unpaid → Partially unpaid → Overdue; omits statuses with count 0. */
function renderOutstandingStatusBreakdown(ar) {
  const items = [
    { status: "Unpaid", label: "Unpaid", count: Number(ar?.unpaidCount) || 0 },
    {
      status: "Partially_paid",
      label: "Partially unpaid",
      count: Number(ar?.partialCount) || 0
    },
    { status: "Overdue", label: "Overdue", count: Number(ar?.overdueCount) || 0 }
  ].filter((x) => x.count > 0);

  if (items.length === 0) {
    return <span className="fs-11 text-muted">—</span>;
  }

  return (
    <span className="fs-11 text-muted">
      {items.map((item, i) => (
        <span key={item.status}>
          {i > 0 ? ", " : null}
          <Link
            to={`${TF_INVOICE_REPORT}?status=${encodeURIComponent(item.status)}`}
            className={DASHBOARD_BREAKDOWN_LINK}>
            <span className={BD_STATUS}>{item.label}</span>{" "}
            <span className="text-gray-9 fw-medium">{item.count}</span>
          </Link>
        </span>
      ))}
    </span>
  );
}

const ModernDashboard = ({
  hideFooter = false,
  hideRecentSales = false,
  tillflowToken = null,
  customerListPath = null,
  stockAdjustmentPath = "/admin/stock-adjustment",
  lowStockListPath = "/admin/low-stock"
}) => {
  const route = all_routes;
  const customersPath = customerListPath || route.customer;
  /** TillFlow admin (`/admin`): default period is monthly; retail demo stays weekly. */
  const dashboardDatePreset = tillflowToken ? "month" : "week";
  const [salesPurchasePeriod, setSalesPurchasePeriod] = useState("6m");
  const [salesPurchaseKpi, setSalesPurchaseKpi] = useState(null);
  /** First-row KPIs: month-to-date sales, purchases, expenses, profit (TillFlow only). */
  const [monthToDateKpi, setMonthToDateKpi] = useState(null);
  /**
   * Outstanding receivables: `undefined` loading, `null` error; amounts + per-status invoice counts.
   */
  const [outstandingAr, setOutstandingAr] = useState(undefined);
  /**
   * Paid + partially paid register (period): `undefined` loading, `null` error;
   * `total` / `partialTotal` are amount received (`amount_paid` when present).
   */
  const [paidInvoicesStat, setPaidInvoicesStat] = useState(undefined);
  /**
   * Proposals report: r3 (accepted) + r4 (pipeline); same API response.
   */
  const [proposalsStat, setProposalsStat] = useState(undefined);
  /**
   * First catalog row: two half-width cols when only Top Selling + Top Customers;
   * three equal cols when Recent Sales or Top unpaid is shown.
   */
  const catalogRowColClass =
    hideRecentSales && !tillflowToken
      ? "col-xxl-6 col-md-6 d-flex"
      : "col-xxl-4 col-md-6 d-flex";

  useEffect(() => {
    if (!tillflowToken) {
      setOutstandingAr(undefined);
      return;
    }
    let cancelled = false;
    setOutstandingAr(undefined);
    (async () => {
      try {
        const data = await fetchOutstandingInvoices(tillflowToken);
        if (cancelled) {
          return;
        }
        const n = normalizeOutstandingPayload(data);
        setOutstandingAr(
          n ?? {
            unpaid: 0,
            partial: 0,
            overdue: 0,
            total: 0,
            unpaidCount: 0,
            partialCount: 0,
            overdueCount: 0
          }
        );
      } catch {
        if (!cancelled) {
          setOutstandingAr(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tillflowToken]);

  useEffect(() => {
    if (!tillflowToken) {
      setPaidInvoicesStat(undefined);
      return;
    }
    let cancelled = false;
    setPaidInvoicesStat(undefined);
    (async () => {
      try {
        const { from, to } = salesPurchasePeriodToDateRange(salesPurchasePeriod);
        const base = { from, to };
        const [paidRes, partialRes] = await Promise.all([
          fetchInvoiceRegister(tillflowToken, { ...base, status: "Paid" }),
          fetchInvoiceRegister(tillflowToken, { ...base, status: "Partially_paid" })
        ]);
        if (cancelled) {
          return;
        }
        const paid = parsePaidInvoicesFromRegister(paidRes) ?? { count: 0, total: 0 };
        const partial = parsePaidInvoicesFromRegister(partialRes) ?? { count: 0, total: 0 };
        setPaidInvoicesStat({
          count: paid.count,
          total: paid.total,
          partialCount: partial.count,
          partialTotal: partial.total
        });
      } catch {
        if (!cancelled) {
          setPaidInvoicesStat(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tillflowToken, salesPurchasePeriod]);

  useEffect(() => {
    if (!tillflowToken) {
      setProposalsStat(undefined);
      return;
    }
    let cancelled = false;
    setProposalsStat(undefined);
    (async () => {
      try {
        const { from, to } = salesPurchasePeriodToDateRange(salesPurchasePeriod);
        const data = await fetchProposalsReport(tillflowToken, { from, to });
        if (cancelled) {
          return;
        }
        const parsed = parseProposalsReportForDashboard(data);
        setProposalsStat(
          parsed ?? {
            sent: 0,
            accepted: 0,
            acceptedTotal: 0,
            draft: 0,
            declined: 0,
            expired: 0,
            totalCount: 0,
            totalAmount: 0
          }
        );
      } catch {
        if (!cancelled) {
          setProposalsStat(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tillflowToken, salesPurchasePeriod]);

  useEffect(() => {
    if (!tillflowToken) {
      setMonthToDateKpi(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const range = currentMonthToDateRange();
        const data = await fetchDashboardSalesPurchase(tillflowToken, range);
        if (cancelled) {
          return;
        }
        setMonthToDateKpi(data?.kpi ?? null);
      } catch {
        if (!cancelled) {
          setMonthToDateKpi(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tillflowToken]);

  const saleMetrics = useMemo(() => {
    const mtdSubtitle = dayjs().format("MMMM YYYY");
    const trendNone = {
      trendDirection: "up",
      trendLabel: null,
      trendBadgeVariant: "primary"
    };

    if (tillflowToken && !monthToDateKpi) {
      return [
        {
          key: "s1",
          variant: "primary",
          iconClassName: "ti ti-file-text",
          title: "Total Sales",
          subtitle: mtdSubtitle,
          value: "—",
          ...trendNone
        },
        {
          key: "s2",
          variant: "teal",
          iconClassName: "ti ti-gift",
          title: "Total Purchases",
          subtitle: mtdSubtitle,
          value: "—",
          ...trendNone
        },
        {
          key: "s3",
          variant: "info",
          iconClassName: "ti ti-receipt",
          title: "Total Expenses",
          subtitle: mtdSubtitle,
          value: "—",
          ...trendNone
        },
        {
          key: "s4",
          variant: "success",
          iconClassName: "ti ti-trending-up",
          title: "Total Profit",
          subtitle: mtdSubtitle,
          value: "—",
          ...trendNone
        }
      ];
    }
    if (tillflowToken && monthToDateKpi) {
      const k = monthToDateKpi;
      const fmt = (v) => (v != null ? fmtKes(v) : "—");
      return [
        {
          key: "s1",
          variant: "primary",
          iconClassName: "ti ti-file-text",
          title: "Total Sales",
          subtitle: mtdSubtitle,
          value: fmt(k.total_sales),
          ...trendNone
        },
        {
          key: "s2",
          variant: "teal",
          iconClassName: "ti ti-gift",
          title: "Total Purchases",
          subtitle: mtdSubtitle,
          value: fmt(k.total_purchase),
          ...trendNone
        },
        {
          key: "s3",
          variant: "info",
          iconClassName: "ti ti-receipt",
          title: "Total Expenses",
          subtitle: mtdSubtitle,
          value: fmt(k.total_expenses),
          ...trendNone
        },
        {
          key: "s4",
          variant: "success",
          iconClassName: "ti ti-trending-up",
          title: "Total Profit",
          subtitle: mtdSubtitle,
          value: fmt(k.estimated_profit),
          ...trendNone
        }
      ];
    }
    return [
      {
        key: "s1",
        variant: "primary",
        iconClassName: "ti ti-file-text",
        title: "Total Sales",
        subtitle: null,
        value: "$48,988,078",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "primary"
      },
      {
        key: "s2",
        variant: "teal",
        iconClassName: "ti ti-gift",
        title: "Total Purchases",
        subtitle: null,
        value: "$24,145,789",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "success"
      },
      {
        key: "s3",
        variant: "info",
        iconClassName: "ti ti-receipt",
        title: "Total Expenses",
        subtitle: null,
        value: "$8,980,097",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "primary"
      },
      {
        key: "s4",
        variant: "success",
        iconClassName: "ti ti-trending-up",
        title: "Total Profit",
        subtitle: null,
        value: "$8,458,798",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "success"
      }
    ];
  }, [tillflowToken, monthToDateKpi]);

  const revenueMetrics = useMemo(() => {
    const outstandingIcon = <i className="ti ti-file-invoice fs-16" />;

    const outstandingBreakdown =
      outstandingAr === undefined ? (
        <span className="fs-11 text-muted">Loading…</span>
      ) : outstandingAr === null ? (
        <span className="fs-11 text-danger">Could not load outstanding balances.</span>
      ) : (
        renderOutstandingStatusBreakdown(outstandingAr)
      );

    const outstandingValue =
      outstandingAr === undefined || outstandingAr === null
        ? "—"
        : fmtKes(outstandingAr.total);

    const r1Card = {
      key: "r1",
      value: outstandingValue,
      label: "Total Unpaid",
      tone: "cyan",
      icon: outstandingIcon,
      breakdown: outstandingBreakdown
    };

    const paidIcon = <i className="ti ti-circle-check fs-16" />;
    const paidBreakdown =
      paidInvoicesStat === undefined ? (
        <span className="fs-11 text-muted">Loading…</span>
      ) : paidInvoicesStat === null ? (
        <span className="fs-11 text-danger">Could not load paid invoices.</span>
      ) : (
        <span className="fs-11 text-muted">
          <Link
            to={`${TF_INVOICE_REPORT}?status=${encodeURIComponent("Paid")}`}
            className={DASHBOARD_BREAKDOWN_LINK}>
            <span className={BD_STATUS}>Paid</span>{" "}
            <span className="text-gray-9 fw-medium">{paidInvoicesStat.count}</span>
          </Link>
          {", "}
          <Link
            to={`${TF_INVOICE_REPORT}?status=${encodeURIComponent("Partially_paid")}`}
            className={DASHBOARD_BREAKDOWN_LINK}>
            <span className={BD_STATUS}>Partially paid</span>{" "}
            <span className="text-gray-9 fw-medium">{paidInvoicesStat.partialCount ?? 0}</span>
          </Link>
        </span>
      );
    const paidValue =
      paidInvoicesStat === undefined || paidInvoicesStat === null
        ? "—"
        : fmtKes(
            (Number(paidInvoicesStat.total) || 0) +
              (Number(paidInvoicesStat.partialTotal) || 0)
          );

    const r2Card = {
      key: "r2",
      value: paidValue,
      label: "Total Paid",
      tone: "teal",
      icon: paidIcon,
      breakdown: paidBreakdown
    };

    const quotationIcon = <i className="ti ti-file-check fs-16" />;
    const quotationsBreakdown =
      proposalsStat === undefined ? (
        <span className="fs-11 text-muted">Loading…</span>
      ) : proposalsStat === null ? (
        <span className="fs-11 text-danger">Could not load proposals.</span>
      ) : (
        renderProposalStatusBreakdown(proposalsStat)
      );
    const quotationsValue =
      proposalsStat === undefined || proposalsStat === null
        ? "—"
        : fmtKes(proposalsStat.acceptedTotal);

    const r3Card = {
      key: "r3",
      value: quotationsValue,
      label: "Quotations accepted",
      tone: "orange",
      icon: quotationIcon,
      breakdown: quotationsBreakdown
    };

    const pipelineIcon = <i className="ti ti-hierarchy-2 fs-16" />;
    const pipelineBreakdown =
      proposalsStat === undefined ? (
        <span className="fs-11 text-muted">Loading…</span>
      ) : proposalsStat === null ? (
        <span className="fs-11 text-danger">Could not load proposals.</span>
      ) : (
        renderProposalStatusBreakdown(proposalsStat)
      );
    const pipelineValue =
      proposalsStat === undefined || proposalsStat === null
        ? "—"
        : fmtKes(proposalsStat.totalAmount);

    const r4Card = {
      key: "r4",
      value: pipelineValue,
      label: "Proposals",
      tone: "indigo",
      icon: pipelineIcon,
      breakdown: pipelineBreakdown
    };

    if (tillflowToken) {
      return [r1Card, r2Card, r3Card, r4Card];
    }
    return [
      {
        key: "r1",
        value: "$1,365,500",
        label: "Total Unpaid",
        tone: "cyan",
        icon: outstandingIcon,
        breakdown: renderOutstandingStatusBreakdown({
          unpaidCount: 18,
          partialCount: 5,
          overdueCount: 0
        })
      },
      {
        key: "r2",
        value: "$1,032,400",
        label: "Total Paid",
        tone: "teal",
        icon: <i className="ti ti-circle-check fs-16" />,
        breakdown: (
          <span className="fs-11 text-muted">
            <Link
              to={`${TF_INVOICE_REPORT}?status=${encodeURIComponent("Paid")}`}
              className={DASHBOARD_BREAKDOWN_LINK}>
              <span className={BD_STATUS}>Paid</span>{" "}
              <span className="text-gray-9 fw-medium">38</span>
            </Link>
            {", "}
            <Link
              to={`${TF_INVOICE_REPORT}?status=${encodeURIComponent("Partially_paid")}`}
              className={DASHBOARD_BREAKDOWN_LINK}>
              <span className={BD_STATUS}>Partially paid</span>{" "}
              <span className="text-gray-9 fw-medium">4</span>
            </Link>
          </span>
        )
      },
      {
        key: "r3",
        value: "$425,000",
        label: "Quotations accepted",
        tone: "orange",
        icon: <i className="ti ti-file-check fs-16" />,
        breakdown: renderProposalStatusBreakdown({
          draft: 4,
          sent: 18,
          accepted: 6,
          expired: 1
        })
      },
      {
        key: "r4",
        value: "$1,890,000",
        label: "Proposals",
        tone: "indigo",
        icon: <i className="ti ti-hierarchy-2 fs-16" />,
        breakdown: renderProposalStatusBreakdown({
          draft: 4,
          sent: 18,
          accepted: 6,
          expired: 1
        })
      }
    ];
  }, [tillflowToken, outstandingAr, paidInvoicesStat, proposalsStat]);

  return (
    <div className="page-wrapper modern-dashboard-page">
      <div className="content">
        <DashboardLowStockBanner
          token={tillflowToken}
          stockAdjustmentPath={stockAdjustmentPath}
          lowStockListPath={lowStockListPath}
        />
        <div className="row">
          {saleMetrics.map((m) => (
            <div key={m.key} className="col-xl-3 col-sm-6 col-12 d-flex">
              <SaleMetricCard
                variant={m.variant}
                iconClassName={m.iconClassName}
                title={m.title}
                subtitle={m.subtitle}
                value={m.value}
                trendDirection={m.trendDirection}
                trendLabel={m.trendLabel}
                trendBadgeVariant={m.trendBadgeVariant}
              />
            </div>
          ))}
        </div>
        <div className="row">
          {revenueMetrics.map((m) => (
            <div key={m.key} className="col-xl-3 col-sm-6 col-12 d-flex">
              <RevenueMetricCard
                value={m.value}
                label={m.label}
                tone={m.tone}
                icon={m.icon}
                breakdown={m.breakdown}
              />
            </div>
          ))}
        </div>
        <div className="row">
          <DashboardSalesPurchaseSection
            token={tillflowToken}
            onKpi={setSalesPurchaseKpi}
            {...(tillflowToken
              ? {
                  period: salesPurchasePeriod,
                  onPeriodChange: setSalesPurchasePeriod
                }
              : {})}
          />

          {/* Overall Information */}
          <div className="col-xxl-4 col-xl-5 d-flex">
            <div className="card flex-fill">
              <DashboardOverallInformationWidget
                token={tillflowToken}
                initialPeriod={dashboardDatePreset}
              />
            </div>
          </div>
        </div>
        <div className="row">
          {/* Top Selling */}
          <div className={catalogRowColClass}>
            <div className="card flex-fill">
              {tillflowToken ? (
                <DashboardTopSellingProductsWidget
                  token={tillflowToken}
                  limit={5}
                  initialDatePreset={dashboardDatePreset}
                />
              ) : (
                <>
                  <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-inline-flex align-items-center">
                      <span className="title-icon bg-soft-pink fs-16 me-2">
                        <i className="ti ti-box" />
                      </span>
                      <h5 className="card-title mb-0">Top Selling</h5>
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="fs-13 mb-0 text-muted">
                      Sign in to TillFlow for live top sellers from completed POS orders.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* /Top Selling */}
          {/* Top Customers */}
          <div className={catalogRowColClass}>
            <div className="card flex-fill">
              {tillflowToken ? (
                <DashboardTopCustomersWidget
                  token={tillflowToken}
                  limit={5}
                  customerNameLinkBase={customersPath}
                  initialDatePreset={dashboardDatePreset}
                />
              ) : (
                <>
                  <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-inline-flex align-items-center">
                      <span className="title-icon bg-soft-orange fs-16 me-2">
                        <i className="ti ti-users" />
                      </span>
                      <h5 className="card-title mb-0">Top Customers</h5>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2">
                      <div className="d-flex align-items-center">
                        <Link to={customersPath} className="avatar avatar-lg flex-shrink-0">
                          <img src={customer16} alt="" />
                        </Link>
                        <div className="ms-2">
                          <h6 className="fs-14 fw-bold mb-1">
                            <Link to={customersPath}>Sample customer</Link>
                          </h6>
                          <p className="fs-13 mb-0 text-muted">Sign in to TillFlow for live rankings</p>
                        </div>
                      </div>
                      <div className="text-end">
                        <h5>—</h5>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* /Top Customers */}
          {hideRecentSales && tillflowToken ? (
            <div className={catalogRowColClass}>
              <div className="card flex-fill">
                <DashboardPendingPaymentsWidget
                  token={tillflowToken}
                  limit={5}
                  customerNameLinkBase={customersPath}
                  initialDatePreset={dashboardDatePreset}
                />
              </div>
            </div>
          ) : null}
          {/* Recent Sales — hidden on TillFlow /admin */}
          {!hideRecentSales ? (
            <div className={catalogRowColClass}>
              <div className="card flex-fill">
                <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div className="d-inline-flex align-items-center">
                    <span className="title-icon bg-soft-pink fs-16 me-2">
                      <i className="ti ti-box" />
                    </span>
                    <h5 className="card-title mb-0">Recent Sales</h5>
                  </div>
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="dropdown-toggle btn btn-sm btn-white"
                      data-bs-toggle="dropdown"
                      aria-expanded="false">

                      <i className="ti ti-calendar me-1" />
                      Weekly
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link to="#" className="dropdown-item">
                          Today
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Weekly
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Monthly
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar avatar-lg">
                        <img src={product11} alt="img" />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fw-bold mb-1">
                          <Link to="#">Apple Watch Series 9</Link>
                        </h6>
                        <div className="d-flex align-items-center item-list">
                          <p>Electronics</p>
                          <p className="text-gray-9">$640</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="fs-13 mb-1">Today</p>
                      <span className="badge bg-purple badge-xs d-inline-flex align-items-center">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Processing
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar avatar-lg">
                        <img src={product12} alt="img" />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fw-bold mb-1">
                          <Link to="#">Gold Bracelet</Link>
                        </h6>
                        <div className="d-flex align-items-center item-list">
                          <p>Fashion</p>
                          <p className="text-gray-9">$126</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="fs-13 mb-1">Today</p>
                      <span className="badge badge-danger badge-xs d-inline-flex align-items-center">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Cancelled
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar avatar-lg">
                        <img src={product13} alt="img" />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fw-bold mb-1">
                          <Link to="#">Parachute Down Duvet</Link>
                        </h6>
                        <div className="d-flex align-items-center item-list">
                          <p>Health</p>
                          <p className="text-gray-9">$69</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="fs-13 mb-1">15 Jan 2025</p>
                      <span className="badge badge-cyan badge-xs d-inline-flex align-items-center">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Onhold
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar avatar-lg">
                        <img src={product14} alt="img" />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fw-bold mb-1">
                          <Link to="#">YETI Rambler Tumbler</Link>
                        </h6>
                        <div className="d-flex align-items-center item-list">
                          <p>Sports</p>
                          <p className="text-gray-9">$65</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="fs-13 mb-1">12 Jan 2025</p>
                      <span className="badge bg-purple badge-xs d-inline-flex align-items-center">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Processing
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-0">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar avatar-lg">
                        <img src={product15} alt="img" />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fw-bold mb-1">
                          <Link to="#">Osmo Genius Starter Kit</Link>
                        </h6>
                        <div className="d-flex align-items-center item-list">
                          <p>Lifestyles</p>
                          <p className="text-gray-9">$87.56</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="fs-13 mb-1">11 Jan 2025</p>
                      <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Completed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {/* /Recent Sales */}
        </div>
        <div className="row">
          {/* Recent Transactions (~2/3 row); Top Categories (~1/3) */}
          <div className="col-xxl-8 col-lg-8 col-md-12 d-flex">
            <DashboardRecentTransactionsWidget
              token={tillflowToken}
              initialDatePreset={dashboardDatePreset}
            />
          </div>
          {/* /Recent Transactions */}
          {/* Top Categories */}
          <div className="col-xxl-4 col-lg-4 col-md-12 d-flex">
            <div className="card flex-fill">
              <DashboardTopCategoriesWidget
                token={tillflowToken}
                initialDatePreset={dashboardDatePreset}
              />
            </div>
          </div>
          {/* /Top Categories */}
        </div>
      </div>
      {!hideFooter ? <CommonFooter /> : null}
    </div>);

};

export default ModernDashboard;
