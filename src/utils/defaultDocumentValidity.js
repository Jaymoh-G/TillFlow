import dayjs from "dayjs";

/**
 * Default validity / due date: one calendar month after `fromIsoDate` (YYYY-MM-DD).
 * Invalid input falls back to one month from today.
 */
export function validityOneMonthAfter(fromIsoDate) {
  const s = String(fromIsoDate ?? "").slice(0, 10);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? dayjs(s) : dayjs();
  return base.add(1, "month").format("YYYY-MM-DD");
}

/**
 * Default due date: `days` calendar days after issue date (YYYY-MM-DD).
 */
export function defaultDueAfterIssue(fromIsoDate, days) {
  const n = Math.max(1, Math.min(3650, Math.floor(Number(days)) || 21));
  const s = String(fromIsoDate ?? "").slice(0, 10);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? dayjs(s) : dayjs();
  return base.add(n, "day").format("YYYY-MM-DD");
}
