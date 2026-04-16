import dayjs from "dayjs";

/** Preset keys for dashboard APIs (`period` query); must match backend `dashboardPeriodPresetKeys`. */
export const DASHBOARD_PRESET_PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "6months", label: "6 months" },
  { key: "1year", label: "1 year" },
  { key: "all", label: "All time" }
];

/**
 * Approximate bounds for syncing native date inputs (server applies the real preset).
 * Rolling presets end today; week/month use calendar boundaries.
 */
export function boundsForDashboardPreset(key) {
  const n = dayjs();
  if (key === "today") {
    const d = n.format("YYYY-MM-DD");
    return { from: d, to: d };
  }
  if (key === "month") {
    return {
      from: n.startOf("month").format("YYYY-MM-DD"),
      to: n.endOf("month").format("YYYY-MM-DD")
    };
  }
  if (key === "all") {
    return { from: "", to: "" };
  }
  if (key === "week") {
    return {
      from: n.startOf("week").format("YYYY-MM-DD"),
      to: n.endOf("week").format("YYYY-MM-DD")
    };
  }
  if (key === "6months") {
    return {
      from: n.subtract(6, "month").startOf("day").format("YYYY-MM-DD"),
      to: n.endOf("day").format("YYYY-MM-DD")
    };
  }
  if (key === "1year") {
    return {
      from: n.subtract(1, "year").startOf("day").format("YYYY-MM-DD"),
      to: n.endOf("day").format("YYYY-MM-DD")
    };
  }
  return {
    from: n.startOf("week").format("YYYY-MM-DD"),
    to: n.endOf("week").format("YYYY-MM-DD")
  };
}
