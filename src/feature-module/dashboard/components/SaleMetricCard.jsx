import TrendBadge from "./TrendBadge.jsx";

const VARIANTS = {
  primary: {
    card: "bg-primary",
    iconWrap: "bg-white text-primary"
  },
  secondary: {
    card: "bg-secondary",
    iconWrap: "bg-white text-secondary"
  },
  teal: {
    card: "bg-teal",
    iconWrap: "bg-white text-teal"
  },
  info: {
    card: "bg-info",
    iconWrap: "bg-white text-info"
  }
};

/**
 * Colored full-width KPI card (`sale-widget`) used in the first summary row.
 */
export default function SaleMetricCard({
  variant = "primary",
  iconClassName,
  title,
  value,
  trendDirection = "up",
  trendLabel,
  trendBadgeVariant = "primary"
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;

  return (
    <div className={`card ${v.card} sale-widget flex-fill`}>
      <div className="card-body d-flex align-items-center">
        <span className={`sale-icon ${v.iconWrap}`}>
          <i className={`${iconClassName} fs-24`} />
        </span>
        <div className="ms-2">
          <p className="text-white mb-1">{title}</p>
          <div className="d-inline-flex align-items-center flex-wrap gap-2">
            <h4 className="text-white">{value}</h4>
            <TrendBadge direction={trendDirection} variant={trendBadgeVariant}>
              {trendLabel}
            </TrendBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
