import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchDashboardRecentProposals, fetchDashboardRecentTransactions } from "../../../tillflow/api/reports";
import { TillFlowApiError } from "../../../tillflow/api/errors";
import { useOptionalAuth } from "../../../tillflow/auth/AuthContext";
import { resolveMediaUrl } from "../../../tillflow/utils/resolveMediaUrl";
import { customer11 as defaultCustomerAvatar } from "../../../utils/imagepath";
import {
  DashboardDateFilterControls,
  useDashboardDateFilterParams
} from "./DashboardWidgetDateFilters.jsx";
import {
  recentTxExpenseRows,
  recentTxInvoiceRows,
  recentTxProposalRows,
  recentTxPurchaseRows,
  recentTxQuotationRows,
  recentTxSaleRows
} from "./dashboardRecentTransactionsData.js";

function TxStatusBadge({ variant, children }) {
  const v = variant && String(variant).trim() !== "" ? variant : "secondary";
  return (
    <span className={`badge badge-${v} badge-xs d-inline-flex align-items-center`}>
      <i className="ti ti-circle-filled fs-5 me-1" />
      {children}
    </span>
  );
}

function CustomerCell({ avatarSrc, name, refCode, nameTo = "#" }) {
  const img = avatarSrc || defaultCustomerAvatar;
  return (
    <div className="d-flex align-items-center file-name-icon">
      <Link to={nameTo} className="avatar avatar-md">
        <img src={img} className="img-fluid" alt="" />
      </Link>
      <div className="ms-2">
        <h6 className="fw-medium">
          <Link to={nameTo}>{name}</Link>
        </h6>
        <span className="fs-13 text-orange">{refCode}</span>
      </div>
    </div>
  );
}

const moneyFmtCache = new Map();

function formatMoney(amountStr, currency = "KES") {
  const n = Number.parseFloat(String(amountStr));
  if (Number.isNaN(n)) return String(amountStr);
  const code = String(currency || "KES").toUpperCase();
  if (!moneyFmtCache.has(code)) {
    try {
      moneyFmtCache.set(
        code,
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })
      );
    } catch {
      moneyFmtCache.set(code, null);
    }
  }
  const fmt = moneyFmtCache.get(code);
  return fmt ? fmt.format(n) : `${code} ${n.toFixed(2)}`;
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-muted fs-13 py-4">
        {message}
      </td>
    </tr>
  );
}

/**
 * Tabbed Recent Transactions card (Modern Dashboard + layout demo).
 * With `token`, loads live rows from `/reports/dashboard-recent-transactions` (reports.view).
 * Without `token`, shows demo data from `dashboardRecentTransactionsData.js`.
 */
export default function DashboardRecentTransactionsWidget({
  titleIconClassName = "me-2",
  token = null,
  limit = 10,
  initialDatePreset = "week"
}) {
  const {
    period,
    setPeriod,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    apiParams,
    canFetch
  } = useDashboardDateFilterParams(initialDatePreset);

  const auth = useOptionalAuth();
  /** Show Proposals tab: demo (no token) or user can view proposals. */
  const showProposalsTab = !token || Boolean(auth?.hasPermission?.("sales.proposals.view"));

  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      setLive(null);
      setLoading(false);
      return;
    }
    if (!canFetch) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const shouldFetchProposals = Boolean(
        token && canFetch && auth?.hasPermission?.("sales.proposals.view")
      );
      const [data, propData] = await Promise.all([
        fetchDashboardRecentTransactions(token, { limit, ...apiParams }),
        shouldFetchProposals
          ? fetchDashboardRecentProposals(token, { limit, ...apiParams })
          : Promise.resolve({ proposals: [] })
      ]);
      setLive({
        sales: Array.isArray(data?.sales) ? data.sales : [],
        purchases: Array.isArray(data?.purchases) ? data.purchases : [],
        quotations: Array.isArray(data?.quotations) ? data.quotations : [],
        expenses: Array.isArray(data?.expenses) ? data.expenses : [],
        invoices: Array.isArray(data?.invoices) ? data.invoices : [],
        proposals: shouldFetchProposals ? (Array.isArray(propData?.proposals) ? propData.proposals : []) : []
      });
    } catch (e) {
      setLive(null);
      setError(e instanceof TillFlowApiError ? e.message : "Could not load recent transactions.");
    } finally {
      setLoading(false);
    }
  }, [token, limit, apiParams, canFetch, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const demo = useMemo(
    () => ({
      sales: recentTxSaleRows,
      purchases: recentTxPurchaseRows,
      quotations: recentTxQuotationRows,
      proposals: recentTxProposalRows,
      expenses: recentTxExpenseRows,
      invoices: recentTxInvoiceRows
    }),
    []
  );

  const data = token && live ? live : demo;
  const useApi = Boolean(token && live && !error);

  const tabs = useMemo(() => {
    const saleRows = useApi
      ? data.sales.map((r) => ({
          key: `s-${r.id}`,
          date: r.date,
          cell: (
            <CustomerCell
              avatarSrc={resolveMediaUrl(r.avatar_url)}
              name={r.customer_name}
              refCode={r.reference ? `#${r.reference}` : "—"}
            />
          ),
          status: <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>,
          amount: (
            <td className="fs-16 fw-bold text-gray-9">
              {formatMoney(r.total, r.currency)}
            </td>
          )
        }))
      : data.sales.map((row) => ({
          key: `${row.date}-${row.ref}-${row.name}`,
          date: row.date,
          cell: (
            <CustomerCell avatarSrc={row.avatar} name={row.name} refCode={row.ref} />
          ),
          status: (
            <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
          ),
          amount: (
            <td className="fs-16 fw-bold text-gray-9">{row.total}</td>
          )
        }));

    const purchaseRows = useApi
      ? data.purchases.map((r) => ({
          key: `p-${r.id}`,
          date: r.date,
          middle: (
            <Link to="#" className="fw-semibold">
              {r.supplier_name}
            </Link>
          ),
          status: <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>,
          amount: (
            <td className="text-gray-9">{formatMoney(r.total, r.currency)}</td>
          )
        }))
      : data.purchases.map((row) => ({
          key: `${row.date}-${row.supplier}`,
          date: row.date,
          middle: (
            <Link to="#" className="fw-semibold">
              {row.supplier}
            </Link>
          ),
          status: (
            <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
          ),
          amount: <td className="text-gray-9">{row.total}</td>
        }));

    const quotationRows = useApi
      ? data.quotations.length === 0
        ? []
        : data.quotations.map((r, i) => ({
            key: `q-${r.id ?? i}`,
            date: r.date,
            cell: (
              <CustomerCell
                avatarSrc={resolveMediaUrl(r.avatar_url)}
                name={r.customer_name}
                refCode={r.reference ? String(r.reference) : "—"}
              />
            ),
            status: (
              <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>
            ),
            amount: (
              <td className="text-gray-9">{formatMoney(r.total, r.currency)}</td>
            )
          }))
      : data.quotations.map((row) => ({
          key: `${row.date}-${row.ref}-${row.name}`,
          date: row.date,
          cell: (
            <CustomerCell avatarSrc={row.avatar} name={row.name} refCode={row.ref} />
          ),
          status: (
            <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
          ),
          amount: <td className="text-gray-9">{row.total}</td>
        }));

    const proposalRows = !showProposalsTab
      ? []
      : useApi
        ? (data.proposals ?? []).map((r, i) => ({
            key: `prop-${r.id ?? i}`,
            date: r.date,
            cell: (
              <CustomerCell
                avatarSrc={resolveMediaUrl(r.avatar_url)}
                name={r.customer_name || "—"}
                refCode={r.reference ? String(r.reference) : "—"}
                nameTo={`/tillflow/admin/proposals/${encodeURIComponent(String(r.id))}/edit`}
              />
            ),
            status: (
              <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>
            ),
            amount: (
              <td className="text-gray-9">{formatMoney(r.total, r.currency)}</td>
            )
          }))
        : (data.proposals ?? []).map((row) => ({
            key: `${row.date}-${row.ref}-${row.name}`,
            date: row.date,
            cell: (
              <CustomerCell
                avatarSrc={row.avatar}
                name={row.name}
                refCode={row.ref}
                nameTo="#"
              />
            ),
            status: (
              <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
            ),
            amount: <td className="text-gray-9">{row.total}</td>
          }));

    const expenseRows = useApi
      ? data.expenses.map((r) => ({
          key: `e-${r.id}`,
          date: r.date,
          middle: (
            <>
              <h6 className="fw-medium">
                <Link to="#">{r.title}</Link>
              </h6>
              <span className="fs-13 text-orange">{r.reference}</span>
            </>
          ),
          status: (
            <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>
          ),
          amount: (
            <td className="text-gray-9">{formatMoney(r.total, r.currency)}</td>
          )
        }))
      : data.expenses.map((row, i) => ({
          key: `expense-${i}`,
          date: row.date,
          middle: (
            <>
              <h6 className="fw-medium">
                <Link to="#">{row.title}</Link>
              </h6>
              <span className="fs-13 text-orange">{row.code}</span>
            </>
          ),
          status: (
            <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
          ),
          amount: <td className="text-gray-9">{row.total}</td>
        }));

    const invoiceRows = useApi
      ? data.invoices.map((r) => ({
          key: `i-${r.id}`,
          cell: (
            <CustomerCell
              avatarSrc={resolveMediaUrl(r.avatar_url)}
              name={r.customer_name}
              refCode={r.invoice_ref ? `#${r.invoice_ref}` : `#${r.id}`}
            />
          ),
          due: r.due_date,
          status: (
            <TxStatusBadge variant={r.badge_variant}>{r.status_label}</TxStatusBadge>
          ),
          amount: (
            <td className="text-gray-9">{formatMoney(r.total, r.currency)}</td>
          )
        }))
      : data.invoices.map((row) => ({
          key: row.ref,
          cell: (
            <CustomerCell avatarSrc={row.avatar} name={row.name} refCode={row.ref} />
          ),
          due: row.dueDate,
          status: (
            <TxStatusBadge variant={row.statusVariant}>{row.statusLabel}</TxStatusBadge>
          ),
          amount: <td className="text-gray-9">{row.amount}</td>
        }));

    return [
      {
        id: "sale",
        label: "Sale",
        paneClassName: "tab-pane show active",
        table: (
          <table className="table table-borderless custom-table">
            <thead className="thead-light">
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {saleRows.length === 0 ? (
                <EmptyRow colSpan={4} message="No recent POS sales." />
              ) : (
                saleRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.date}</td>
                    <td>{r.cell}</td>
                    <td>{r.status}</td>
                    {r.amount}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )
      },
      {
        id: "purchase-transaction",
        label: "Purchase",
        paneClassName: "tab-pane fade",
        table: (
          <table className="table table-borderless custom-table">
            <thead className="thead-light">
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.length === 0 ? (
                <EmptyRow colSpan={4} message="No recent purchases." />
              ) : (
                purchaseRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.date}</td>
                    <td>{r.middle}</td>
                    <td>{r.status}</td>
                    {r.amount}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )
      },
      {
        id: "quotation",
        label: "Quotation",
        paneClassName: "tab-pane",
        table: (
          <table className="table table-borderless custom-table">
            <thead className="thead-light">
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quotationRows.length === 0 ? (
                <EmptyRow
                  colSpan={4}
                  message={
                    useApi
                      ? "No quotations module in the database yet."
                      : "No data."
                  }
                />
              ) : (
                quotationRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.date}</td>
                    <td>{r.cell}</td>
                    <td>{r.status}</td>
                    {r.amount}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )
      },
      ...(showProposalsTab
        ? [
            {
              id: "proposal",
              label: "Proposal",
              paneClassName: "tab-pane fade",
              table: (
                <table className="table table-borderless custom-table">
                  <thead className="thead-light">
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposalRows.length === 0 ? (
                      <EmptyRow
                        colSpan={4}
                        message={
                          useApi
                            ? "No recent proposals in this period."
                            : "No data."
                        }
                      />
                    ) : (
                      proposalRows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.date}</td>
                          <td>{r.cell}</td>
                          <td>{r.status}</td>
                          {r.amount}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )
            }
          ]
        : []),
      {
        id: "expenses",
        label: "Expenses",
        paneClassName: "tab-pane fade",
        table: (
          <table className="table table-borderless custom-table">
            <thead className="thead-light">
              <tr>
                <th>Date</th>
                <th>Expenses</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.length === 0 ? (
                <EmptyRow colSpan={4} message="No recent expenses." />
              ) : (
                expenseRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.date}</td>
                    <td>{r.middle}</td>
                    <td>{r.status}</td>
                    {r.amount}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )
      },
      {
        id: "invoices",
        label: "Invoices",
        paneClassName: "tab-pane",
        table: (
          <table className="table table-borderless custom-table">
            <thead className="thead-light">
              <tr>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.length === 0 ? (
                <EmptyRow colSpan={4} message="No recent invoices." />
              ) : (
                invoiceRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.cell}</td>
                    <td>{r.due}</td>
                    <td>{r.status}</td>
                    {r.amount}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )
      }
    ];
  }, [data, useApi, showProposalsTab]);

  return (
    <div className="card flex-fill">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div className="d-inline-flex align-items-center">
            <span className={`title-icon bg-soft-orange fs-16 ${titleIconClassName}`}>
              <i className="ti ti-flag" />
            </span>
            <h5 className="card-title mb-0">Recent Transactions</h5>
          </div>
          {token ? (
            <DashboardDateFilterControls
              period={period}
              onPeriodChange={setPeriod}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={onDateFromChange}
              onDateToChange={onDateToChange}
            />
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="card-body py-4 text-center text-muted fs-13">Loading…</div>
      ) : error ? (
        <div className="card-body py-3">
          <p className="text-danger fs-13 mb-0">{error}</p>
        </div>
      ) : (
        <div className="card-body p-0">
          <ul className="nav nav-tabs nav-justified transaction-tab">
            {tabs.map((tab, idx) => (
              <li className="nav-item" key={tab.id}>
                <Link
                  className={idx === 0 ? "nav-link active" : "nav-link"}
                  to={`#${tab.id}`}
                  data-bs-toggle="tab">
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="tab-content">
            {tabs.map((tab) => (
              <div className={tab.paneClassName} id={tab.id} key={tab.id}>
                <div className="table-responsive">{tab.table}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
