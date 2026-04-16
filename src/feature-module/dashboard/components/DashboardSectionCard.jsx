/**
 * Standard flex-fill card with optional title icon + header actions slot.
 */
export default function DashboardSectionCard({
  title,
  titleIconClass = "bg-soft-primary",
  titleIcon = "ti ti-circle",
  headerRight,
  children,
  className = "",
  bodyClassName = "",
  headerClassName = "d-flex justify-content-between align-items-center"
}) {
  return (
    <div className={`card flex-fill ${className}`.trim()}>
      <div className={`card-header ${headerClassName}`.trim()}>
        <div className="d-inline-flex align-items-center">
          <span className={`title-icon ${titleIconClass} fs-16 me-2`}>
            <i className={titleIcon} />
          </span>
          <h5 className="card-title mb-0">{title}</h5>
        </div>
        {headerRight}
      </div>
      {children != null && <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>}
    </div>
  );
}
