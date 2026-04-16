import { useCallback, useMemo, useState } from 'react';

function toYmd(d) {
  if (!d) {
    return '';
  }
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) {
    return '';
  }
  return x.toISOString().slice(0, 10);
}

/**
 * Default: last 30 days through today.
 * When `allDates` is true, `params` is `{ all_dates: '1' }` for APIs that support unrestricted dates.
 * @param {{ defaultDays?: number }} [opts]
 */
export function useReportDateRange(opts = {}) {
  const defaultDays = opts.defaultDays ?? 30;
  const [from, setFrom] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - defaultDays);
    return toYmd(t);
  });
  const [to, setTo] = useState(() => toYmd(new Date()));
  const [allDates, setAllDates] = useState(false);

  const params = useMemo(() => {
    if (allDates) {
      return { all_dates: '1' };
    }
    const o = {};
    if (from) {
      o.from = from;
    }
    if (to) {
      o.to = to;
    }
    return o;
  }, [from, to, allDates]);

  const setRangePreset = useCallback((days) => {
    setAllDates(false);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(toYmd(start));
    setTo(toYmd(end));
  }, []);

  return {
    from,
    to,
    setFrom,
    setTo,
    params,
    allDates,
    setAllDates,
    setRangePreset
  };
}
