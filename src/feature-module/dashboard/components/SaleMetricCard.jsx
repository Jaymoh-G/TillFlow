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
  },
  success: {
    card: "bg-success",
    iconWrap: "bg-white text-success"
  }
};

/**
 * Colored full-width KPI card (`sale-widget`) used in the first summary row.
 */
export default function SaleMetricCard({
  variant = "primary",
  iconClassName,
  title,
  subtitle = null,
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
          {subtitle ? (
            <p className="text-white-50 small mb-1">{subtitle}</p>
          ) : null}
          <div className="d-inline-flex align-items-center flex-wrap gap-2">
            <h4 className="text-white">{value}</h4>
            {trendLabel ? (
              <TrendBadge direction={trendDirection} variant={trendBadgeVariant}>
                {trendLabel}
              </TrendBadge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
