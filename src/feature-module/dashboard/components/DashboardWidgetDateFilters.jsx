import { useCallback, useMemo, useState } from "react";
import { DatePicker, Popover } from "antd";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

import {
  DASHBOARD_PRESET_PERIODS,
  boundsForDashboardPreset
} from "../dashboardDateRangeUtils.js";

const { RangePicker } = DatePicker;

/**
 * Preset vs explicit from/to for dashboard API calls (`period` OR `from`+`to`, not both).
 */
export function useDashboardDateFilterParams(initialPreset = "week") {
  const [mode, setMode] = useState("preset");
  const [period, setPeriodState] = useState(initialPreset);
  const [from, setFrom] = useState(() => boundsForDashboardPreset(initialPreset).from);
  const [to, setTo] = useState(() => boundsForDashboardPreset(initialPreset).to);

  const setPeriod = useCallback((p) => {
    setMode("preset");
    setPeriodState(p);
    const b = boundsForDashboardPreset(p);
    setFrom(b.from);
    setTo(b.to);
  }, []);

  const onDateFromChange = useCallback((v) => {
    setMode("custom");
    setFrom(v);
  }, []);

  const onDateToChange = useCallback((v) => {
    setMode("custom");
    setTo(v);
  }, []);

  const apiParams = useMemo(() => {
    if (mode === "custom" && from && to) {
      return { from, to };
    }
    if (mode === "preset") {
      return { period };
    }
    return { period: initialPreset };
  }, [mode, from, to, period, initialPreset]);

  const canFetch = mode === "preset" || (mode === "custom" && !!from && !!to);

  return {
    period,
    setPeriod,
    dateFrom: from,
    dateTo: to,
    onDateFromChange,
    onDateToChange,
    apiParams,
    canFetch
  };
}

function rangePresets() {
  return [
    {
      label: "Last 7 days",
      value: [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")]
    },
    {
      label: "Last 30 days",
      value: [dayjs().subtract(29, "day").startOf("day"), dayjs().endOf("day")]
    },
    {
      label: "This month",
      value: [dayjs().startOf("month"), dayjs().endOf("month")]
    },
    {
      label: "Last month",
      value: [
        dayjs().subtract(1, "month").startOf("month"),
        dayjs().subtract(1, "month").endOf("month")
      ]
    }
  ];
}

/**
 * Period dropdown + calendar icon opening Ant Design range picker (highlighted date range).
 */
export function DashboardDateFilterControls({
  period,
  onPeriodChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  periods = DASHBOARD_PRESET_PERIODS
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const periodLabel = useMemo(
    () => periods.find((p) => p.key === period)?.label ?? "Weekly",
    [period, periods]
  );

  const rangeValue = useMemo(() => {
    if (dateFrom && dateTo) {
      return [dayjs(dateFrom), dayjs(dateTo)];
    }
    return null;
  }, [dateFrom, dateTo]);

  const rangePicker = (
    <div className="py-1" style={{ minWidth: 280 }}>
      <RangePicker
        size="small"
        className="w-100"
        format="DD MMM YYYY"
        value={rangeValue}
        presets={rangePresets()}
        allowClear={false}
        getPopupContainer={() => document.body}
        onChange={(dates) => {
          if (dates?.[0] && dates?.[1]) {
            onDateFromChange(dates[0].format("YYYY-MM-DD"));
            onDateToChange(dates[1].format("YYYY-MM-DD"));
            setPopoverOpen(false);
          }
        }}
      />
    </div>
  );

  return (
    <div className="d-flex flex-column align-items-end gap-2">
      <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        <div className="dropdown">
          <Link
            to="#"
            className="dropdown-toggle btn btn-sm btn-white d-flex align-items-center"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            onClick={(e) => e.preventDefault()}>
            <i className="ti ti-calendar me-1" />
            {periodLabel}
          </Link>
          <ul className="dropdown-menu dropdown-menu-end p-3">
            {periods.map((p) => (
              <li key={p.key}>
                <Link
                  to="#"
                  className={`dropdown-item${period === p.key ? " active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onPeriodChange(p.key);
                  }}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Popover
          placement="bottomRight"
          trigger="click"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          destroyOnHidden
          overlayClassName="dashboard-widget-range-popover"
          content={rangePicker}>
          <button
            type="button"
            className="btn btn-sm btn-white d-inline-flex align-items-center justify-content-center px-2"
            title="Pick a date range"
            aria-label="Pick a date range"
            aria-haspopup="dialog">
            <i className="ti ti-calendar" />
          </button>
        </Popover>
      </div>
    </div>
  );
}
