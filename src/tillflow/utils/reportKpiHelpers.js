import { formatInvoiceMoneyKes } from '../../feature-module/sales/invoiceViewHelpers';

function fmt(v) {
  if (v == null || v === '' || Number.isNaN(v)) {
    return '—';
  }
  if (typeof v === 'number' && !Number.isFinite(v)) {
    return '—';
  }
  return formatInvoiceMoneyKes(v);
}

function fmtNum(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) {
    return '—';
  }
  return String(Math.round(Number(v) * 100) / 100);
}

const V = ['info', 'success', 'orange', 'danger'];

/**
 * Build up to four KPI cards for the standard report shell from loaded data.
 *
 * @param {string} slug
 * @param {{
 *   rows?: Array<Record<string, unknown>>,
 *   lines?: Array<{ label?: string, amount?: string|number }>,
 *   zData?: Record<string, unknown>|null,
 *   meta?: { pos_tax_total?: string, note?: string, returnSummary?: { count?: number, total_amount?: string }, customerPurchaseSummary?: { line_revenue_total?: string, cogs_total?: string, customer_expenses_total?: string, customer_profit?: string } }
 * }} ctx
 */
export function buildKpiItemsForSlug(slug, ctx) {
  const rows = ctx.rows ?? [];
  const lines = ctx.lines ?? [];
  const z = ctx.zData;
  const meta = ctx.meta ?? {};

  const item = (key, label, value, variant, iconClassName, options = {}) => ({
    key,
    label,
    value,
    variant,
    ...(iconClassName ? { iconClassName } : {}),
    ...(options.valueClassName ? { valueClassName: options.valueClassName } : {})
  });

  const padFour = (arr) => {
    const out = [...arr];
    while (out.length < 4) {
      out.push(item(`pad-${out.length}`, '—', '—', V[out.length % 4]));
    }
    return out.slice(0, 4);
  };

  if (slug === 'z-light' && z) {
    return padFour([
      item('d', 'Date', String(z.date ?? '—'), 'info'),
      item('po', 'POS orders', String(z.pos_order_count ?? '—'), 'success'),
      item('gr', 'POS gross', fmt(z.pos_gross_total), 'orange'),
      item('tx', 'POS tax', fmt(z.pos_tax_total), 'danger')
    ]);
  }

  if (slug === 'z-light') {
    return padFour([]);
  }

  if (slug === 'profit-loss' && lines.length >= 8) {
    const pos = lines[0];
    const inv = lines[1];
    const cogs = lines[3];
    const opex = lines[6];
    const netLine = lines[7];
    const totalExpenses =
      (Number(cogs?.amount ?? 0) || 0) + (Number(opex?.amount ?? 0) || 0);
    const netNum = Number(netLine?.amount ?? 0);
    const isProfit = netNum > 0;
    const isLoss = netNum < 0;
    const plVariant = isProfit ? 'success' : isLoss ? 'danger' : 'info';
    const plValueClass =
      netNum === 0 || netLine?.amount == null || netLine?.amount === ''
        ? undefined
        : isProfit
          ? 'text-success'
          : 'text-danger';

    const plLabel = isProfit
      ? 'Profit (Estimated)'
      : isLoss
        ? 'Loss (Estimated)'
        : 'Net (Estimated)';

    return padFour([
      item('pl-pos', String(pos.label ?? 'POS sales'), fmt(pos.amount), 'info'),
      item('pl-inv', String(inv.label ?? 'Invoice sales'), fmt(inv.amount), 'success'),
      item('pl-opex', 'Total expenses', fmt(totalExpenses), 'orange'),
      item(
        'pl-net',
        plLabel,
        fmt(netLine.amount),
        plVariant,
        undefined,
        plValueClass ? { valueClassName: plValueClass } : {}
      )
    ]);
  }

  if (slug === 'annual-report' && lines.length >= 6) {
    // Lines: POS, invoice, COGS, returns, operating expenses, profit, [supplier purchases]
    const pos = lines[0];
    const inv = lines[1];
    const cogs = lines[2];
    const opex = lines[4];
    const profitLine = lines[5];
    const totalExpenses =
      (Number(cogs?.amount ?? 0) || 0) + (Number(opex?.amount ?? 0) || 0);
    const netNum = Number(profitLine?.amount ?? 0);
    const isProfit = netNum > 0;
    const isLoss = netNum < 0;
    const plVariant = isProfit ? 'success' : isLoss ? 'danger' : 'info';
    const plValueClass =
      netNum === 0 || profitLine?.amount == null || profitLine?.amount === ''
        ? undefined
        : isProfit
          ? 'text-success'
          : 'text-danger';

    const plLabel = isProfit
      ? 'Profit (Estimated)'
      : isLoss
        ? 'Loss (Estimated)'
        : 'Net (Estimated)';

    return padFour([
      item('an-pos', String(pos.label ?? 'POS revenue'), fmt(pos.amount), 'info'),
      item('an-inv', String(inv.label ?? 'Invoice revenue'), fmt(inv.amount), 'success'),
      item('an-tx', 'Total expenses', fmt(totalExpenses), 'orange'),
      item(
        'an-pl',
        plLabel,
        fmt(profitLine.amount),
        plVariant,
        undefined,
        plValueClass ? { valueClassName: plValueClass } : {}
      )
    ]);
  }

  if (['income-report', 'profit-loss', 'annual-report'].includes(slug) && lines.length) {
    const slice = lines.slice(0, 4);
    return padFour(
      slice.map((ln, i) =>
        item(`ln-${i}`, String(ln.label ?? 'Line'), fmt(ln.amount), V[i % 4])
      )
    );
  }

  if (slug === 'tax-report' && rows.length) {
    const sumLines = rows.reduce((s, r) => s + Number(r.line_total ?? 0), 0);
    const sumTax =
      meta.pos_tax_total != null && meta.pos_tax_total !== '' ? Number(meta.pos_tax_total) : null;
    const top = rows.reduce(
      (m, r) => (Number(r.line_total ?? 0) > m ? Number(r.line_total) : m),
      0
    );
    return padFour([
      item('hdr', 'POS tax (headers)', sumTax != null && !Number.isNaN(sumTax) ? fmt(sumTax) : '—', 'info'),
      item('lines', 'Line sales (sum)', fmt(sumLines), 'success'),
      item('rates', 'Tax rate buckets', String(rows.length), 'orange'),
      item('top', 'Largest bucket', fmt(top), 'danger')
    ]);
  }

  if (slug === 'tax-report' && !rows.length && meta.pos_tax_total) {
    return padFour([
      item('hdr', 'POS tax (headers)', fmt(meta.pos_tax_total), 'info'),
      item('a', '—', '—', 'success'),
      item('b', '—', '—', 'orange'),
      item('c', '—', '—', 'danger')
    ]);
  }

  if (slug === 'return-summary' && meta.returnSummary) {
    const rs = meta.returnSummary;
    return padFour([
      item('c', 'Returns count', String(rs.count ?? '—'), 'info'),
      item('t', 'Returns total', fmt(rs.total_amount), 'success'),
      item('rows', 'Rows loaded', String(rows.length), 'orange'),
      item('avg', 'Avg return', fmt(Number(rs.total_amount) / Math.max(1, Number(rs.count) || 1)), 'danger')
    ]);
  }

  if (slug === 'best-sellers' && rows.length) {
    let rev = 0;
    let qty = 0;
    let profit = 0;
    for (const r of rows) {
      rev += Number(r.revenue ?? 0);
      qty += Number(r.qty_sold ?? 0);
      profit += Number(r.profit ?? 0);
    }
    return padFour([
      item('rev', 'Total revenue', fmt(rev), 'info'),
      item('qty', 'Units sold', fmtNum(qty), 'success'),
      item('sku', 'Products', String(rows.length), 'orange'),
      item('profit', 'Gross profit', fmt(profit), 'danger')
    ]);
  }

  if (slug === 'supplier-purchases' && rows.length) {
    let total = 0;
    let due = 0;
    for (const r of rows) {
      total += Number(r.grand_total ?? 0);
      due += Number(r.due_amount ?? 0);
    }
    return padFour([
      item('t', 'Purchases total', fmt(total), 'info'),
      item('d', 'Due total', fmt(due), 'success'),
      item('n', 'Documents', String(rows.length), 'orange'),
      item('avg', 'Avg purchase', fmt(total / Math.max(1, rows.length)), 'danger')
    ]);
  }

  if (slug === 'customer-report' && rows.length) {
    let spend = 0;
    let tx = 0;
    let profitSum = 0;
    for (const r of rows) {
      spend += Number(r.spend_total ?? 0);
      tx += Number(r.transaction_count ?? 0);
      profitSum += Number(r.profit_estimated ?? 0);
    }
    const n = Math.max(1, rows.length);
    const avgProfit = profitSum / n;
    const isProfit = avgProfit > 0;
    const isLoss = avgProfit < 0;
    const plVariant = isProfit ? 'success' : isLoss ? 'danger' : 'info';
    const plValueClass =
      avgProfit === 0 || !Number.isFinite(avgProfit)
        ? undefined
        : isProfit
          ? 'text-success'
          : 'text-danger';

    return padFour([
      item('sp', 'Total spend', fmt(spend), 'info'),
      item('tx', 'Transactions', fmtNum(tx), 'success'),
      item('cu', 'Customers', String(rows.length), 'orange'),
      item(
        'av',
        'Avg profit / customer',
        fmt(avgProfit),
        plVariant,
        undefined,
        plValueClass ? { valueClassName: plValueClass } : {}
      )
    ]);
  }

  if (slug === 'expense-report' && rows.length) {
    let amt = 0;
    for (const r of rows) {
      amt += Number(r.amount ?? 0);
    }
    return padFour([
      item('tot', 'Total expenses', fmt(amt), 'info'),
      item('cnt', 'Lines', String(rows.length), 'success'),
      item('avg', 'Avg line', fmt(amt / Math.max(1, rows.length)), 'orange'),
      item('p', 'Period', 'Selected range', 'danger')
    ]);
  }

  if (slug === 'payment-breakdown' && rows.length) {
    let total = 0;
    let maxA = 0;
    for (const r of rows) {
      const a = Number(r.amount ?? 0);
      total += a;
      if (a > maxA) {
        maxA = a;
      }
    }
    return padFour([
      item('tot', 'Total payments', fmt(total), 'info'),
      item('meth', 'Methods', String(rows.length), 'success'),
      item('max', 'Largest method', fmt(maxA), 'orange'),
      item('avg', 'Avg / method', fmt(total / Math.max(1, rows.length)), 'danger')
    ]);
  }

  if (slug === 'employee-sales' && rows.length) {
    let orders = 0;
    let gross = 0;
    for (const r of rows) {
      orders += Number(r.order_count ?? 0);
      gross += Number(r.total_amount ?? 0);
    }
    return padFour([
      item('g', 'Gross', fmt(gross), 'info'),
      item('o', 'Orders', String(orders), 'success'),
      item('e', 'Employees', String(rows.length), 'orange'),
      item('a', 'Avg / employee', fmt(gross / Math.max(1, rows.length)), 'danger')
    ]);
  }

  if (slug === 'returns-by-staff' && rows.length) {
    let ret = 0;
    let amt = 0;
    for (const r of rows) {
      ret += Number(r.return_count ?? 0);
      amt += Number(r.total_amount ?? 0);
    }
    return padFour([
      item('a', 'Return amount', fmt(amt), 'info'),
      item('c', 'Return count', String(ret), 'success'),
      item('s', 'Staff', String(rows.length), 'orange'),
      item('avg', 'Avg / staff', fmt(amt / Math.max(1, rows.length)), 'danger')
    ]);
  }

  if (slug === 'return-summary' && rows.length) {
    let total = 0;
    for (const r of rows) {
      total += Number(r.total_amount ?? 0);
    }
    return padFour([
      item('tot', 'Total returns', fmt(total), 'info'),
      item('n', 'Lines', String(rows.length), 'success'),
      item('avg', 'Avg return', fmt(total / Math.max(1, rows.length)), 'orange'),
      item('p', 'Period', 'Selected range', 'danger')
    ]);
  }

  if (slug === 'stock-history' && rows.length) {
    let q = 0;
    for (const r of rows) {
      q += Math.abs(Number(r.quantity ?? 0));
    }
    return padFour([
      item('m', 'Movements', String(rows.length), 'info'),
      item('q', 'Qty movement', fmtNum(q), 'success'),
      item('t', 'Types', String(new Set(rows.map((r) => r.type)).size), 'orange'),
      item('p', 'Period', 'Selected range', 'danger')
    ]);
  }

  if (slug === 'customer-purchase-lines' && meta.customerPurchaseSummary) {
    const s = meta.customerPurchaseSummary;
    let tableSum = 0;
    for (const r of rows) {
      tableSum += Number(r.line_total ?? 0);
    }
    const n = rows.length;
    return padFour([
      item('rev', 'Customer revenue', fmt(s.line_revenue_total), 'info'),
      item('lines', 'Lines shown', String(n), 'success'),
      item('avg', 'Avg line (table)', n > 0 ? fmt(tableSum / n) : '—', 'orange'),
      item(
        'profit',
        'Customer profit',
        fmt(s.customer_profit),
        'success',
        undefined,
        { valueClassName: 'text-success' }
      )
    ]);
  }

  if (slug === 'customer-purchase-lines' && rows.length) {
    let lt = 0;
    for (const r of rows) {
      lt += Number(r.line_total ?? 0);
    }
    return padFour([
      item('l', 'Line total', fmt(lt), 'info'),
      item('n', 'Lines', String(rows.length), 'success'),
      item('avg', 'Avg line', fmt(lt / Math.max(1, rows.length)), 'orange'),
      item('c', 'Customer', 'See filter', 'danger')
    ]);
  }

  if (slug === 'proposal-report' && meta.proposalSummary) {
    const s = meta.proposalSummary;
    return padFour([
      item('c', 'Proposals', String(s.count ?? '—'), 'info'),
      item('v', 'Total value', fmt(s.total_amount), 'success'),
      item('a', 'Accepted', String(s.accepted_count ?? '—'), 'orange'),
      item('rows', 'Rows loaded', String(rows.length), 'danger')
    ]);
  }

  // Default: row count + simple stats
  if (rows.length) {
    return padFour([
      item('rows', 'Rows', String(rows.length), 'info'),
      item('p', 'Period', 'Selected range', 'success'),
      item('a', '—', '—', 'orange'),
      item('b', '—', '—', 'danger')
    ]);
  }

  return padFour([]);
}
