<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\PosOrderPayment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseReturn;
use App\Models\SalesReturn;
use App\Models\StockAdjustment;
use App\Models\StockTransferLine;
use App\Models\StoreManager;
use App\Models\Supplier;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ReportsModuleController extends Controller
{
    public function storeOptions(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = StoreManager::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->orderBy('store_name')
            ->get(['id', 'store_name'])
            ->map(fn (StoreManager $s) => [
                'id' => (int) $s->id,
                'store_name' => $s->store_name,
            ])->values()->all();

        return response()->json([
            'message' => 'Stores for reports retrieved.',
            'stores' => $rows,
        ]);
    }

    /** Minimal customer list for report filters (reports.view; no sales.manage required). */
    public function customerOptions(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Customer $c) => [
                'id' => (int) $c->id,
                'name' => $c->name,
            ])->values()->all();

        return response()->json([
            'message' => 'Customers for reports retrieved.',
            'customers' => $rows,
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon, 2: array{from: string, to: string}}
     */
    private function parseDateRange(Request $request): array
    {
        $defaultTo = Carbon::today();
        $defaultFrom = $defaultTo->copy()->subDays(30);

        $fromRaw = $request->query('from');
        $toRaw = $request->query('to');

        try {
            $from = $fromRaw ? Carbon::parse((string) $fromRaw)->startOfDay() : $defaultFrom->copy()->startOfDay();
        } catch (\Throwable) {
            $from = $defaultFrom->copy()->startOfDay();
        }

        try {
            $to = $toRaw ? Carbon::parse((string) $toRaw)->endOfDay() : $defaultTo->copy()->endOfDay();
        } catch (\Throwable) {
            $to = $defaultTo->copy()->endOfDay();
        }

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to, ['from' => $from->toDateString(), 'to' => $to->toDateString()]];
    }

    /**
     * Date range for reports, or no date restriction when all_dates=1.
     *
     * @return array{0: Carbon|null, 1: Carbon|null, 2: array<string, mixed>, 3: bool}
     */
    private function parseDateRangeOrAll(Request $request): array
    {
        if ($request->boolean('all_dates')) {
            return [null, null, ['all' => true, 'from' => null, 'to' => null], true];
        }

        [$from, $to, $range] = $this->parseDateRange($request);

        return [$from, $to, $range, false];
    }

    private function parseStoreId(Request $request): ?int
    {
        $s = $request->query('store_id');
        if ($s === null || $s === '') {
            return null;
        }

        $id = (int) $s;

        return $id > 0 ? $id : null;
    }

    private function parseYear(Request $request): int
    {
        $y = (int) $request->query('year', Carbon::now()->year);

        return $y >= 2000 && $y <= 2100 ? $y : (int) Carbon::now()->year;
    }

    /**
     * Valid `period` query values for dashboard preset filters.
     *
     * @return list<string>
     */
    private function dashboardPeriodPresetKeys(): array
    {
        return ['today', 'week', 'month', '6months', '1year', 'all'];
    }

    /**
     * Map a preset key to [from, to]. All-time has null bounds; rolling windows end end-of-day today.
     *
     * @return array{from: ?Carbon, to: ?Carbon, period: string}
     */
    private function rangeForDashboardPeriodPreset(string $p): array
    {
        $now = Carbon::now();
        if ($p === 'all') {
            return ['from' => null, 'to' => null, 'period' => $p];
        }
        if ($p === 'today') {
            return ['from' => $now->copy()->startOfDay(), 'to' => $now->copy()->endOfDay(), 'period' => $p];
        }
        if ($p === 'week') {
            return ['from' => $now->copy()->startOfWeek(), 'to' => $now->copy()->endOfWeek(), 'period' => $p];
        }
        if ($p === 'month') {
            return ['from' => $now->copy()->startOfMonth(), 'to' => $now->copy()->endOfMonth(), 'period' => $p];
        }

        $end = $now->copy()->endOfDay();
        $from = match ($p) {
            '6months' => $now->copy()->subMonths(6)->startOfDay(),
            '1year' => $now->copy()->subYear()->startOfDay(),
            default => null,
        };
        if ($from === null) {
            throw new \InvalidArgumentException('Invalid dashboard period: '.$p);
        }

        return ['from' => $from, 'to' => $end, 'period' => $p];
    }

    /**
     * Optional `period` for dashboard widgets: omit query for all-time (legacy).
     *
     * @return array{from: ?Carbon, to: ?Carbon, period: ?string}
     */
    private function parseOptionalDashboardPeriod(Request $request): array
    {
        $p = $request->query('period');
        if ($p === null || $p === '' || ! is_string($p)) {
            return ['from' => null, 'to' => null, 'period' => null];
        }
        if (! in_array($p, $this->dashboardPeriodPresetKeys(), true)) {
            return ['from' => null, 'to' => null, 'period' => null];
        }

        return $this->rangeForDashboardPeriodPreset($p);
    }

    /**
     * Custom `from`/`to` (Y-m-d) takes precedence over `period` for dashboard widgets.
     *
     * @return array{from: ?Carbon, to: ?Carbon, period: ?string}
     */
    private function parseDashboardWidgetDateRange(Request $request): array
    {
        $fromRaw = $request->query('from');
        $toRaw = $request->query('to');
        if (is_string($fromRaw) && $fromRaw !== '' && is_string($toRaw) && $toRaw !== '') {
            try {
                $from = Carbon::parse($fromRaw)->startOfDay();
                $to = Carbon::parse($toRaw)->endOfDay();
                if ($from->gt($to)) {
                    [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
                }

                return [
                    'from' => $from,
                    'to' => $to,
                    'period' => 'custom',
                ];
            } catch (\Throwable) {
            }
        }

        return $this->parseOptionalDashboardPeriod($request);
    }

    public function salesSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
        $storeId = $this->parseStoreId($request);

        $q = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED);

        if (! $allDates && $from !== null && $to !== null) {
            $q->whereBetween('completed_at', [$from, $to]);
        }

        if ($storeId !== null) {
            $q->where('store_id', $storeId);
        }

        $orders = $q->with(['cashier:id,name', 'store:id,store_name'])->orderByDesc('completed_at')->get();

        $rows = $orders->map(fn (PosOrder $o) => [
            'order_no' => $o->order_no,
            'completed_at' => $o->completed_at?->toIso8601String(),
            'total_amount' => (string) $o->total_amount,
            'tax_amount' => (string) $o->tax_amount,
            'currency' => $o->currency,
            'cashier_name' => $o->cashier?->name,
            'store_name' => $o->store?->store_name,
            'customer_name' => $o->customer_name,
        ])->values()->all();

        $grossTotal = (float) $orders->sum('total_amount');
        $netSales = 0.0;
        foreach ($orders as $o) {
            $sub = $o->subtotal_amount;
            if ($sub !== null && $sub !== '') {
                $netSales += (float) $sub;
            } else {
                $netSales += max(0.0, (float) $o->total_amount - (float) ($o->tax_amount ?? 0));
            }
        }

        $cogsQ = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsQ->whereBetween('po.completed_at', [$from, $to]);
        }
        if ($storeId !== null) {
            $cogsQ->where('po.store_id', $storeId);
        }
        $cogsTotal = (float) ($cogsQ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);
        $grossProfit = round($grossTotal - $cogsTotal, 2);

        return response()->json([
            'message' => 'Sales summary retrieved.',
            'range' => $range,
            'summary' => [
                'order_count' => $orders->count(),
                'gross_total' => (string) round($grossTotal, 2),
                'tax_total' => (string) round((float) $orders->sum('tax_amount'), 2),
                'net_sales' => (string) round($netSales, 2),
                'cogs_total' => (string) round($cogsTotal, 2),
                'gross_profit' => (string) $grossProfit,
            ],
            'rows' => $rows,
        ]);
    }

    public function paymentBreakdown(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
        $storeId = $this->parseStoreId($request);

        $posQuery = PosOrderPayment::query()
            ->where('pos_order_payments.tenant_id', $tenant->id)
            ->join('pos_orders', 'pos_orders.id', '=', 'pos_order_payments.pos_order_id')
            ->where('pos_orders.status', PosOrder::STATUS_COMPLETED);

        if (! $allDates && $from !== null && $to !== null) {
            $posQuery->whereBetween('pos_orders.completed_at', [$from, $to]);
        }

        if ($storeId !== null) {
            $posQuery->where('pos_orders.store_id', $storeId);
        }

        $posByMethod = $posQuery
            ->selectRaw('pos_order_payments.method as method, SUM(pos_order_payments.amount) as total')
            ->groupBy('pos_order_payments.method')
            ->get();

        $invByMethod = InvoicePayment::query()
            ->where('tenant_id', $tenant->id);

        if (! $allDates && $from !== null && $to !== null) {
            $invByMethod->whereBetween('paid_at', [$from, $to]);
        }

        $invByMethod = $invByMethod
            ->selectRaw('payment_method as method, SUM(amount) as total')
            ->groupBy('payment_method')
            ->get();

        $merge = [];
        foreach ($posByMethod as $r) {
            $m = (string) $r->method;
            $merge[$m] = ($merge[$m] ?? 0) + (float) $r->total;
        }
        foreach ($invByMethod as $r) {
            $m = (string) $r->method;
            $merge[$m] = ($merge[$m] ?? 0) + (float) $r->total;
        }

        $rows = collect($merge)->map(fn ($total, $method) => [
            'method' => $method,
            'label' => $this->paymentMethodLabel($method),
            'amount' => (string) round((float) $total, 2),
        ])->values()->sortBy('method')->values()->all();

        return response()->json([
            'message' => 'Payment breakdown retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    private function paymentMethodLabel(string $method): string
    {
        return match ($method) {
            'cash' => 'Cash',
            'card' => 'Card',
            'mpesa' => 'M-Pesa / mobile money',
            'bank_transfer' => 'Bank transfer',
            'cheque' => 'Cheque',
            'opening_balance' => 'Opening balance',
            'other' => 'Other',
            default => $method,
        };
    }

    private function invoiceBalanceDue(Invoice $inv): float
    {
        $total = (float) $inv->total_amount;
        $paid = (float) $inv->amount_paid;

        return round(max(0.0, $total - $paid), 2);
    }

    public function outstandingInvoices(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->with(['customer:id,name'])
            ->orderByDesc('issued_at')
            ->get()
            ->map(function (Invoice $inv) {
                $total = (float) $inv->total_amount;
                $paid = (float) $inv->amount_paid;
                $due = round(max(0, $total - $paid), 2);

                return [
                    'invoice_ref' => $inv->invoice_ref,
                    'issued_at' => $inv->issued_at?->toDateString(),
                    'due_at' => $inv->due_at?->toDateString(),
                    'status' => $inv->status,
                    'customer_name' => $inv->customer?->name ?? $inv->customer_name,
                    'total_amount' => (string) $total,
                    'amount_paid' => (string) $paid,
                    'balance_due' => (string) $due,
                ];
            })
            ->filter(fn (array $r) => (float) $r['balance_due'] > 0.009)
            ->values()
            ->all();

        return response()->json([
            'message' => 'Outstanding invoices retrieved.',
            'rows' => $rows,
        ]);
    }

    /**
     * Full invoice register for the themed invoice report: date range, optional customer & status,
     * KPI summary, and all non-draft / non-cancelled rows (matches legacy invoice report table).
     */
    public function invoiceRegister(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $customerIdRaw = $request->query('customer_id');
        $customerId = null;
        if ($customerIdRaw !== null && $customerIdRaw !== '') {
            $cid = (int) $customerIdRaw;
            $customerId = $cid > 0 ? $cid : null;
        }

        $statusFilter = $request->query('status');
        $statusFilter = is_string($statusFilter) && $statusFilter !== '' ? $statusFilter : null;
        if ($statusFilter !== null && ! in_array($statusFilter, Invoice::STATUSES, true)) {
            $statusFilter = null;
        }

        $q = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED]);

        if (! $allDates && $from !== null && $to !== null) {
            $q->whereBetween('issued_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);
        }

        if ($customerId !== null) {
            $q->where('customer_id', $customerId);
        }
        if ($statusFilter !== null) {
            $q->where('status', $statusFilter);
        }

        $invoices = $q->with(['customer:id,name'])
            ->orderByDesc('issued_at')
            ->get();

        $today = Carbon::today();
        $totalAmount = 0.0;
        $totalPaid = 0.0;
        $totalBalance = 0.0;
        $totalOverdue = 0.0;

        $rows = [];
        foreach ($invoices as $inv) {
            $total = (float) $inv->total_amount;
            $paid = (float) $inv->amount_paid;
            $balance = round(max(0, $total - $paid), 2);

            $totalAmount += $total;
            $totalPaid += $paid;
            $totalBalance += $balance;

            $due = $inv->due_at;
            if ($balance > 0.009 && $due !== null && $due->copy()->startOfDay()->lt($today)) {
                $totalOverdue += $balance;
            }

            $rows[] = [
                'id' => (int) $inv->id,
                'invoice_id' => (int) $inv->id,
                'invoice_ref' => $inv->invoice_ref,
                'issued_at' => $inv->issued_at?->toDateString(),
                'due_at' => $inv->due_at?->toDateString(),
                'customer_name' => $inv->customer?->name ?? $inv->customer_name ?? '',
                'total_amount' => (string) round($total, 2),
                'amount_paid' => (string) round($paid, 2),
                'balance_due' => (string) $balance,
                'status' => $inv->status,
            ];
        }

        return response()->json([
            'message' => 'Invoice register retrieved.',
            'range' => $range,
            'summary' => [
                'total_invoice_amount' => (string) round($totalAmount, 2),
                'total_paid' => (string) round($totalPaid, 2),
                'total_balance_due' => (string) round($totalBalance, 2),
                'total_overdue' => (string) round($totalOverdue, 2),
            ],
            'rows' => $rows,
        ]);
    }

    public function taxSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
        $storeId = $this->parseStoreId($request);

        $posTaxQ = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED);
        if (! $allDates && $from !== null && $to !== null) {
            $posTaxQ->whereBetween('completed_at', [$from, $to]);
        }
        if ($storeId !== null) {
            $posTaxQ->where('store_id', $storeId);
        }
        $posTax = (float) $posTaxQ->sum('tax_amount');

        $byRate = PosOrderItem::query()
            ->join('pos_orders', 'pos_orders.id', '=', 'pos_order_items.pos_order_id')
            ->where('pos_order_items.tenant_id', $tenant->id)
            ->where('pos_orders.status', PosOrder::STATUS_COMPLETED);
        if (! $allDates && $from !== null && $to !== null) {
            $byRate->whereBetween('pos_orders.completed_at', [$from, $to]);
        }
        if ($storeId !== null) {
            $byRate->where('pos_orders.store_id', $storeId);
        }
        $byRateRows = $byRate
            ->selectRaw('pos_order_items.tax_percent as rate, SUM(pos_order_items.line_total) as line_total, COUNT(*) as line_count')
            ->groupBy('pos_order_items.tax_percent')
            ->orderBy('pos_order_items.tax_percent')
            ->get()
            ->map(fn ($r) => [
                'tax_percent' => (string) $r->rate,
                'line_total' => (string) round((float) $r->line_total, 2),
                'line_count' => (int) $r->line_count,
            ])->all();

        return response()->json([
            'message' => 'Tax summary retrieved.',
            'range' => $range,
            'pos_tax_total' => (string) round($posTax, 2),
            'by_tax_rate' => $byRateRows,
        ]);
    }

    public function zReportLight(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $day = $request->query('date', Carbon::today()->toDateString());
        try {
            $d = Carbon::parse((string) $day)->startOfDay();
        } catch (\Throwable) {
            $d = Carbon::today()->startOfDay();
        }
        $start = $d->copy();
        $end = $d->copy()->endOfDay();

        $posSales = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereBetween('completed_at', [$start, $end]);

        $returnTotal = SalesReturn::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('returned_at', [$start, $end])
            ->sum('total_amount');

        return response()->json([
            'message' => 'End-of-day (light) retrieved.',
            'date' => $d->toDateString(),
            'pos_order_count' => $posSales->count(),
            'pos_gross_total' => (string) round((float) (clone $posSales)->sum('total_amount'), 2),
            'pos_tax_total' => (string) round((float) (clone $posSales)->sum('tax_amount'), 2),
            'returns_total' => (string) round((float) $returnTotal, 2),
            'note' => 'Cash drawer / paid-in-out not tracked — light Z from transactional data only.',
        ]);
    }

    public function returnSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
        $storeId = $this->parseStoreId($request);

        $q = SalesReturn::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $q->whereBetween('returned_at', [$from, $to]);
        }
        if ($storeId !== null) {
            $q->where('store_id', $storeId);
        }

        $rows = $q->with(['customer:id,name', 'store:id,store_name'])
            ->orderByDesc('returned_at')
            ->get()
            ->map(fn (SalesReturn $r) => [
                'sales_return_no' => $r->sales_return_no,
                'returned_at' => $r->returned_at?->toIso8601String(),
                'total_amount' => (string) $r->total_amount,
                'quantity' => $r->quantity,
                'status' => $r->status,
                'payment_status' => $r->payment_status,
                'customer_name' => $r->customer?->name,
                'store_name' => $r->store?->store_name,
            ])->values()->all();

        return response()->json([
            'message' => 'Return summary retrieved.',
            'range' => $range,
            'summary' => [
                'count' => count($rows),
                'total_amount' => (string) round((float) collect($rows)->sum(fn ($x) => (float) $x['total_amount']), 2),
            ],
            'rows' => $rows,
        ]);
    }

    public function employeeSales(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
        $storeId = $this->parseStoreId($request);

        $q = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('created_by');

        if (! $allDates && $from !== null && $to !== null) {
            $q->whereBetween('completed_at', [$from, $to]);
        }

        if ($storeId !== null) {
            $q->where('store_id', $storeId);
        }

        $rows = $q
            ->with(['cashier:id,name', 'store:id,store_name'])
            ->get()
            ->groupBy('created_by')
            ->map(function ($orders, $userId) {
                /** @var Collection<int, PosOrder> $orders */
                $first = $orders->first();
                $cashier = $first?->cashier;

                return [
                    'user_id' => (int) $userId,
                    'user_name' => $cashier?->name ?? '—',
                    'order_count' => $orders->count(),
                    'total_amount' => (string) round((float) $orders->sum('total_amount'), 2),
                    'store_name' => $first?->store?->store_name,
                ];
            })->values()->all();

        usort($rows, fn ($a, $b) => ((float) $b['total_amount'] <=> (float) $a['total_amount']));

        return response()->json([
            'message' => 'Employee sales retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    public function returnsByStaff(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $returnsQ = SalesReturn::query()
            ->where('tenant_id', $tenant->id)
            ->whereNotNull('created_by');

        if (! $allDates && $from !== null && $to !== null) {
            $returnsQ->whereBetween('returned_at', [$from, $to]);
        }

        $rows = $returnsQ
            ->with('creator:id,name')
            ->get()
            ->groupBy('created_by')
            ->map(function ($returns, $userId) {
                return [
                    'user_id' => (int) $userId,
                    'user_name' => $returns->first()?->creator?->name ?? '—',
                    'return_count' => $returns->count(),
                    'total_amount' => (string) round((float) $returns->sum('total_amount'), 2),
                    'total_qty' => (int) $returns->sum('quantity'),
                ];
            })->values()->all();

        usort($rows, fn ($a, $b) => ((float) $b['total_amount'] <=> (float) $a['total_amount']));

        return response()->json([
            'message' => 'Returns by staff retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    public function profitLoss(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $revPosQ = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED);
        if (! $allDates && $from !== null && $to !== null) {
            $revPosQ->whereBetween('completed_at', [$from, $to]);
        }
        $revPos = (float) $revPosQ->sum('total_amount');

        $revInvQ = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED]);
        if (! $allDates && $from !== null && $to !== null) {
            $revInvQ->whereBetween('issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $revInv = (float) $revInvQ->sum('total_amount');

        $cogsPosQ = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsPosQ->whereBetween('po.completed_at', [$from, $to]);
        }
        $cogsPos = (float) $cogsPosQ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')->value('cogs') ?? 0;

        $cogsInvQ = DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsInvQ->whereBetween('i.issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $cogsInv = (float) $cogsInvQ->selectRaw('SUM(ii.quantity * p.buying_price) as cogs')->value('cogs') ?? 0;

        $expensesQ = Expense::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $expensesQ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        }
        $expenses = (float) $expensesQ->sum('amount');

        $returnsQ = SalesReturn::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $returnsQ->whereBetween('returned_at', [$from, $to]);
        }
        $returns = (float) $returnsQ->sum('total_amount');

        $purchasesQ = Purchase::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $purchasesQ->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()]);
        }
        $purchasesTotal = (float) $purchasesQ->sum('grand_total');

        $revenue = round($revPos + $revInv, 2);
        $cogs = round($cogsPos + $cogsInv, 2);
        $gross = round($revenue - $cogs - $returns, 2);
        $net = round($gross - $expenses, 2);

        return response()->json([
            'message' => 'Profit & loss retrieved.',
            'range' => $range,
            'note' => 'COGS uses current product buying_price × qty; POS+invoice revenue may overlap with some workflows — validate for your tenant. Purchases are supplier order totals for the period (not subtracted again in net profit; COGS reflects cost of goods sold).',
            'lines' => [
                ['label' => 'POS sales (gross)', 'amount' => (string) round($revPos, 2)],
                ['label' => 'Invoice sales (gross)', 'amount' => (string) round($revInv, 2)],
                ['label' => 'Revenue subtotal', 'amount' => (string) $revenue],
                ['label' => 'COGS (estimated)', 'amount' => (string) $cogs],
                ['label' => 'Sales returns', 'amount' => (string) round($returns, 2)],
                ['label' => 'Gross profit (estimated)', 'amount' => (string) $gross],
                ['label' => 'Operating expenses', 'amount' => (string) round($expenses, 2)],
                ['label' => 'Net profit (estimated)', 'amount' => (string) $net],
                ['label' => 'Supplier purchases', 'amount' => (string) round($purchasesTotal, 2)],
            ],
        ]);
    }

    public function bestSellers(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $fromRaw = $request->query('from');
        $toRaw = $request->query('to');
        $usedCustomDates = false;
        $periodParam = $request->query('period');
        $usedPeriod = false;

        if (is_string($fromRaw) && $fromRaw !== '' && is_string($toRaw) && $toRaw !== '') {
            try {
                $from = Carbon::parse($fromRaw)->startOfDay();
                $to = Carbon::parse($toRaw)->endOfDay();
                if ($from->gt($to)) {
                    [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
                }
                $allDates = false;
                $range = ['from' => $from->toDateString(), 'to' => $to->toDateString()];
                $usedCustomDates = true;
                $periodParam = 'custom';
                $usedPeriod = true;
            } catch (\Throwable) {
                $from = null;
                $to = null;
            }
        }

        if (! $usedCustomDates) {
            $periodParam = $request->query('period');
            $usedPeriod = is_string($periodParam) && in_array($periodParam, $this->dashboardPeriodPresetKeys(), true);

            if ($usedPeriod) {
                $r = $this->rangeForDashboardPeriodPreset($periodParam);
                $from = $r['from'];
                $to = $r['to'];
                $allDates = $r['from'] === null && $r['to'] === null;
                $range = $allDates
                    ? ['all' => true, 'from' => null, 'to' => null]
                    : ['from' => $from->toDateString(), 'to' => $to->toDateString()];
            } else {
                [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);
            }
        }

        $storeId = $this->parseStoreId($request);
        $limit = min(100, max(1, (int) $request->query('limit', 100)));

        $q = PosOrderItem::query()
            ->join('pos_orders', 'pos_orders.id', '=', 'pos_order_items.pos_order_id')
            ->join('products as p', 'p.id', '=', 'pos_order_items.product_id')
            ->where('pos_order_items.tenant_id', $tenant->id)
            ->where('pos_orders.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at');

        if (! $allDates && $from !== null && $to !== null) {
            $q->whereRaw('COALESCE(pos_orders.completed_at, pos_orders.created_at) BETWEEN ? AND ?', [$from, $to]);
        }

        if ($storeId !== null) {
            $q->where('pos_orders.store_id', $storeId);
        }

        $rows = $q
            ->selectRaw(
                'pos_order_items.product_id, MAX(pos_order_items.product_name) as product_name, MAX(pos_order_items.sku) as sku, MAX(p.image_path) as image_path, SUM(pos_order_items.quantity) as qty_sold, SUM(pos_order_items.line_total) as revenue, SUM(pos_order_items.line_total) - SUM(pos_order_items.quantity * p.buying_price) as profit'
            )
            ->groupBy('pos_order_items.product_id')
            ->orderByDesc(DB::raw('SUM(pos_order_items.line_total)'))
            ->limit($limit)
            ->get()
            ->map(function ($r) {
                $path = $r->image_path;
                $imageUrl = is_string($path) && $path !== '' ? Storage::disk('public')->url($path) : null;
                $revenue = (float) $r->revenue;
                $profit = (float) $r->profit;
                $marginPct = $revenue > 0 ? round(($profit / $revenue) * 100, 1) : 0.0;

                return [
                    'product_id' => $r->product_id,
                    'product_name' => $r->product_name,
                    'sku' => $r->sku,
                    'image_url' => $imageUrl,
                    'qty_sold' => (string) $r->qty_sold,
                    'revenue' => (string) round($revenue, 2),
                    'profit' => (string) round($profit, 2),
                    'margin_percent' => (string) $marginPct,
                ];
            })->all();

        return response()->json([
            'message' => 'Best sellers retrieved.',
            'range' => $range,
            'period' => ($usedPeriod || $usedCustomDates) ? $periodParam : null,
            'rows' => $rows,
        ]);
    }

    public function stockMovements(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $adjQ = StockAdjustment::query()
            ->where('tenant_id', $tenant->id);

        if (! $allDates && $from !== null && $to !== null) {
            $adjQ->whereBetween('created_at', [$from, $to]);
        }

        $adj = $adjQ
            ->with(['product:id,name,sku', 'store:id,store_name'])
            ->orderByDesc('created_at')
            ->limit(500)
            ->get()
            ->map(fn (StockAdjustment $a) => [
                'type' => 'adjustment',
                'at' => $a->created_at?->toIso8601String(),
                'reference' => $a->reference,
                'product_name' => $a->product?->name,
                'sku' => $a->product?->sku,
                'store_name' => $a->store?->store_name,
                'quantity' => (string) $a->quantity,
                'notes' => $a->notes,
            ]);

        $xfer = StockTransferLine::query()
            ->whereHas('stockTransfer', function ($q) use ($tenant, $from, $to, $allDates): void {
                $q->where('tenant_id', $tenant->id);
                if (! $allDates && $from !== null && $to !== null) {
                    $q->whereBetween('created_at', [$from, $to]);
                }
            })
            ->with(['product:id,name,sku', 'stockTransfer'])
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->map(function (StockTransferLine $line) {
                $t = $line->stockTransfer;

                return [
                    'type' => 'transfer',
                    'at' => $t?->created_at?->toIso8601String(),
                    'reference' => $t?->ref_number ?? '',
                    'product_name' => $line->product?->name,
                    'sku' => $line->product?->sku,
                    'store_name' => null,
                    'quantity' => (string) $line->qty,
                    'notes' => $t?->notes,
                ];
            });

        $rows = $adj->concat($xfer)->sortByDesc('at')->values()->take(500)->all();

        return response()->json([
            'message' => 'Stock movements retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    public function supplierPurchases(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $pq = Purchase::query()
            ->where('tenant_id', $tenant->id);

        if (! $allDates && $from !== null && $to !== null) {
            $pq->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()]);
        }

        $rows = $pq
            ->with('supplier:id,name')
            ->orderByDesc('purchase_date')
            ->get()
            ->map(fn (Purchase $p) => [
                'reference' => $p->reference,
                'purchase_date' => $p->purchase_date?->toDateString(),
                'supplier_name' => $p->supplier?->name,
                'status' => $p->status,
                'grand_total' => (string) $p->grand_total,
                'paid_amount' => (string) $p->paid_amount,
                'due_amount' => (string) $p->due_amount,
            ])->all();

        return response()->json([
            'message' => 'Supplier purchases retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    public function customerKpis(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $posQ = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('customer_id');
        if (! $allDates && $from !== null && $to !== null) {
            $posQ->whereBetween('completed_at', [$from, $to]);
        }
        $posByCustomer = $posQ
            ->selectRaw('customer_id, COUNT(*) as orders, SUM(total_amount) as spend')
            ->groupBy('customer_id')
            ->get()
            ->keyBy('customer_id');

        $invQ = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNotNull('customer_id');
        if (! $allDates && $from !== null && $to !== null) {
            $invQ->whereBetween('issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $invByCustomer = $invQ
            ->selectRaw('customer_id, COUNT(*) as invoices, SUM(total_amount) as spend')
            ->groupBy('customer_id')
            ->get()
            ->keyBy('customer_id');

        $ids = $posByCustomer->keys()->merge($invByCustomer->keys())->unique()->values();
        if ($ids->isEmpty()) {
            return response()->json([
                'message' => 'Customer KPIs retrieved.',
                'range' => $range,
                'note' => 'Transaction count = POS orders + invoices in range. profit_estimated = spend − COGS (buying_price × qty) − expenses tagged to the customer.',
                'rows' => [],
            ]);
        }

        $customers = Customer::query()->where('tenant_id', $tenant->id)->whereIn('id', $ids)->get()->keyBy('id');

        $cogsPosQ = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('po.customer_id')
            ->whereIn('po.customer_id', $ids)
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsPosQ->whereBetween('po.completed_at', [$from, $to]);
        }
        $cogsPosByCustomer = $cogsPosQ
            ->groupBy('po.customer_id')
            ->selectRaw('po.customer_id as customer_id, SUM(poi.quantity * p.buying_price) as cogs')
            ->get()
            ->keyBy('customer_id');

        $cogsInvQ = DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNotNull('i.customer_id')
            ->whereIn('i.customer_id', $ids)
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsInvQ->whereBetween('i.issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $cogsInvByCustomer = $cogsInvQ
            ->groupBy('i.customer_id')
            ->selectRaw('i.customer_id as customer_id, SUM(ii.quantity * p.buying_price) as cogs')
            ->get()
            ->keyBy('customer_id');

        $expenseByCustomerQ = Expense::query()
            ->where('tenant_id', $tenant->id)
            ->whereNotNull('customer_id')
            ->whereIn('customer_id', $ids);
        if (! $allDates && $from !== null && $to !== null) {
            $expenseByCustomerQ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        }
        $expenseByCustomer = $expenseByCustomerQ
            ->selectRaw('customer_id, SUM(amount) as total')
            ->groupBy('customer_id')
            ->get()
            ->keyBy('customer_id');

        $rows = [];
        foreach ($ids as $cid) {
            $p = $posByCustomer->get($cid);
            $i = $invByCustomer->get($cid);
            $orders = (int) ($p->orders ?? 0);
            $invoices = (int) ($i->invoices ?? 0);
            $spend = (float) ($p->spend ?? 0) + (float) ($i->spend ?? 0);
            $visits = $orders + $invoices;
            $cogsPos = (float) (optional($cogsPosByCustomer->get($cid))->cogs ?? 0);
            $cogsInv = (float) (optional($cogsInvByCustomer->get($cid))->cogs ?? 0);
            $cogs = $cogsPos + $cogsInv;
            $custExp = (float) (optional($expenseByCustomer->get($cid))->total ?? 0);
            $profitEstimated = round($spend - $cogs - $custExp, 2);
            $rows[] = [
                'customer_id' => (int) $cid,
                'customer_name' => $customers->get($cid)?->name ?? '—',
                'transaction_count' => $visits,
                'pos_orders' => $orders,
                'invoices' => $invoices,
                'spend_total' => (string) round($spend, 2),
                'profit_estimated' => (string) $profitEstimated,
            ];
        }

        usort($rows, fn ($a, $b) => ((float) $b['spend_total'] <=> (float) $a['spend_total']));

        return response()->json([
            'message' => 'Customer KPIs retrieved.',
            'range' => $range,
            'note' => 'Transaction count = POS orders + invoices in range. profit_estimated = spend − COGS (buying_price × qty) − expenses tagged to the customer.',
            'rows' => $rows,
        ]);
    }

    public function expensesByCategory(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $eq = Expense::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $eq->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        }

        $rows = $eq
            ->with('category:id,name')
            ->orderByDesc('expense_date')
            ->get()
            ->map(fn (Expense $e) => [
                'expense_date' => $e->expense_date?->toDateString(),
                'title' => $e->title,
                'category' => $e->category?->name ?? '—',
                'amount' => (string) $e->amount,
                'payment_status' => $e->payment_status,
            ])->all();

        return response()->json([
            'message' => 'Expenses retrieved.',
            'range' => $range,
            'rows' => $rows,
        ]);
    }

    public function incomeSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        [$from, $to, $range, $allDates] = $this->parseDateRangeOrAll($request);

        $posQ = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED);
        if (! $allDates && $from !== null && $to !== null) {
            $posQ->whereBetween('completed_at', [$from, $to]);
        }
        $pos = (float) $posQ->sum('total_amount');

        $invQ = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED]);
        if (! $allDates && $from !== null && $to !== null) {
            $invQ->whereBetween('issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $inv = (float) $invQ->sum('total_amount');

        $revenueCombined = round($pos + $inv, 2);

        $cogsPosQ = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsPosQ->whereBetween('po.completed_at', [$from, $to]);
        }
        $cogsPos = (float) ($cogsPosQ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsInvQ = DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNull('p.deleted_at');
        if (! $allDates && $from !== null && $to !== null) {
            $cogsInvQ->whereBetween('i.issued_at', [$from->toDateString(), $to->toDateString()]);
        }
        $cogsInv = (float) ($cogsInvQ->selectRaw('SUM(ii.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsTotal = round($cogsPos + $cogsInv, 2);

        $expensesQ = Expense::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $expensesQ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]);
        }
        $expenses = (float) $expensesQ->sum('amount');

        $returnsQ = SalesReturn::query()
            ->where('tenant_id', $tenant->id);
        if (! $allDates && $from !== null && $to !== null) {
            $returnsQ->whereBetween('returned_at', [$from, $to]);
        }
        $returns = (float) $returnsQ->sum('total_amount');

        $grossAfterReturns = round($revenueCombined - $cogsTotal - $returns, 2);
        $netProfitLoss = round($grossAfterReturns - $expenses, 2);

        return response()->json([
            'message' => 'Income summary retrieved.',
            'range' => $range,
            'note' => 'POS + invoiced revenue in period (may double-count if your workflow posts both). COGS, returns, and expenses match the P&L report logic for the same dates.',
            'lines' => [
                ['label' => 'POS revenue', 'amount' => (string) round($pos, 2)],
                ['label' => 'Invoice revenue', 'amount' => (string) round($inv, 2)],
                ['label' => 'Combined (check for overlap)', 'amount' => (string) $revenueCombined],
                ['label' => 'Profit / loss (estimated)', 'amount' => (string) $netProfitLoss],
            ],
        ]);
    }

    public function annualSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $year = $this->parseYear($request);
        $from = Carbon::create($year, 1, 1)->startOfDay();
        $to = Carbon::create($year, 12, 31)->endOfDay();

        $pos = (float) PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereBetween('completed_at', [$from, $to])
            ->sum('total_amount');

        $inv = (float) Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereBetween('issued_at', [$from->toDateString(), $to->toDateString()])
            ->sum('total_amount');

        $revenueCombined = round($pos + $inv, 2);

        $cogsPos = (float) (DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at')
            ->whereBetween('po.completed_at', [$from, $to])
            ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsInv = (float) (DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNull('p.deleted_at')
            ->whereBetween('i.issued_at', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('SUM(ii.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsTotal = round($cogsPos + $cogsInv, 2);

        $expenses = (float) Expense::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $returns = (float) SalesReturn::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('returned_at', [$from, $to])
            ->sum('total_amount');

        $grossAfterReturns = round($revenueCombined - $cogsTotal - $returns, 2);
        $netProfitLoss = round($grossAfterReturns - $expenses, 2);

        $purchasesTotal = (float) Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()])
            ->sum('grand_total');

        return response()->json([
            'message' => 'Annual summary retrieved.',
            'year' => $year,
            'note' => 'Full calendar year (same basis as P&L). COGS and sales returns above are amounts deducted before profit; supplier purchases are stock procurement for the year and are not subtracted on top of COGS (which already reflects cost of goods sold).',
            'lines' => [
                ['label' => 'POS revenue', 'amount' => (string) round($pos, 2)],
                ['label' => 'Invoice revenue', 'amount' => (string) round($inv, 2)],
                ['label' => 'COGS (estimated)', 'amount' => (string) $cogsTotal],
                ['label' => 'Sales returns', 'amount' => (string) round($returns, 2)],
                ['label' => 'Operating expenses', 'amount' => (string) round($expenses, 2)],
                ['label' => 'Profit / loss (estimated)', 'amount' => (string) $netProfitLoss],
                ['label' => 'Supplier purchases', 'amount' => (string) round($purchasesTotal, 2)],
            ],
        ]);
    }

    public function purchaseLines(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $customerId = (int) $request->query('customer_id', 0);
        if ($customerId < 1) {
            return response()->json(['message' => 'customer_id required.', 'rows' => []], 422);
        }

        $posRev = (float) DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->where('poi.tenant_id', $tenant->id)
            ->where('po.customer_id', $customerId)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->sum('poi.line_total');

        $invRev = (float) DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->where('i.tenant_id', $tenant->id)
            ->where('i.customer_id', $customerId)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->sum('ii.line_total');

        $revenueTotal = $posRev + $invRev;

        $cogsPos = (float) (DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('poi.tenant_id', $tenant->id)
            ->where('po.customer_id', $customerId)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsInv = (float) (DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->where('i.customer_id', $customerId)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(ii.quantity * p.buying_price) as cogs')->value('cogs') ?? 0);

        $cogsTotal = $cogsPos + $cogsInv;

        $expenseTotal = (float) Expense::query()
            ->where('tenant_id', $tenant->id)
            ->where('customer_id', $customerId)
            ->sum('amount');

        $customerProfit = round($revenueTotal - $cogsTotal - $expenseTotal, 2);

        $posRows = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->where('poi.tenant_id', $tenant->id)
            ->where('po.customer_id', $customerId)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->orderByDesc('po.completed_at')
            ->limit(500)
            ->get([
                'po.id as pos_order_id',
                'po.order_no as ref',
                'po.completed_at as line_date',
                'poi.product_name',
                'poi.quantity',
                'poi.line_total',
            ])
            ->map(fn ($r) => [
                'source' => 'pos',
                'pos_order_id' => (int) $r->pos_order_id,
                'ref' => $r->ref,
                'date' => $r->line_date ? Carbon::parse($r->line_date)->toIso8601String() : null,
                'product_name' => $r->product_name,
                'quantity' => (string) $r->quantity,
                'line_total' => (string) $r->line_total,
            ]);

        $invRows = DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->where('i.tenant_id', $tenant->id)
            ->where('i.customer_id', $customerId)
            ->whereNull('i.deleted_at')
            ->orderByDesc('i.issued_at')
            ->limit(500)
            ->get([
                'i.id as invoice_id',
                'i.invoice_ref as ref',
                'i.issued_at as line_date',
                'ii.product_name',
                'ii.quantity',
                'ii.line_total',
            ])
            ->map(fn ($r) => [
                'source' => 'invoice',
                'invoice_id' => (int) $r->invoice_id,
                'ref' => $r->ref,
                'date' => $r->line_date,
                'product_name' => $r->product_name,
                'quantity' => (string) $r->quantity,
                'line_total' => (string) $r->line_total,
            ]);

        $rows = $posRows->concat($invRows)->sortByDesc('date')->values()->take(500)->all();

        return response()->json([
            'message' => 'Customer purchase lines retrieved.',
            'summary' => [
                'line_revenue_total' => (string) round($revenueTotal, 2),
                'cogs_total' => (string) round($cogsTotal, 2),
                'customer_expenses_total' => (string) round($expenseTotal, 2),
                'customer_profit' => (string) $customerProfit,
            ],
            'rows' => $rows,
        ]);
    }

    /**
     * Top customers by combined POS + invoiced revenue (non-draft / non-cancelled invoices).
     */
    public function dashboardTopCustomers(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $limit = min(50, max(1, (int) $request->query('limit', 5)));
        $dr = $this->parseDashboardWidgetDateRange($request);
        $from = $dr['from'];
        $to = $dr['to'];

        $posQ = DB::table('pos_orders as po')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('po.customer_id');
        if ($from !== null && $to !== null) {
            $posQ->whereRaw('COALESCE(po.completed_at, po.created_at) BETWEEN ? AND ?', [$from, $to]);
        }
        $posRows = $posQ
            ->groupBy('po.customer_id')
            ->selectRaw('po.customer_id as customer_id, COUNT(*) as pos_orders, COALESCE(SUM(po.total_amount), 0) as spend')
            ->get();

        $invQ = DB::table('invoices as i')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNotNull('i.customer_id');
        if ($from !== null && $to !== null) {
            $invQ->whereRaw('COALESCE(i.issued_at, DATE(i.created_at)) BETWEEN ? AND ?', [$from->toDateString(), $to->toDateString()]);
        }
        $invRows = $invQ
            ->groupBy('i.customer_id')
            ->selectRaw('i.customer_id as customer_id, COUNT(*) as invoices, COALESCE(SUM(i.total_amount), 0) as spend')
            ->get();

        $merged = [];
        foreach ($posRows as $r) {
            $cid = (int) $r->customer_id;
            $merged[$cid] = [
                'customer_id' => $cid,
                'pos_orders' => (int) $r->pos_orders,
                'invoices' => 0,
                'total_spend' => (float) $r->spend,
            ];
        }
        foreach ($invRows as $r) {
            $cid = (int) $r->customer_id;
            if (! isset($merged[$cid])) {
                $merged[$cid] = [
                    'customer_id' => $cid,
                    'pos_orders' => 0,
                    'invoices' => (int) $r->invoices,
                    'total_spend' => (float) $r->spend,
                ];
            } else {
                $merged[$cid]['invoices'] = (int) $r->invoices;
                $merged[$cid]['total_spend'] += (float) $r->spend;
            }
        }

        if ($merged === []) {
            return response()->json([
                'message' => 'Top customers by sales volume',
                'period' => $dr['period'],
                'range' => $from !== null && $to !== null
                    ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
                    : ['all' => true, 'from' => null, 'to' => null],
                'rows' => [],
            ]);
        }

        uasort($merged, static fn ($a, $b) => $b['total_spend'] <=> $a['total_spend']);
        $slice = array_slice($merged, 0, $limit, true);
        $ids = array_keys($slice);
        $customers = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'avatar_url'])
            ->keyBy('id');

        $rows = [];
        foreach ($slice as $cid => $row) {
            $c = $customers->get($cid);
            $rows[] = [
                'customer_id' => $cid,
                'customer_name' => $c?->name ?? 'Unknown',
                'avatar_url' => $c?->avatar_url,
                'transaction_count' => $row['pos_orders'] + $row['invoices'],
                'pos_orders' => $row['pos_orders'],
                'invoices' => $row['invoices'],
                'total_spend' => (string) round($row['total_spend'], 2),
            ];
        }

        return response()->json([
            'message' => 'Top customers by sales volume',
            'period' => $dr['period'],
            'range' => $from !== null && $to !== null
                ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
                : ['all' => true, 'from' => null, 'to' => null],
            'rows' => $rows,
        ]);
    }

    /**
     * Top customers by sum of unpaid invoice balances, with per-status counts.
     */
    public function topCustomersByArrears(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $limit = min(50, max(1, (int) $request->query('limit', 5)));
        $dr = $this->parseDashboardWidgetDateRange($request);
        $from = $dr['from'];
        $to = $dr['to'];

        $invQ = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNotNull('customer_id');
        if ($from !== null && $to !== null) {
            $invQ->whereRaw('COALESCE(issued_at, DATE(created_at)) BETWEEN ? AND ?', [$from->toDateString(), $to->toDateString()]);
        }
        $invoices = $invQ->get(['id', 'customer_id', 'total_amount', 'amount_paid', 'status']);

        $agg = [];
        foreach ($invoices as $inv) {
            $balance = $this->invoiceBalanceDue($inv);
            if ($balance <= 0.009) {
                continue;
            }
            $cid = (int) $inv->customer_id;
            if (! isset($agg[$cid])) {
                $agg[$cid] = [
                    'total_pending' => 0.0,
                    'unpaid_invoices' => 0,
                    'overdue_invoices' => 0,
                    'partially_paid_invoices' => 0,
                ];
            }
            $agg[$cid]['total_pending'] += $balance;
            $agg[$cid]['unpaid_invoices']++;
            $st = (string) $inv->status;
            if (strcasecmp($st, Invoice::STATUS_OVERDUE) === 0) {
                $agg[$cid]['overdue_invoices']++;
            }
            if (strcasecmp($st, Invoice::STATUS_PARTIALLY_PAID) === 0) {
                $agg[$cid]['partially_paid_invoices']++;
            }
        }

        if ($agg === []) {
            return response()->json([
                'message' => 'Top customers by outstanding balance',
                'period' => $dr['period'],
                'range' => $from !== null && $to !== null
                    ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
                    : ['all' => true, 'from' => null, 'to' => null],
                'rows' => [],
            ]);
        }

        uasort($agg, static fn ($a, $b) => $b['total_pending'] <=> $a['total_pending']);
        $slice = array_slice($agg, 0, $limit, true);
        $ids = array_keys($slice);
        $customers = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'avatar_url'])
            ->keyBy('id');

        $rows = [];
        foreach ($slice as $cid => $row) {
            $c = $customers->get($cid);
            $rows[] = [
                'customer_id' => $cid,
                'customer_name' => $c?->name ?? 'Unknown',
                'avatar_url' => $c?->avatar_url,
                'unpaid_invoices' => $row['unpaid_invoices'],
                'overdue_invoices' => $row['overdue_invoices'],
                'partially_paid_invoices' => $row['partially_paid_invoices'],
                'total_pending' => (string) round($row['total_pending'], 2),
            ];
        }

        return response()->json([
            'message' => 'Top customers by outstanding balance',
            'period' => $dr['period'],
            'range' => $from !== null && $to !== null
                ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
                : ['all' => true, 'from' => null, 'to' => null],
            'rows' => $rows,
        ]);
    }

    /**
     * POS line items aggregated by catalog category for the admin dashboard widget.
     */
    public function dashboardTopCategories(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $limit = min(15, max(3, (int) $request->query('limit', 8)));

        $fromRaw = $request->query('from');
        $toRaw = $request->query('to');
        $from = null;
        $to = null;
        $period = 'week';

        if (is_string($fromRaw) && $fromRaw !== '' && is_string($toRaw) && $toRaw !== '') {
            try {
                $from = Carbon::parse($fromRaw)->startOfDay();
                $to = Carbon::parse($toRaw)->endOfDay();
                if ($from->gt($to)) {
                    [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
                }
                $period = 'custom';
            } catch (\Throwable) {
                $from = null;
                $to = null;
            }
        }

        if ($period !== 'custom') {
            $period = $request->query('period', 'week');
            if (! is_string($period) || ! in_array($period, $this->dashboardPeriodPresetKeys(), true)) {
                $period = 'week';
            }

            $r = $this->rangeForDashboardPeriodPreset($period);
            $from = $r['from'];
            $to = $r['to'];
        }

        $query = DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->where('poi.tenant_id', $tenant->id)
            ->where('po.tenant_id', $tenant->id)
            ->where('p.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at')
            ->whereNotNull('poi.product_id');

        if ($from !== null && $to !== null) {
            $query->whereRaw('COALESCE(po.completed_at, po.created_at) BETWEEN ? AND ?', [$from, $to]);
        }

        $aggregated = $query
            ->selectRaw('p.category_id as category_id')
            ->selectRaw('MAX(COALESCE(c.name, ?)) as category_name', ['Uncategorized'])
            ->selectRaw('SUM(poi.quantity) as units_sold')
            ->selectRaw('SUM(poi.line_total) as revenue')
            ->groupBy('p.category_id')
            ->orderByRaw('SUM(poi.quantity) DESC')
            ->limit($limit)
            ->get();

        $rows = $aggregated->map(function ($r) {
            $name = trim((string) $r->category_name);
            if ($name === '') {
                $name = 'Uncategorized';
            }

            return [
                'category_id' => $r->category_id !== null ? (int) $r->category_id : null,
                'category_name' => $name,
                'units_sold' => (string) round((float) $r->units_sold, 3),
                'revenue' => (string) round((float) $r->revenue, 2),
            ];
        })->values()->all();

        $categoriesCount = Category::query()
            ->where('tenant_id', $tenant->id)
            ->count();

        $productsCount = Product::query()
            ->where('tenant_id', $tenant->id)
            ->count();

        $rangePayload = $from !== null && $to !== null
            ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
            : ['from' => null, 'to' => null];

        return response()->json([
            'message' => 'Top categories by POS sales volume',
            'period' => $period,
            'range' => $rangePayload,
            'totals' => [
                'categories_count' => $categoriesCount,
                'products_count' => $productsCount,
            ],
            'rows' => $rows,
        ]);
    }

    /**
     * Headline counts (suppliers, customers, POS orders) and first vs repeat customer split for the dashboard.
     *
     * Query: optional `period` or custom `from`/`to` (same as other dashboard widgets). Supplier/customer totals are
     * all-time catalog counts; orders and the customer split use the selected date range (or all-time when unbounded).
     */
    public function dashboardOverallInformation(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $dr = $this->parseDashboardWidgetDateRange($request);
        $from = $dr['from'];
        $to = $dr['to'];
        $period = $dr['period'];

        $suppliersCount = Supplier::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->count();

        $customersCount = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->count();

        $ordersBase = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED);
        if ($from !== null && $to !== null) {
            $ordersBase->whereRaw('COALESCE(completed_at, created_at) BETWEEN ? AND ?', [$from, $to]);
        }
        $ordersCount = (int) $ordersBase->count();

        $perCustomerQ = DB::table('pos_orders')
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('customer_id');
        if ($from !== null && $to !== null) {
            $perCustomerQ->whereRaw('COALESCE(completed_at, created_at) BETWEEN ? AND ?', [$from, $to]);
        }
        $perCustomer = $perCustomerQ
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as order_count')
            ->get();

        $customersSingleOrder = 0;
        $customersRepeat = 0;
        foreach ($perCustomer as $row) {
            $c = (int) $row->order_count;
            if ($c === 1) {
                $customersSingleOrder++;
            } elseif ($c >= 2) {
                $customersRepeat++;
            }
        }

        $splitTotal = $customersSingleOrder + $customersRepeat;
        $radialFirstPct = $splitTotal > 0 ? round(100.0 * $customersSingleOrder / $splitTotal, 1) : 0.0;
        $radialRepeatPct = $splitTotal > 0 ? round(100.0 * $customersRepeat / $splitTotal, 1) : 0.0;

        $rangePayload = $from !== null && $to !== null
            ? ['from' => $from->toDateString(), 'to' => $to->toDateString()]
            : ['from' => null, 'to' => null];

        return response()->json([
            'message' => 'Overall information retrieved.',
            'period' => $period,
            'range' => $rangePayload,
            'suppliers_count' => $suppliersCount,
            'customers_count' => $customersCount,
            'orders_count' => $ordersCount,
            'customers_single_order_in_range' => $customersSingleOrder,
            'customers_repeat_in_range' => $customersRepeat,
            'radial_series' => [$radialFirstPct, $radialRepeatPct],
        ]);
    }

    /**
     * Sales, purchase & expense time series for the dashboard chart, plus headline KPI numbers.
     *
     * @param  Request  $request  query: period=1d|1w|1m|3m|6m|1y
     */
    public function dashboardSalesPurchase(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $period = $request->query('period', '1y');
        if (! is_string($period) || ! in_array($period, ['1d', '1w', '1m', '3m', '6m', '1y'], true)) {
            $period = '1y';
        }

        $now = Carbon::now();
        $buckets = $this->buildSalesPurchaseBuckets($now, $period);

        $labels = [];
        $salesSeries = [];
        $purchaseSeries = [];
        $expenseSeries = [];

        $invoiceHourShare = null;
        $purchaseHourShare = null;
        $expenseHourShare = null;
        if ($period === '1d') {
            $dayStr = $now->toDateString();
            $invDay = (float) Invoice::query()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
                ->whereBetween('issued_at', [$dayStr, $dayStr])
                ->sum('total_amount');
            $invoiceHourShare = $invDay / 24.0;
            $purDay = (float) Purchase::query()
                ->where('tenant_id', $tenant->id)
                ->whereBetween('purchase_date', [$dayStr, $dayStr])
                ->sum('grand_total');
            $purchaseHourShare = $purDay / 24.0;
            $expDay = $this->sumExpensesForDashboard($tenant, $dayStr, $dayStr);
            $expenseHourShare = $expDay / 24.0;
        }

        $invCogsHourShare = null;
        if ($period === '1d') {
            $d0 = $now->copy()->startOfDay();
            $d1 = $now->copy()->endOfDay();
            $invCogsDay = $this->cogsInvForDashboardBucket($tenant, $d0, $d1);
            $invCogsHourShare = $invCogsDay / 24.0;
        }

        $profitSeries = [];

        foreach ($buckets as $b) {
            /** @var Carbon $from */
            /** @var Carbon $to */
            $from = $b['from'];
            $to = $b['to'];
            $labels[] = $b['label'];

            $pos = (float) PosOrder::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', PosOrder::STATUS_COMPLETED)
                ->whereBetween('completed_at', [$from, $to])
                ->sum('total_amount');

            if ($period === '1d') {
                $inv = $invoiceHourShare ?? 0.0;
            } else {
                $inv = (float) Invoice::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
                    ->whereBetween('issued_at', [$from->toDateString(), $to->toDateString()])
                    ->sum('total_amount');
            }

            $salesVal = round($pos + $inv, 2);
            $salesSeries[] = $salesVal;

            if ($period === '1d') {
                $pur = $purchaseHourShare ?? 0.0;
            } else {
                $pur = (float) Purchase::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()])
                    ->sum('grand_total');
            }
            $purchaseSeries[] = round($pur, 2);

            if ($period === '1d') {
                $exp = $expenseHourShare ?? 0.0;
            } else {
                $exp = $this->sumExpensesForDashboard(
                    $tenant,
                    $from->toDateString(),
                    $to->toDateString()
                );
            }
            $expenseSeries[] = round($exp, 2);

            $cogsPosB = $this->cogsPosForDashboardBucket($tenant, $from, $to);
            $cogsInvB = $period === '1d'
                ? (float) ($invCogsHourShare ?? 0.0)
                : $this->cogsInvForDashboardBucket($tenant, $from, $to);
            $cogsBucket = round($cogsPosB + $cogsInvB, 2);
            $profitSeries[] = round($salesVal - $cogsBucket - $exp, 2);
        }

        $rangeFrom = $buckets[0]['from'] ?? $now->copy()->startOfYear();
        $rangeTo = $buckets[count($buckets) - 1]['to'] ?? $now;

        $totalSalesRange = (float) array_sum($salesSeries);
        $totalPurchaseRange = (float) array_sum($purchaseSeries);
        $totalExpenseRange = (float) array_sum($expenseSeries);
        $totalProfitRange = (float) array_sum($profitSeries);

        $revPos = (float) PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->sum('total_amount');
        $revInv = (float) Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->sum('total_amount');
        $salesReturns = (float) SalesReturn::query()
            ->where('tenant_id', $tenant->id)
            ->sum('total_amount');
        $purchaseTotal = (float) Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->sum('grand_total');
        $purchaseReturns = (float) PurchaseReturn::query()
            ->where('tenant_id', $tenant->id)
            ->sum('grand_total');
        $expensesAll = (float) Expense::query()
            ->where('tenant_id', $tenant->id)
            ->sum('amount');

        $outstandingInv = (float) Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED, Invoice::STATUS_PAID])
            ->get()
            ->sum(function (Invoice $inv): float {
                $total = (float) $inv->total_amount;
                $paid = (float) $inv->amount_paid;

                return max(0.0, round($total - $paid, 2));
            });

        $cogsPos = (float) (DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(poi.quantity * p.buying_price) as cogs')
            ->value('cogs') ?? 0);
        $cogsInv = (float) (DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(ii.quantity * p.buying_price) as cogs')
            ->value('cogs') ?? 0);
        $revenue = $revPos + $revInv;
        $cogs = $cogsPos + $cogsInv;
        $gross = round($revenue - $cogs - $salesReturns, 2);
        $netProfit = round($gross - $expensesAll, 2);

        return response()->json([
            'message' => 'Sales, purchase & expense series for dashboard',
            'currency' => 'KES',
            'kpi' => [
                'total_sales' => (string) round($revenue, 2),
                'total_sales_returns' => (string) round($salesReturns, 2),
                'total_purchase' => (string) round($purchaseTotal, 2),
                'total_purchase_returns' => (string) round($purchaseReturns, 2),
                'total_expenses' => (string) round($expensesAll, 2),
                'invoice_due' => (string) round($outstandingInv, 2),
                'estimated_profit' => (string) $netProfit,
            ],
            'chart' => [
                'period' => $period,
                'range' => [
                    'from' => $rangeFrom->toIso8601String(),
                    'to' => $rangeTo->toIso8601String(),
                ],
                'labels' => $labels,
                'sales' => $salesSeries,
                'purchases' => $purchaseSeries,
                'expenses' => $expenseSeries,
                /** Estimated net per bucket: sales (POS+invoice) − COGS − expenses (same window as chart). */
                'profit' => $profitSeries,
                'totals' => [
                    'sales' => (string) round($totalSalesRange, 2),
                    'purchases' => (string) round($totalPurchaseRange, 2),
                    'expenses' => (string) round($totalExpenseRange, 2),
                    'profit' => (string) round($totalProfitRange, 2),
                ],
            ],
        ]);
    }

    /**
     * COGS from POS lines in a datetime range (matches completed POS orders in that window).
     */
    private function cogsPosForDashboardBucket(Tenant $tenant, Carbon $from, Carbon $to): float
    {
        return (float) (DB::table('pos_order_items as poi')
            ->join('pos_orders as po', 'po.id', '=', 'poi.pos_order_id')
            ->join('products as p', 'p.id', '=', 'poi.product_id')
            ->where('po.tenant_id', $tenant->id)
            ->where('po.status', PosOrder::STATUS_COMPLETED)
            ->whereBetween('po.completed_at', [$from, $to])
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(poi.quantity * COALESCE(p.buying_price, 0)) as cogs')
            ->value('cogs') ?? 0);
    }

    /**
     * COGS from invoice lines in a datetime range.
     */
    private function cogsInvForDashboardBucket(Tenant $tenant, Carbon $from, Carbon $to): float
    {
        return (float) (DB::table('invoice_items as ii')
            ->join('invoices as i', 'i.id', '=', 'ii.invoice_id')
            ->join('products as p', 'p.id', '=', 'ii.product_id')
            ->where('i.tenant_id', $tenant->id)
            ->whereNull('i.deleted_at')
            ->whereNotIn('i.status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->whereBetween('i.issued_at', [$from, $to])
            ->whereNull('p.deleted_at')
            ->selectRaw('SUM(ii.quantity * COALESCE(p.buying_price, 0)) as cogs')
            ->value('cogs') ?? 0);
    }

    /**
     * Sum expense amounts in a date range using the effective posting date:
     * `expense_date` when set, otherwise the calendar date of `created_at`.
     * (Rows with null `expense_date` were previously omitted from `whereBetween(expense_date, …)`.)
     */
    private function sumExpensesForDashboard(Tenant $tenant, string $fromDate, string $toDate): float
    {
        return (float) DB::table('expenses')
            ->where('tenant_id', $tenant->id)
            ->whereRaw(
                'DATE(COALESCE(`expense_date`, `created_at`)) BETWEEN ? AND ?',
                [$fromDate, $toDate]
            )
            ->sum('amount');
    }

    /**
     * @return list<array{from: Carbon, to: Carbon, label: string}>
     */
    private function buildSalesPurchaseBuckets(Carbon $now, string $period): array
    {
        $out = [];
        if ($period === '1d') {
            $dayStart = $now->copy()->startOfDay();
            for ($h = 0; $h < 24; $h++) {
                $from = $dayStart->copy()->addHours($h);
                $to = $from->copy()->addHour()->subSecond();
                $out[] = [
                    'from' => $from,
                    'to' => $to,
                    'label' => $from->format('H:i'),
                ];
            }

            return $out;
        }

        if ($period === '1w') {
            for ($i = 6; $i >= 0; $i--) {
                $d = $now->copy()->subDays($i)->startOfDay();
                $out[] = [
                    'from' => $d,
                    'to' => $d->copy()->endOfDay(),
                    'label' => $d->format('D'),
                ];
            }

            return $out;
        }

        if ($period === '1m') {
            for ($i = 29; $i >= 0; $i--) {
                $d = $now->copy()->subDays($i)->startOfDay();
                $out[] = [
                    'from' => $d,
                    'to' => $d->copy()->endOfDay(),
                    'label' => $d->format('j M'),
                ];
            }

            return $out;
        }

        if ($period === '3m') {
            $start = $now->copy()->subDays(89)->startOfDay();
            for ($i = 0; $i < 12; $i++) {
                $from = $start->copy()->addDays((int) floor($i * 7.5));
                $to = $start->copy()->addDays((int) floor(($i + 1) * 7.5))->subDay()->endOfDay();
                if ($to->gt($now)) {
                    $to = $now->copy()->endOfDay();
                }
                $out[] = [
                    'from' => $from,
                    'to' => $to,
                    'label' => $from->format('j M'),
                ];
            }

            return $out;
        }

        if ($period === '6m') {
            for ($i = 5; $i >= 0; $i--) {
                $m = $now->copy()->subMonths($i);
                $from = $m->copy()->startOfMonth();
                $to = $m->copy()->endOfMonth();
                if ($i === 0 && $to->gt($now)) {
                    $to = $now->copy()->endOfDay();
                }
                $out[] = [
                    'from' => $from,
                    'to' => $to,
                    'label' => $from->format('M Y'),
                ];
            }

            return $out;
        }

        for ($i = 11; $i >= 0; $i--) {
            $m = $now->copy()->subMonths($i);
            $from = $m->copy()->startOfMonth();
            $to = $m->copy()->endOfMonth();
            if ($i === 0 && $to->gt($now)) {
                $to = $now->copy()->endOfDay();
            }
            $out[] = [
                'from' => $from,
                'to' => $to,
                'label' => $from->format('M Y'),
            ];
        }

        return $out;
    }

    /**
     * Recent activity for the admin dashboard widget: POS sales, purchases, expenses, invoices.
     * Quotations are empty until a quotations module exists in the schema.
     */
    public function dashboardRecentTransactions(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $limit = min(50, max(1, (int) $request->query('limit', 10)));

        $dr = $this->parseDashboardWidgetDateRange($request);
        $from = $dr['from'];
        $to = $dr['to'];
        $applyDate = $from !== null && $to !== null;
        $fromStr = $applyDate ? $from->toDateString() : null;
        $toStr = $applyDate ? $to->toDateString() : null;

        $posOrders = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereNotNull('completed_at')
            ->when($applyDate, function ($q) use ($from, $to): void {
                $q->whereBetween('completed_at', [$from, $to]);
            })
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->with(['customer:id,name,avatar_url'])
            ->get([
                'id',
                'order_no',
                'status',
                'total_amount',
                'currency',
                'completed_at',
                'customer_id',
                'customer_name',
            ]);

        $sales = $posOrders->map(function (PosOrder $o) {
            $c = $o->customer;
            $name = $c?->name ?? (trim((string) $o->customer_name) !== '' ? (string) $o->customer_name : 'Walk-in');

            return [
                'id' => (int) $o->id,
                'date' => $o->completed_at?->format('j M Y') ?? '',
                'customer_name' => $name,
                'avatar_url' => $c?->avatar_url,
                'reference' => (string) $o->order_no,
                'status_label' => (string) $o->status,
                'badge_variant' => strcasecmp((string) $o->status, PosOrder::STATUS_COMPLETED) === 0 ? 'success' : 'danger',
                'total' => (string) round((float) $o->total_amount, 2),
                'currency' => (string) ($o->currency ?: 'KES'),
            ];
        })->values()->all();

        $purchases = Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->when($applyDate, function ($q) use ($fromStr, $toStr): void {
                $q->whereBetween('purchase_date', [$fromStr, $toStr]);
            })
            ->orderByDesc('purchase_date')
            ->orderByDesc('id')
            ->limit($limit)
            ->with(['supplier:id,name'])
            ->get();

        $purchaseRows = $purchases->map(function (Purchase $p) {
            $st = trim((string) $p->status);
            $badge = match (strtolower($st)) {
                'pending', 'ordered' => 'cyan',
                'cancelled', 'void' => 'danger',
                default => 'success',
            };

            return [
                'id' => (int) $p->id,
                'date' => $p->purchase_date?->format('j M Y') ?? '',
                'supplier_name' => $p->supplier?->name ?? '—',
                'status_label' => $st !== '' ? $st : (string) ($p->payment_status ?? '—'),
                'badge_variant' => $badge,
                'total' => (string) round((float) $p->grand_total, 2),
                'currency' => 'KES',
            ];
        })->values()->all();

        $expenses = Expense::query()
            ->where('tenant_id', $tenant->id)
            ->when($applyDate, function ($q) use ($fromStr, $toStr): void {
                $q->whereRaw('COALESCE(expense_date, DATE(created_at)) BETWEEN ? AND ?', [$fromStr, $toStr]);
            })
            ->orderByRaw('COALESCE(`expense_date`, DATE(`created_at`)) DESC')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $expenseRows = $expenses->map(function (Expense $e) {
            $ps = strtolower((string) $e->payment_status);
            [$label, $variant] = match ($ps) {
                'paid' => ['Paid', 'success'],
                'unpaid' => ['Unpaid', 'warning'],
                'partial' => ['Partial', 'cyan'],
                default => [trim((string) $e->payment_status) ?: '—', 'secondary'],
            };
            $displayDate = $e->expense_date ?? $e->created_at;

            return [
                'id' => (int) $e->id,
                'date' => $displayDate?->format('j M Y') ?? '',
                'title' => trim((string) $e->title) !== '' ? (string) $e->title : 'Expense',
                'reference' => '#EXP-'.(int) $e->id,
                'status_label' => $label,
                'badge_variant' => $variant,
                'total' => (string) round((float) $e->amount, 2),
                'currency' => 'KES',
            ];
        })->values()->all();

        $invoices = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED])
            ->when($applyDate, function ($q) use ($fromStr, $toStr): void {
                $q->whereRaw('COALESCE(issued_at, DATE(created_at)) BETWEEN ? AND ?', [$fromStr, $toStr]);
            })
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->with(['customer:id,name,avatar_url'])
            ->get();

        $invoiceRows = $invoices->map(function (Invoice $inv) {
            $c = $inv->customer;
            $name = $c?->name ?? (trim((string) $inv->customer_name) !== '' ? (string) $inv->customer_name : '—');
            $st = (string) $inv->status;
            [$variant, $label] = match (true) {
                strcasecmp($st, Invoice::STATUS_PAID) === 0 => ['success', 'Paid'],
                strcasecmp($st, Invoice::STATUS_UNPAID) === 0 => ['danger', 'Unpaid'],
                strcasecmp($st, Invoice::STATUS_PARTIALLY_PAID) === 0 => ['warning', 'Partially paid'],
                strcasecmp($st, Invoice::STATUS_OVERDUE) === 0 => ['warning', 'Overdue'],
                strcasecmp($st, Invoice::STATUS_DRAFT) === 0 => ['pink', 'Draft'],
                strcasecmp($st, Invoice::STATUS_CANCELLED) === 0 => ['secondary', 'Cancelled'],
                default => ['secondary', $st !== '' ? $st : '—'],
            };

            return [
                'id' => (int) $inv->id,
                'customer_name' => $name,
                'avatar_url' => $c?->avatar_url ?? $inv->customer_image_url,
                'invoice_ref' => (string) ($inv->invoice_ref ?? ''),
                'due_date' => $inv->due_at?->format('j M Y') ?? '',
                'status_label' => $label,
                'badge_variant' => $variant,
                'total' => (string) round((float) $inv->total_amount, 2),
                'currency' => 'KES',
            ];
        })->values()->all();

        return response()->json([
            'message' => 'Recent dashboard transactions',
            'period' => $dr['period'],
            'range' => $applyDate
                ? ['from' => $fromStr, 'to' => $toStr]
                : ['all' => true, 'from' => null, 'to' => null],
            'sales' => $sales,
            'purchases' => $purchaseRows,
            'quotations' => [],
            'expenses' => $expenseRows,
            'invoices' => $invoiceRows,
        ]);
    }
}
