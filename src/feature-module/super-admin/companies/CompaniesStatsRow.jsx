import ReactApexChart from 'react-apexcharts';
import { companiesStatsChartPresets } from './companiesSparklineCharts';

/**
 * @param {{ total: number; active: number; inactive: number; locations: number }} props.stats
 * @param {{ total?: object; active?: object; inactive?: object; location?: object }} [props.chartOptions] optional Apex overrides per card
 */
export default function CompaniesStatsRow({ stats, chartOptions = {} }) {
  const t = chartOptions.total || companiesStatsChartPresets.total;
  const a = chartOptions.active || companiesStatsChartPresets.active;
  const i = chartOptions.inactive || companiesStatsChartPresets.inactive;
  const l = chartOptions.location || companiesStatsChartPresets.location;

  return (
    <div className="row">
      <div className="col-lg-3 col-md-6 d-flex">
        <div className="card flex-fill">
          <div className="card-body d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center overflow-hidden">
              <span className="avatar avatar-lg bg-primary flex-shrink-0">
                <i className="ti ti-building fs-16" />
              </span>
              <div className="ms-2 overflow-hidden">
                <p className="fs-12 fw-medium mb-1 text-truncate">Total Companies</p>
                <h4>{stats.total}</h4>
              </div>
            </div>
            <ReactApexChart options={t} series={t.series} type="area" width={50} />
          </div>
        </div>
      </div>
      <div className="col-lg-3 col-md-6 d-flex">
        <div className="card flex-fill">
          <div className="card-body d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center overflow-hidden">
              <span className="avatar avatar-lg bg-success flex-shrink-0">
                <i className="ti ti-building fs-16" />
              </span>
              <div className="ms-2 overflow-hidden">
                <p className="fs-12 fw-medium mb-1 text-truncate">Active Companies</p>
                <h4>{stats.active}</h4>
              </div>
            </div>
            <ReactApexChart options={a} series={a.series} type="area" width={50} />
          </div>
        </div>
      </div>
      <div className="col-lg-3 col-md-6 d-flex">
        <div className="card flex-fill">
          <div className="card-body d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center overflow-hidden">
              <span className="avatar avatar-lg bg-danger flex-shrink-0">
                <i className="ti ti-building fs-16" />
              </span>
              <div className="ms-2 overflow-hidden">
                <p className="fs-12 fw-medium mb-1 text-truncate">Inactive Companies</p>
                <h4>{stats.inactive}</h4>
              </div>
            </div>
            <ReactApexChart options={i} series={i.series} type="area" width={50} />
          </div>
        </div>
      </div>
      <div className="col-lg-3 col-md-6 d-flex">
        <div className="card flex-fill">
          <div className="card-body d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center overflow-hidden">
              <span className="avatar avatar-lg bg-skyblue flex-shrink-0">
                <i className="ti ti-map-pin-check fs-16" />
              </span>
              <div className="ms-2 overflow-hidden">
                <p className="fs-12 fw-medium mb-1 text-truncate">With location</p>
                <h4>{stats.locations}</h4>
              </div>
            </div>
            <ReactApexChart options={l} series={l.series} type="area" width={50} />
          </div>
        </div>
      </div>
    </div>
  );
}
