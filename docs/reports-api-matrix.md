# Reports API matrix (TillFlow)

All routes require **`Authorization: Bearer`** and tenant context; permission **`reports.view`**.

| UI slug | Method | Path | Query params |
| ------- | ------ | ---- | ------------ |
| (store filter) | GET | `/reports/store-options` | — |
| pos-sales | GET | `/reports/sales-summary` | `from`, `to`, `store_id?` |
| best-sellers | GET | `/reports/best-sellers` | `from`, `to`, `store_id?` |
| stock-history | GET | `/reports/stock-movements` | `from`, `to` |
| invoice-report | GET | `/reports/outstanding-invoices` | — |
| supplier-purchases | GET | `/reports/supplier-purchases` | `from`, `to` |
| customer-report | GET | `/reports/customer-kpis` | `from`, `to` |
| customer-purchase-lines | GET | `/reports/customer-purchase-lines` | `customer_id` (required) |
| expense-report | GET | `/reports/expenses-by-category` | `from`, `to` |
| income-report | GET | `/reports/income-summary` | `from`, `to` |
| tax-report | GET | `/reports/tax-summary` | `from`, `to`, `store_id?` |
| profit-loss | GET | `/reports/profit-loss` | `from`, `to` |
| annual-report | GET | `/reports/annual-summary` | `year` |
| payment-breakdown | GET | `/reports/payment-breakdown` | `from`, `to`, `store_id?` |
| z-light | GET | `/reports/z-light` | `date` (YYYY-MM-DD) |
| return-summary | GET | `/reports/return-summary` | `from`, `to`, `store_id?` |
| employee-sales | GET | `/reports/employee-sales` | `from`, `to`, `store_id?` |
| returns-by-staff | GET | `/reports/returns-by-staff` | `from`, `to` |
| proposal-report | GET | `/reports/proposals` | `from`, `to`, `all_dates` (`1` = no date filter) — requires **`sales.proposals.view`** in addition to **`reports.view`** |

Existing: **`/reports/low-stock`**, **`/reports/expired-items`**.

**Blockers / follow-ups:** Full cash-drawer Z (paid in/out) needs new tables. `pos_orders.store_id` is persisted for new orders (migration applied).
