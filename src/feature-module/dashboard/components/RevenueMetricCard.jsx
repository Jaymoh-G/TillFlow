const TONE_CLASS = {
  cyan: "bg-cyan-transparent text-cyan",
  teal: "bg-teal-transparent text-teal",
  orange: "bg-orange-transparent text-orange",
  indigo: "bg-indigo-transparent text-indigo"
};

/**
 * Secondary KPI card (`revenue-widget`).
 */
export default function RevenueMetricCard({
  value,
  label,
  icon,
  tone = "cyan",
  headerRight = null
}) {
  const iconToneClass = TONE_CLASS[tone] ?? TONE_CLASS.cyan;

  return (
    <div className="card revenue-widget flex-fill">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h4 className="mb-1">{value}</h4>
            <p className="mb-0">{label}</p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {headerRight}
            <span className={`revenue-icon ${iconToneClass}`}>{icon}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
