import { Link } from "react-router-dom";

const TONE_CLASS = {
  cyan: "bg-cyan-transparent text-cyan",
  teal: "bg-teal-transparent text-teal",
  orange: "bg-orange-transparent text-orange",
  indigo: "bg-indigo-transparent text-indigo"
};

/**
 * Secondary KPI card with bordered header row and footer link (`revenue-widget`).
 */
export default function RevenueMetricCard({
  value,
  label,
  icon,
  tone = "cyan",
  trendLabel,
  trendTone = "success",
  viewAllTo = "#",
  viewAllLabel = "View All"
}) {
  const iconToneClass = TONE_CLASS[tone] ?? TONE_CLASS.cyan;

  return (
    <div className="card revenue-widget flex-fill">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
          <div>
            <h4 className="mb-1">{value}</h4>
            <p>{label}</p>
          </div>
          <span className={`revenue-icon ${iconToneClass}`}>{icon}</span>
        </div>
        <div className="d-flex align-items-center justify-content-between">
          <p className="mb-0">
            <span className={`fs-13 fw-bold text-${trendTone}`}>{trendLabel}</span> vs Last Month
          </p>
          <Link to={viewAllTo} className="text-decoration-underline fs-13 fw-medium">
            {viewAllLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
