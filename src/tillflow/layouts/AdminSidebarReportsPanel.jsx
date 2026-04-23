import { NavLink } from 'react-router-dom';

export default function AdminSidebarReportsPanel({
  canReports = true,
  canActivityLogs = false,
  reportNavGroupsVisible,
  reportSubgroupOpen,
  setReportSubgroupOpen
}) {
  return (
    <>
      <div className="tf-sidebar-panel__title">Reports</div>
      <div className="tf-nav-settings-nested tf-nav-settings-nested--rail">
        <div className="tf-nav-group__body">
          {canReports ? (
            <NavLink
              to="/admin/reports"
              end
              className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <i className="feather icon-pie-chart tf-nav__icon" aria-hidden />
              All reports
            </NavLink>
          ) : null}
          {canActivityLogs ? (
            <>
              <NavLink
                to="/admin/notifications"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-bell tf-nav__icon" aria-hidden />
                Notifications
              </NavLink>
              <NavLink
                to="/admin/activity-logs"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-clock tf-nav__icon" aria-hidden />
                Activity log
              </NavLink>
            </>
          ) : null}
        </div>
        {reportNavGroupsVisible.map((group) => {
          const subId = `tf-report-sub-${group.id}`;
          const open = reportSubgroupOpen[group.id] === true;

          return (
            <div key={group.id} className="tf-nav-group tf-nav-group--settings">
              <button
                type="button"
                className="tf-nav-group__hdr"
                id={`${subId}-btn`}
                onClick={() =>
                  setReportSubgroupOpen((prev) => ({
                    ...prev,
                    [group.id]: !prev[group.id]
                  }))
                }
                aria-expanded={open}
                aria-controls={subId}>
                {group.label}
                <i className={`feather icon-chevron-${open ? 'up' : 'down'}`} aria-hidden />
              </button>
              {open ? (
                <div
                  className="tf-nav-group__body"
                  id={subId}
                  role="group"
                  aria-labelledby={`${subId}-btn`}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end === true}
                      className={({ isActive }) => (isActive ? 'active' : undefined)}>
                      <i className={`feather ${item.icon} tf-nav__icon`} aria-hidden />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
