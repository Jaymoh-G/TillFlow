/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {Array<{ field: string, header: string }>} columns
 * @param {string} filenameBase
 */
export function downloadReportCsv(rows, columns, filenameBase = 'report') {
  if (!rows?.length || !columns?.length) {
    return;
  }

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.map((c) => esc(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => esc(row[c.field])).join(',')
  );
  const csv = [header, ...lines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = filenameBase.replace(/[^\w\-]+/g, '-').slice(0, 80);
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${safe}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
