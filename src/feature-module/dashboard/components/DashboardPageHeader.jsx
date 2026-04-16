import CommonDateRangePicker from "../../../components/date-range-picker/common-date-range-picker";

/**
 * Top welcome row with optional date range (matches /index admin dashboard).
 */
export default function DashboardPageHeader({
  title = "Welcome, Admin",
  highlight = "200+",
  subtitleBefore = "You have",
  subtitleAfter = "Orders, Today"
}) {
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-2">
      <div className="mb-3">
        <h1 className="mb-1">{title}</h1>
        <p className="fw-medium">
          {subtitleBefore}{" "}
          <span className="text-primary fw-bold">{highlight}</span> {subtitleAfter}
        </p>
      </div>
      <div className="input-icon-start position-relative mb-3">
        <span className="input-icon-addon fs-16 text-gray-9">
          <i className="ti ti-calendar" />
        </span>
        <CommonDateRangePicker />
      </div>
    </div>
  );
}
