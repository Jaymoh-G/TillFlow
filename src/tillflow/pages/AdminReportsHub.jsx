import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { REPORT_NAV_GROUPS, filterReportNavGroupsForUser } from '../config/reportsNavigation';

export default function AdminReportsHub() {
  const { hasPermission } = useAuth();
  const groups = useMemo(
    () => filterReportNavGroupsForUser(REPORT_NAV_GROUPS, hasPermission),
    [hasPermission]
  );

  return (
    <div className="tf-report tf-report--hub">
      <header className="tf-report-hub__header">
        <h2 className="tf-page-title">Reports</h2>
      </header>

      <div className="tf-report-hub__sections">
        {groups.map((group) => (
          <section key={group.id} className="tf-report-hub__section" aria-labelledby={`tf-report-hub-${group.id}`}>
            <h3 id={`tf-report-hub-${group.id}`} className="tf-report-hub__section-title">
              {group.label}
            </h3>
            <div className="tf-report-hub__grid">
              {group.items.map((item) => (
                <Link key={item.to} to={item.to} className="tf-card tf-report-hub-card">
                  <div className="tf-report-hub-card__icon" aria-hidden>
                    <i className={`feather ${item.icon}`} />
                  </div>
                  <div className="tf-report-hub-card__text">
                    <h4 className="tf-card__title">{item.label}</h4>
                    <p className="tf-card__desc">{item.note}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
