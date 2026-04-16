import "bootstrap-daterangepicker/daterangepicker.css";
import { default as Chart } from "react-apexcharts";
import { Doughnut } from "react-chartjs-2";
import { Link } from "react-router-dom";

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
    customer11,
    customer12,
    customer13,
    customer14,
    customer15,
    customer16,
    customer17,
    customer18,
    product1,
    product10,
    product11,
    product12,
    product13,
    product14,
    product15,
    product16,
    product3,
    product4,
    product5,
    product6,
    product7,
    product8,
    product9
} from "../../utils/imagepath";

import CommonFooter from "../../components/footer/commonFooter";
import DashboardPageHeader from "./components/DashboardPageHeader.jsx";
import DashboardSectionCard from "./components/DashboardSectionCard.jsx";
import RevenueMetricCard from "./components/RevenueMetricCard.jsx";
import SaleMetricCard from "./components/SaleMetricCard.jsx";
import {
  categoryDoughnutData,
  categoryDoughnutOptions,
  customerChart,
  customerRadialSeries,
  salesDayChart
} from "./dashboardChartConfigs.js";

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
const ModernDashboard = ({ hideFooter = false }) => {
  const route = all_routes;

  const saleMetrics = [
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

  const revenueMetrics = [
    {
      key: "r1",
      value: "$8,458,798",
      label: "Profit",
      tone: "cyan",
      icon: <i className="fa-solid fa-layer-group fs-16" />,
      trendLabel: "+35%",
      trendTone: "success",
      viewAllTo: "profit-and-loss.html",
      viewAllLabel: "View All"
    },
    {
      key: "r2",
      value: "$48,988,78",
      label: "Invoice Due",
      tone: "teal",
      icon: <i className="ti ti-chart-pie fs-16" />,
      trendLabel: "+35%",
      trendTone: "success",
      viewAllTo: route.invoicereport,
      viewAllLabel: "View All"
    },
    {
      key: "r3",
      value: "$8,980,097",
      label: "Total Expenses",
      tone: "orange",
      icon: <i className="ti ti-lifebuoy fs-16" />,
      trendLabel: "+41%",
      trendTone: "success",
      viewAllTo: route.expenselist,
      viewAllLabel: "View All"
    },
    {
      key: "r4",
      value: "$78,458,798",
      label: "Total Payment Returns",
      tone: "indigo",
      icon: <i className="ti ti-hash fs-16" />,
      trendLabel: "-20%",
      trendTone: "danger",
      viewAllTo: route.salesreport,
      viewAllLabel: "View All"
    }
  ];


  return (
    <div className="page-wrapper modern-dashboard-page">
      <div className="content">
        <DashboardPageHeader />
        <div className="alert bg-orange-transparent alert-dismissible fade show mb-4">
          <div>
            <span>
              {" "}
              <i className="ti ti-info-circle fs-14 text-orange me-2" /> Your
              Product{" "}
            </span>
            <span className="text-orange fw-semibold">
              {" "}
              Apple Iphone 15 is running Low,{" "}
            </span>{" "}
            already below 5 Pcs.,
            <Link
              to="#"
              className="link-orange text-decoration-underline fw-semibold"
              data-bs-toggle="modal"
              data-bs-target="#add-stock">

              Add Stock
            </Link>
          </div>
          <button
            type="button"
            className="btn-close text-gray-9 fs-14"
            data-bs-dismiss="alert"
            aria-label="Close">

            <i className="ti ti-x" />
          </button>
        </div>
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
                trendLabel={m.trendLabel}
                trendTone={m.trendTone}
                viewAllTo={m.viewAllTo}
                viewAllLabel={m.viewAllLabel}
              />
            </div>
          ))}
        </div>
        <div className="row">
          <>
            {/* Sales & Purchase */}
            <div className="col-xxl-8 col-xl-7 col-sm-12 col-12 d-flex">
              <DashboardSectionCard
                title="Sales & Purchase"
                titleIconClass="bg-soft-primary"
                titleIcon="ti ti-shopping-cart"
                bodyClassName="pb-0"
                headerRight={
                  <ul className="nav btn-group custom-btn-group">
                    <Link className="btn btn-outline-light" to="#">
                      1D
                    </Link>
                    <Link className="btn btn-outline-light" to="#">
                      1W
                    </Link>
                    <Link className="btn btn-outline-light" to="#">
                      1M
                    </Link>
                    <Link className="btn btn-outline-light" to="#">
                      3M
                    </Link>
                    <Link className="btn btn-outline-light" to="#">
                      6M
                    </Link>
                    <Link className="btn btn-outline-light active" to="#">
                      1Y
                    </Link>
                  </ul>
                }>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="border p-2 br-8">
                      <p className="d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-8 text-primary-300 me-1" />
                        Total Purchase
                      </p>
                      <h4>3K</h4>
                    </div>
                    <div className="border p-2 br-8">
                      <p className="d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-8 text-primary me-1" />
                        Total Sales
                      </p>
                      <h4>1K</h4>
                    </div>
                  </div>
                  <div id="sales-daychart">
                    <Chart
                      options={salesDayChart}
                      series={salesDayChart.series}
                      type="bar"
                      height={245}
                    />
                  </div>
                </div>
              </DashboardSectionCard>
            </div>
            {/* /Sales & Purchase */}
          </>

          {/* Top Selling Products */}
          <div className="col-xxl-4 col-xl-5 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-info fs-16 me-2">
                    <i className="ti ti-info-circle" />
                  </span>
                  <h5 className="card-title mb-0">Overall Information</h5>
                </div>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="info-item border bg-light p-3 text-center">
                      <div className="mb-3 text-info fs-24">
                        <i className="ti ti-user-check" />
                      </div>
                      <p className="mb-1">Suppliers</p>
                      <h5>6987</h5>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="info-item border bg-light p-3 text-center">
                      <div className="mb-3 text-orange fs-24">
                        <i className="ti ti-users" />
                      </div>
                      <p className="mb-1">Customer</p>
                      <h5>4896</h5>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="info-item border bg-light p-3 text-center">
                      <div className="mb-3 text-teal fs-24">
                        <i className="ti ti-shopping-cart" />
                      </div>
                      <p className="mb-1">Orders</p>
                      <h5>487</h5>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-footer pb-sm-0">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <h6>Customers Overview</h6>
                  <div className="dropdown dropdown-wraper">
                    <Link
                      to="#"
                      className="dropdown-toggle btn btn-sm"
                      data-bs-toggle="dropdown"
                      aria-expanded="false">

                      <i className="ti ti-calendar me-1" />
                      Today
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
                <div className="row align-items-center">
                  <div className="col-sm-5">
                    <div id="customer-chart">
                      <Chart
                        options={customerChart}
                        series={customerRadialSeries}
                        type="radialBar"
                        height={130} />

                    </div>
                  </div>
                  <div className="col-sm-7">
                    <div className="row gx-0">
                      <div className="col-sm-6">
                        <div className="text-center border-end">
                          <h2 className="mb-1">5.5K</h2>
                          <p className="text-orange mb-2">First Time</p>
                          <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                            <i className="ti ti-arrow-up-left me-1" />
                            25%
                          </span>
                        </div>
                      </div>
                      <div className="col-sm-6">
                        <div className="text-center">
                          <h2 className="mb-1">3.5K</h2>
                          <p className="text-teal mb-2">Return</p>
                          <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                            <i className="ti ti-arrow-up-left me-1" />
                            21%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          {/* Top Selling Products */}
          <div className="col-xxl-4 col-md-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-pink fs-16 me-2">
                    <i className="ti ti-box" />
                  </span>
                  <h5 className="card-title mb-0">Top Selling Products</h5>
                </div>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-sm btn-white"
                    data-bs-toggle="dropdown"
                    aria-expanded="false">

                    <i className="ti ti-calendar me-1" />
                    Today
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
              <div className="card-body sell-product">
                <div className="d-flex align-items-center justify-content-between border-bottom">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product1} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Charger Cable - Lighting</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p>$187</p>
                        <p>247+ Sales</p>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-outline-success badge-xs d-inline-flex align-items-center">
                    <i className="ti ti-arrow-up-left me-1" />
                    25%
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product16} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Yves Saint Eau De Parfum</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p>$145</p>
                        <p>289+ Sales</p>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-outline-success badge-xs d-inline-flex align-items-center">
                    <i className="ti ti-arrow-up-left me-1" />
                    25%
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product3} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Apple Airpods 2</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p>$458</p>
                        <p>300+ Sales</p>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-outline-success badge-xs d-inline-flex align-items-center">
                    <i className="ti ti-arrow-up-left me-1" />
                    25%
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product4} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Vacuum Cleaner</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p>$139</p>
                        <p>225+ Sales</p>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-outline-danger badge-xs d-inline-flex align-items-center">
                    <i className="ti ti-arrow-down-left me-1" />
                    21%
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product5} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Samsung Galaxy S21 Fe 5g</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p>$898</p>
                        <p>365+ Sales</p>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-outline-success badge-xs d-inline-flex align-items-center">
                    <i className="ti ti-arrow-up-left me-1" />
                    25%
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* /Top Selling Products */}
          {/* Low Stock Products */}
          <div className="col-xxl-4 col-md-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-danger fs-16 me-2">
                    <i className="ti ti-alert-triangle" />
                  </span>
                  <h5 className="card-title mb-0">Low Stock Products</h5>
                </div>
                <Link
                  to={route.lowstock}
                  className="fs-13 fw-bold text-decoration-underline">

                  View All
                </Link>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product6} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Dell XPS 13</Link>
                      </h6>
                      <p className="fs-13">ID : #665814</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="fs-13 mb-1">Instock</p>
                    <h6 className="text-orange fw-bold">08</h6>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product7} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">Vacuum Cleaner Robot</Link>
                      </h6>
                      <p className="fs-13">ID : #940004</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="fs-13 mb-1">Instock</p>
                    <h6 className="text-orange fw-bold">14</h6>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product8} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">KitchenAid Stand Mixer</Link>
                      </h6>
                      <p className="fs-13">ID : #325569</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="fs-13 mb-1">Instock</p>
                    <h6 className="text-orange fw-bold">21</h6>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product9} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">{`Levi's Trucker Jacket`}</Link>
                      </h6>
                      <p className="fs-13">ID : #124588</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="fs-13 mb-1">Instock</p>
                    <h6 className="text-orange fw-bold">12</h6>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-0">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg">
                      <img src={product10} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fw-bold mb-1">
                        <Link to="#">{`Lay's Classic`}</Link>
                      </h6>
                      <p className="fs-13">ID : #365586</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="fs-13 mb-1">Instock</p>
                    <h6 className="text-orange fw-bold">10</h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Low Stock Products */}
          {/* Recent Sales */}
          <div className="col-xxl-4 col-md-12 d-flex">
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
          {/* /Recent Sales */}
        </div>
        <div className="row">
          {/* Recent Transactions */}
          <div className="col-xxl-4 col-lg-4 col-md-12 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-orange fs-16 me-2">
                    <i className="ti ti-flag" />
                  </span>
                  <h5 className="card-title mb-0">Recent Transactions</h5>
                </div>
                <Link
                  to={route.posorder}
                  className="fs-13 fw-medium text-decoration-underline">

                  View All
                </Link>
              </div>
              <div className="card-body p-0">
                <ul className="nav nav-tabs nav-justified transaction-tab">
                  <li className="nav-item">
                    <Link
                      className="nav-link active"
                      to="#sale"
                      data-bs-toggle="tab">

                      Sale
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      to="#purchase-transaction"
                      data-bs-toggle="tab">

                      Purchase
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      to="#quotation"
                      data-bs-toggle="tab">

                      Quotation
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      to="#expenses"
                      data-bs-toggle="tab">

                      Expenses
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      to="#invoices"
                      data-bs-toggle="tab">

                      Invoices
                    </Link>
                  </li>
                </ul>
                <div className="tab-content">
                  <div className="tab-pane show active" id="sale">
                    <div className="table-responsive">
                      <table className="table table-borderless custom-table">
                        <thead className="thead-light">
                          <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>24 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer16}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Andrea Willer</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="fs-16 fw-bold text-gray-9">
                              $4,560
                            </td>
                          </tr>
                          <tr>
                            <td>23 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer17}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Timothy Sandsr</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="fs-16 fw-bold text-gray-9">
                              $3,569
                            </td>
                          </tr>
                          <tr>
                            <td>22 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer18}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Bonnie Rodrigues</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-pink badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Draft
                              </span>
                            </td>
                            <td className="fs-16 fw-bold text-gray-9">
                              $4,560
                            </td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer15}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Randy McCree</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="fs-16 fw-bold text-gray-9">
                              $2,155
                            </td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer13}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Dennis Anderson</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="fs-16 fw-bold text-gray-9">
                              $5,123
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="tab-pane fade" id="purchase-transaction">
                    <div className="table-responsive">
                      <table className="table table-borderless custom-table">
                        <thead className="thead-light">
                          <tr>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>24 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Electro Mart
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1000</td>
                          </tr>
                          <tr>
                            <td>23 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Quantum Gadgets
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1500</td>
                          </tr>
                          <tr>
                            <td>22 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Prime Bazaar
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-cyan badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Pending
                              </span>
                            </td>
                            <td className="text-gray-9">$2000</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Alpha Mobiles
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1200</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Aesthetic Bags
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1300</td>
                          </tr>
                          <tr>
                            <td>28 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                Sigma Chairs
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1600</td>
                          </tr>
                          <tr>
                            <td>26 May 2025</td>
                            <td>
                              <Link to="#" className="fw-semibold">
                                A-Z Store s
                              </Link>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Completed
                              </span>
                            </td>
                            <td className="text-gray-9">$1100</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="tab-pane" id="quotation">
                    <div className="table-responsive">
                      <table className="table table-borderless custom-table">
                        <thead className="thead-light">
                          <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>24 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer16}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Andrea Willer</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Sent
                              </span>
                            </td>
                            <td className="text-gray-9">$4,560</td>
                          </tr>
                          <tr>
                            <td>23 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer17}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Timothy Sandsr</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-warning badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Ordered
                              </span>
                            </td>
                            <td className="text-gray-9">$3,569</td>
                          </tr>
                          <tr>
                            <td>22 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer18}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Bonnie Rodrigues</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-cyan badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Pending
                              </span>
                            </td>
                            <td className="text-gray-9">$4,560</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer15}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Randy McCree</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-warning badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Ordered
                              </span>
                            </td>
                            <td className="text-gray-9">$2,155</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer13}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Dennis Anderson</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #114589
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Sent
                              </span>
                            </td>
                            <td className="text-gray-9">$5,123</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="tab-pane fade" id="expenses">
                    <div className="table-responsive">
                      <table className="table table-borderless custom-table">
                        <thead className="thead-light">
                          <tr>
                            <th>Date</th>
                            <th>Expenses</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>24 May 2025</td>
                            <td>
                              <h6 className="fw-medium">
                                <Link to="#">Electricity Payment</Link>
                              </h6>
                              <span className="fs-13 text-orange">#EX849</span>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Approved
                              </span>
                            </td>
                            <td className="text-gray-9">$200</td>
                          </tr>
                          <tr>
                            <td>23 May 2025</td>
                            <td>
                              <h6 className="fw-medium">
                                <Link to="#">Electricity Payment</Link>
                              </h6>
                              <span className="fs-13 text-orange">#EX849</span>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Approved
                              </span>
                            </td>
                            <td className="text-gray-9">$200</td>
                          </tr>
                          <tr>
                            <td>22 May 2025</td>
                            <td>
                              <h6 className="fw-medium">
                                <Link to="#">Stationery Purchase</Link>
                              </h6>
                              <span className="fs-13 text-orange">#EX848</span>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Approved
                              </span>
                            </td>
                            <td className="text-gray-9">$50</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <h6 className="fw-medium">
                                <Link to="#">AC Repair Service</Link>
                              </h6>
                              <span className="fs-13 text-orange">#EX847</span>
                            </td>
                            <td>
                              <span className="badge badge-cyan badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Pending
                              </span>
                            </td>
                            <td className="text-gray-9">$800</td>
                          </tr>
                          <tr>
                            <td>21 May 2025</td>
                            <td>
                              <h6 className="fw-medium">
                                <Link to="#">Client Meeting</Link>
                              </h6>
                              <span className="fs-13 text-orange">#EX846</span>
                            </td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Approved
                              </span>
                            </td>
                            <td className="text-gray-9">$100</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="tab-pane" id="invoices">
                    <div className="table-responsive">
                      <table className="table table-borderless custom-table">
                        <thead className="thead-light">
                          <tr>
                            <th>Customer</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer16}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Andrea Willer</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #INV005
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>24 May 2025</td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Paid
                              </span>
                            </td>
                            <td className="text-gray-9">$1300</td>
                          </tr>
                          <tr>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer17}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Timothy Sandsr</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #INV004
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>23 May 2025</td>
                            <td>
                              <span className="badge badge-warning badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Overdue
                              </span>
                            </td>
                            <td className="text-gray-9">$1250</td>
                          </tr>
                          <tr>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer18}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Bonnie Rodrigues</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #INV003
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>22 May 2025</td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Paid
                              </span>
                            </td>
                            <td className="text-gray-9">$1700</td>
                          </tr>
                          <tr>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer15}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Randy McCree</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #INV002
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>21 May 2025</td>
                            <td>
                              <span className="badge badge-danger badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Unpaid
                              </span>
                            </td>
                            <td className="text-gray-9">$1500</td>
                          </tr>
                          <tr>
                            <td>
                              <div className="d-flex align-items-center file-name-icon">
                                <Link to="#" className="avatar avatar-md">
                                  <img
                                    src={customer13}
                                    className="img-fluid"
                                    alt="img" />

                                </Link>
                                <div className="ms-2">
                                  <h6 className="fw-medium">
                                    <Link to="#">Dennis Anderson</Link>
                                  </h6>
                                  <span className="fs-13 text-orange">
                                    #INV001
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>21 May 2025</td>
                            <td>
                              <span className="badge badge-success badge-xs d-inline-flex align-items-center">
                                <i className="ti ti-circle-filled fs-5 me-1" />
                                Paid
                              </span>
                            </td>
                            <td className="text-gray-9">$1000</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Recent Transactions */}
          {/* Top Customers */}
          <div className="col-xxl-4 col-lg-4 col-md-12 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-orange fs-16 me-2">
                    <i className="ti ti-users" />
                  </span>
                  <h5 className="card-title mb-0">Top Customers</h5>
                </div>
                <Link
                  to={route.customer}
                  className="fs-13 fw-medium text-decoration-underline">

                  View All
                </Link>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg flex-shrink-0">
                      <img src={customer11} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fs-14 fw-bold mb-1">
                        <Link to="#">Carlos Curran</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p className="d-inline-flex align-items-center">
                          <i className="ti ti-map-pin me-1" />
                          USA
                        </p>
                        <p>24 Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h5>$8,9645</h5>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg flex-shrink-0">
                      <img src={customer12} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fs-14 fw-bold mb-1">
                        <Link to="#">Stan Gaunter</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p className="d-inline-flex align-items-center">
                          <i className="ti ti-map-pin me-1" />
                          UAE
                        </p>
                        <p>22 Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h5>$16,985</h5>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg flex-shrink-0">
                      <img src={customer13} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fs-14 fw-bold mb-1">
                        <Link to="#">Richard Wilson</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p className="d-inline-flex align-items-center">
                          <i className="ti ti-map-pin me-1" />
                          Germany
                        </p>
                        <p>14 Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h5>$5,366</h5>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom mb-3 pb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg flex-shrink-0">
                      <img src={customer14} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fs-14 fw-bold mb-1">
                        <Link to="#">Mary Bronson</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p className="d-inline-flex align-items-center">
                          <i className="ti ti-map-pin me-1" />
                          Belgium
                        </p>
                        <p>08 Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h5>$4,569</h5>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center">
                    <Link to="#" className="avatar avatar-lg flex-shrink-0">
                      <img src={customer15} alt="img" />
                    </Link>
                    <div className="ms-2">
                      <h6 className="fs-14 fw-bold mb-1">
                        <Link to="#">Annie Tremblay</Link>
                      </h6>
                      <div className="d-flex align-items-center item-list">
                        <p className="d-inline-flex align-items-center">
                          <i className="ti ti-map-pin me-1" />
                          Greenland
                        </p>
                        <p>14 Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h5>$3,5698</h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Top Customers */}
          {/* Top Categories */}
          <div className="col-xxl-4 col-lg-4 col-md-12 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="d-inline-flex align-items-center">
                  <span className="title-icon bg-soft-orange fs-16 me-2">
                    <i className="ti ti-users" />
                  </span>
                  <h5 className="card-title mb-0">Top Categories</h5>
                </div>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-sm btn-white d-flex align-items-center"
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
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-4 mb-4">
                  <div>
                    <Doughnut
                      data={categoryDoughnutData}
                      options={categoryDoughnutOptions}
                      style={{
                        boxSizing: "border-box",
                        height: "230px",
                        width: "200px"
                      }} />

                  </div>
                  <div>
                    <div className="category-item category-primary">
                      <p className="fs-13 mb-1">Electronics</p>
                      <h2 className="d-flex align-items-center">
                        698
                        <span className="fs-13 fw-normal text-default ms-1">
                          Sales
                        </span>
                      </h2>
                    </div>
                    <div className="category-item category-orange">
                      <p className="fs-13 mb-1">Sports</p>
                      <h2 className="d-flex align-items-center">
                        545
                        <span className="fs-13 fw-normal text-default ms-1">
                          Sales
                        </span>
                      </h2>
                    </div>
                    <div className="category-item category-secondary">
                      <p className="fs-13 mb-1">Lifestyles</p>
                      <h2 className="d-flex align-items-center">
                        456
                        <span className="fs-13 fw-normal text-default ms-1">
                          Sales
                        </span>
                      </h2>
                    </div>
                  </div>
                </div>
                <h6 className="mb-2">Category Statistics</h6>
                <div className="border br-8">
                  <div className="d-flex align-items-center justify-content-between border-bottom p-2">
                    <p className="d-inline-flex align-items-center mb-0">
                      <i className="ti ti-square-rounded-filled text-indigo fs-8 me-2" />
                      Total Number Of Categories
                    </p>
                    <h5>698</h5>
                  </div>
                  <div className="d-flex align-items-center justify-content-between p-2">
                    <p className="d-inline-flex align-items-center mb-0">
                      <i className="ti ti-square-rounded-filled text-orange fs-8 me-2" />
                      Total Number Of Products
                    </p>
                    <h5>7899</h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Top Categories */}
        </div>
      </div>
      {!hideFooter ? <CommonFooter /> : null}
    </div>);

};

export default ModernDashboard;
