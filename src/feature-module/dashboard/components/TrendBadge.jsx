/**
 * Small up/down pill used on sale KPI cards and similar widgets.
 */
export default function TrendBadge({ direction = "up", children, variant = "primary" }) {
  const isUp = direction === "up";
  const badgeClass =
    variant === "danger"
      ? "badge-soft-danger"
      : variant === "success"
        ? "badge-soft-success"
        : "badge-soft-primary";

  return (
    <span className={`badge ${badgeClass}`}>
      <i className={`ti ${isUp ? "ti-arrow-up" : "ti-arrow-down"} me-1`} />
      {children}
    </span>
  );
}
