import { useEffect, useMemo, useState } from "react";
import { default as Chart } from "react-apexcharts";
import { Link } from "react-router-dom";

import { fetchDashboardSalesPurchase } from "../../tillflow/api/reports";

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

/** Same presets as `DashboardSalesPurchaseSection` / `dashboard-sales-purchase` API. */
const SALES_PURCHASE_PERIODS = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" }
];

const ModernDashboard = ({
  hideFooter = false,
  hideRecentSales = false,
  tillflowToken = null,
  customerListPath = null,
  stockAdjustmentPath = "/tillflow/admin/stock-adjustment",
  lowStockListPath = "/tillflow/admin/low-stock"
}) => {
  const route = all_routes;
  const customersPath = customerListPath || route.customer;
  /** TillFlow admin (`/tillflow/admin`): default period is monthly; retail demo stays weekly. */
  const dashboardDatePreset = tillflowToken ? "month" : "week";
  const [salesPurchasePeriod, setSalesPurchasePeriod] = useState("6m");
  const [profitPeriod, setProfitPeriod] = useState("6m");
  const [profitOverride, setProfitOverride] = useState(null);
  const [salesPurchaseKpi, setSalesPurchaseKpi] = useState(null);
  /**
   * First catalog row: two half-width cols when only Top Selling + Top Customers;
   * three equal cols when Recent Sales or Pending Payments is shown.
   */
  const catalogRowColClass =
    hideRecentSales && !tillflowToken
      ? "col-xxl-6 col-md-6 d-flex"
      : "col-xxl-4 col-md-6 d-flex";

  const profitEstDisplay = useMemo(() => {
    if (!tillflowToken) {
      return null;
    }
    if (
      profitPeriod === salesPurchasePeriod &&
      salesPurchaseKpi?.estimated_profit != null
    ) {
      return fmtKes(salesPurchaseKpi.estimated_profit);
    }
    if (
      profitOverride?.period === profitPeriod &&
      profitOverride?.estimated_profit != null
    ) {
      return fmtKes(profitOverride.estimated_profit);
    }
    return "—";
  }, [
    tillflowToken,
    profitPeriod,
    salesPurchasePeriod,
    salesPurchaseKpi,
    profitOverride
  ]);

  useEffect(() => {
    if (!tillflowToken) {
      setProfitOverride(null);
      return;
    }
    if (profitPeriod === salesPurchasePeriod) {
      setProfitOverride(null);
      return;
    }
    let cancelled = false;
    setProfitOverride(null);
    (async () => {
      try {
        const data = await fetchDashboardSalesPurchase(tillflowToken, {
          period: profitPeriod
        });
        if (cancelled) {
          return;
        }
        if (data?.kpi) {
          setProfitOverride({
            period: profitPeriod,
            estimated_profit: data.kpi.estimated_profit
          });
        }
      } catch {
        if (!cancelled) {
          setProfitOverride(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tillflowToken, profitPeriod, salesPurchasePeriod]);

  const saleMetrics = useMemo(() => {
    if (tillflowToken && !salesPurchaseKpi) {
      return [
        {
          key: "s1",
          variant: "primary",
          iconClassName: "ti ti-file-text",
          title: "Total Sales",
          value: "—",
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "primary"
        },
        {
          key: "s2",
          variant: "secondary",
          iconClassName: "ti ti-repeat",
          title: "Total Sales Return",
          value: "—",
          trendDirection: "down",
          trendLabel: null,
          trendBadgeVariant: "danger"
        },
        {
          key: "s3",
          variant: "teal",
          iconClassName: "ti ti-gift",
          title: "Total Purchase",
          value: "—",
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "success"
        },
        {
          key: "s4",
          variant: "info",
          iconClassName: "ti ti-brand-pocket",
          title: "Total Purchase Return",
          value: "—",
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "success"
        }
      ];
    }
    if (tillflowToken && salesPurchaseKpi) {
      const k = salesPurchaseKpi;
      return [
        {
          key: "s1",
          variant: "primary",
          iconClassName: "ti ti-file-text",
          title: "Total Sales",
          value: fmtKes(k.total_sales),
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "primary"
        },
        {
          key: "s2",
          variant: "secondary",
          iconClassName: "ti ti-repeat",
          title: "Total Sales Return",
          value: fmtKes(k.total_sales_returns),
          trendDirection: "down",
          trendLabel: null,
          trendBadgeVariant: "danger"
        },
        {
          key: "s3",
          variant: "teal",
          iconClassName: "ti ti-gift",
          title: "Total Purchase",
          value: fmtKes(k.total_purchase),
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "success"
        },
        {
          key: "s4",
          variant: "info",
          iconClassName: "ti ti-brand-pocket",
          title: "Total Purchase Return",
          value: fmtKes(k.total_purchase_returns),
          trendDirection: "up",
          trendLabel: null,
          trendBadgeVariant: "success"
        }
      ];
    }
    return [
      {
        key: "s1",
        variant: "primary",
        iconClassName: "ti ti-file-text",
        title: "Total Sales",
        value: "$48,988,078",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "primary"
      },
      {
        key: "s2",
        variant: "secondary",
        iconClassName: "ti ti-repeat",
        title: "Total Sales Return",
        value: "$16,478,145",
        trendDirection: "down",
        trendLabel: "-22%",
        trendBadgeVariant: "danger"
      },
      {
        key: "s3",
        variant: "teal",
        iconClassName: "ti ti-gift",
        title: "Total Purchase",
        value: "$24,145,789",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "success"
      },
      {
        key: "s4",
        variant: "info",
        iconClassName: "ti ti-brand-pocket",
        title: "Total Purchase Return",
        value: "$18,458,747",
        trendDirection: "up",
        trendLabel: "+22%",
        trendBadgeVariant: "success"
      }
    ];
  }, [tillflowToken, salesPurchaseKpi]);

  const revenueMetrics = useMemo(() => {
    if (tillflowToken && !salesPurchaseKpi) {
      return [
        {
          key: "r1",
          value: profitEstDisplay ?? "—",
          label: "Profit (est.)",
          tone: "cyan",
          icon: <i className="fa-solid fa-layer-group fs-16" />
        },
        {
          key: "r2",
          value: "—",
          label: "Invoice Due",
          tone: "teal",
          icon: <i className="ti ti-chart-pie fs-16" />
        },
        {
          key: "r3",
          value: "—",
          label: "Total Expenses",
          tone: "orange",
          icon: <i className="ti ti-lifebuoy fs-16" />
        },
        {
          key: "r4",
          value: "—",
          label: "Total Payment Returns",
          tone: "indigo",
          icon: <i className="ti ti-hash fs-16" />
        }
      ];
    }
    if (tillflowToken && salesPurchaseKpi) {
      const k = salesPurchaseKpi;
      return [
        {
          key: "r1",
          value: profitEstDisplay ?? "—",
          label: "Profit (est.)",
          tone: "cyan",
          icon: <i className="fa-solid fa-layer-group fs-16" />
        },
        {
          key: "r2",
          value: fmtKes(k.invoice_due),
          label: "Invoice Due",
          tone: "teal",
          icon: <i className="ti ti-chart-pie fs-16" />
        },
        {
          key: "r3",
          value: fmtKes(k.total_expenses),
          label: "Total Expenses",
          tone: "orange",
          icon: <i className="ti ti-lifebuoy fs-16" />
        },
        {
          key: "r4",
          value: fmtKes(k.total_sales_returns),
          label: "Total Payment Returns",
          tone: "indigo",
          icon: <i className="ti ti-hash fs-16" />
        }
      ];
    }
    return [
      {
        key: "r1",
        value: "$8,458,798",
        label: "Profit",
        tone: "cyan",
        icon: <i className="fa-solid fa-layer-group fs-16" />
      },
      {
        key: "r2",
        value: "$48,988,78",
        label: "Invoice Due",
        tone: "teal",
        icon: <i className="ti ti-chart-pie fs-16" />
      },
      {
        key: "r3",
        value: "$8,980,097",
        label: "Total Expenses",
        tone: "orange",
        icon: <i className="ti ti-lifebuoy fs-16" />
      },
      {
        key: "r4",
        value: "$78,458,798",
        label: "Total Payment Returns",
        tone: "indigo",
        icon: <i className="ti ti-hash fs-16" />
      }
    ];
  }, [tillflowToken, salesPurchaseKpi, profitEstDisplay]);

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
                headerRight={
                  tillflowToken && m.key === "r1" ? (
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-sm btn-white px-2 py-1"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        onClick={(e) => e.preventDefault()}>
                        <i className="ti ti-calendar me-1" />
                        {SALES_PURCHASE_PERIODS.find((p) => p.key === profitPeriod)
                          ?.label ?? "1Y"}
                      </Link>
                      <ul className="dropdown-menu dropdown-menu-end p-2">
                        {SALES_PURCHASE_PERIODS.map((p) => (
                          <li key={p.key}>
                            <Link
                              to="#"
                              className={`dropdown-item fs-13${
                                profitPeriod === p.key ? " active" : ""
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                setProfitPeriod(p.key);
                              }}>
                              {p.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                }
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
          {/* Recent Sales — hidden on TillFlow /tillflow/admin */}
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
