<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnLine;
use App\Models\Tenant;
use App\Services\Inventory\ProductStoreStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SalesReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $query = SalesReturn::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'customer:id,name',
                'invoice:id,invoice_ref',
                'posOrder:id,order_no,customer_name',
                'product:id,name,sku',
                'store:id,store_name',
                'lines.product:id,name,sku',
                'lines.store:id,store_name',
            ]);

        if ($request->filled('q')) {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $query->where(function ($sub) use ($needle): void {
                $sub->where('sales_return_no', 'like', $needle)
                    ->orWhere('product_name', 'like', $needle)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $needle))
                    ->orWhereHas('product', function ($p) use ($needle): void {
                        $p->where('name', 'like', $needle)->orWhere('sku', 'like', $needle);
                    })
                    ->orWhereHas('lines.product', function ($p) use ($needle): void {
                        $p->where('name', 'like', $needle)->orWhere('sku', 'like', $needle);
                    })
                    ->orWhereHas('posOrder', function ($po) use ($needle): void {
                        $po->where('order_no', 'like', $needle);
                    })
                    ->orWhereHas('invoice', function ($inv) use ($needle): void {
                        $inv->where('invoice_ref', 'like', $needle);
                    });
            });
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->query('customer_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->query('payment_status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('returned_at', '>=', (string) $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('returned_at', '<=', (string) $request->query('to'));
        }

        $sort = (string) $request->query('sort', 'recent');
        if ($sort === '') {
            $sort = 'recent';
        }

        match ($sort) {
            'refAsc' => $query->orderBy('sales_return_no'),
            'refDesc' => $query->orderByDesc('sales_return_no'),
            'lastMonth' => $query
                ->whereDate('returned_at', '>=', now()->startOfMonth())
                ->orderByDesc('returned_at')
                ->orderByDesc('id'),
            'last7' => $query
                ->whereDate('returned_at', '>=', now()->subDays(7))
                ->orderByDesc('returned_at')
                ->orderByDesc('id'),
            default => $query->orderByDesc('returned_at')->orderByDesc('id'),
        };

        $rows = $query->get();

        return response()->json([
            'message' => 'Sales returns retrieved.',
            'sales_returns' => $rows->map(fn (SalesReturn $r) => $this->serialize($r))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'invoice_id' => [
                'nullable',
                'integer',
                Rule::exists('invoices', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'pos_order_id' => [
                'nullable',
                'integer',
                Rule::exists('pos_orders', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)
                ),
            ],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'lines.*.store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'returned_at' => ['nullable', 'date'],
            'status' => ['required', Rule::in(['Received', 'Pending'])],
            'amount_paid' => ['required', 'numeric', 'min:0'],
            'payment_status' => ['required', Rule::in(['Paid', 'Unpaid', 'Overdue'])],
            'notes' => ['nullable', 'string', 'max:20000'],
        ]);

        $customerId = isset($validated['customer_id']) ? (int) $validated['customer_id'] : null;
        if ($customerId !== null && $customerId <= 0) {
            $customerId = null;
        }

        $invoice = null;
        if (! empty($validated['invoice_id'])) {
            $invoice = Invoice::query()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->find((int) $validated['invoice_id']);
        }

        $posOrder = null;
        if (! empty($validated['pos_order_id'])) {
            $posOrder = PosOrder::query()
                ->where('tenant_id', $tenant->id)
                ->find((int) $validated['pos_order_id']);
        }

        if ($customerId === null) {
            if ($invoice !== null) {
                $customerId = $invoice->customer_id !== null ? (int) $invoice->customer_id : null;
            } elseif ($posOrder !== null && $posOrder->customer_id !== null) {
                $customerId = (int) $posOrder->customer_id;
            }
        } else {
            if ($invoice !== null && $invoice->customer_id !== null
                && (int) $invoice->customer_id !== $customerId) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['The selected invoice does not belong to this customer.'],
                ]);
            }
            if ($posOrder !== null && $posOrder->customer_id !== null
                && (int) $posOrder->customer_id !== $customerId) {
                throw ValidationException::withMessages([
                    'pos_order_id' => ['The selected receipt does not match this customer.'],
                ]);
            }
        }

        if ($invoice !== null && $posOrder !== null) {
            $ic = $invoice->customer_id;
            $pc = $posOrder->customer_id;
            if ($ic !== null && $pc !== null && (int) $ic !== (int) $pc) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['Invoice and receipt must belong to the same customer when both are set.'],
                ]);
            }
        }

        $lineRows = [];
        foreach ($validated['lines'] as $lineInput) {
            $product = Product::query()
                ->where('tenant_id', $tenant->id)
                ->findOrFail((int) $lineInput['product_id']);
            $qty = (int) $lineInput['quantity'];
            $storeId = (int) $lineInput['store_id'];
            $unitPrice = round((float) ($product->selling_price ?? 0), 2);
            $lineTotal = round($unitPrice * $qty, 2);
            $lineRows[] = [
                'product' => $product,
                'qty' => $qty,
                'store_id' => $storeId,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
                'product_name' => (string) $product->name,
            ];
        }

        $totalAmount = round(array_sum(array_column($lineRows, 'line_total')), 2);
        $paid = min(round((float) $validated['amount_paid'], 2), $totalAmount);
        $due = max(0, round($totalAmount - $paid, 2));

        $names = array_map(fn (array $r) => $r['product_name'], $lineRows);
        $productNameSummary = count($names) === 1
            ? $names[0]
            : ($names[0].' (+'.(count($names) - 1).' more)');
        $storeIds = array_values(array_unique(array_map(fn (array $r) => $r['store_id'], $lineRows)));
        $headerStoreId = count($storeIds) === 1 ? $storeIds[0] : null;
        $headerProductId = $lineRows[0]['product']->id;
        $headerQty = (int) array_sum(array_map(fn (array $r) => $r['qty'], $lineRows));

        $ref = $this->nextSalesReturnNo($tenant->id);

        $sr = DB::transaction(function () use (
            $request,
            $tenant,
            $ref,
            $validated,
            $lineRows,
            $totalAmount,
            $paid,
            $due,
            $productNameSummary,
            $headerProductId,
            $headerStoreId,
            $headerQty,
            $customerId
        ): SalesReturn {
            $sr = SalesReturn::query()->create([
                'tenant_id' => $tenant->id,
                'sales_return_no' => $ref,
                'invoice_id' => $validated['invoice_id'] ?? null,
                'pos_order_id' => $validated['pos_order_id'] ?? null,
                'product_id' => $headerProductId,
                'store_id' => $headerStoreId,
                'customer_id' => $customerId,
                'product_name' => $productNameSummary,
                'quantity' => $headerQty,
                'returned_at' => isset($validated['returned_at'])
                    ? $validated['returned_at']
                    : now()->toDateTimeString(),
                'status' => $validated['status'],
                'total_amount' => $totalAmount,
                'amount_paid' => $paid,
                'amount_due' => $due,
                'payment_status' => $validated['payment_status'],
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            foreach ($lineRows as $row) {
                SalesReturnLine::query()->create([
                    'tenant_id' => $tenant->id,
                    'sales_return_id' => $sr->id,
                    'product_id' => $row['product']->id,
                    'store_id' => $row['store_id'],
                    'quantity' => $row['qty'],
                    'unit_price' => $row['unit_price'],
                    'line_total' => $row['line_total'],
                    'product_name' => $row['product_name'],
                ]);
            }

            if ($validated['status'] === 'Received') {
                $stock = app(ProductStoreStockService::class);
                foreach ($lineRows as $row) {
                    $stock->adjustBucket($row['product'], $row['store_id'], $row['qty']);
                    $stock->syncProductTotalFromBuckets($row['product']->fresh());
                }
            }

            return $sr;
        });

        $sr->load([
            'customer:id,name',
            'invoice:id,invoice_ref',
            'posOrder:id,order_no,customer_name',
            'product:id,name,sku',
            'store:id,store_name',
            'lines.product:id,name,sku',
            'lines.store:id,store_name',
        ]);

        return response()->json([
            'message' => 'Sales return created.',
            'sales_return' => $this->serialize($sr),
        ], 201);
    }

    public function update(Request $request, SalesReturn $salesReturn): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        if ((int) $salesReturn->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'invoice_id' => [
                'nullable',
                'integer',
                Rule::exists('invoices', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'pos_order_id' => [
                'nullable',
                'integer',
                Rule::exists('pos_orders', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)
                ),
            ],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'lines.*.store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'returned_at' => ['nullable', 'date'],
            'status' => ['required', Rule::in(['Received', 'Pending'])],
            'amount_paid' => ['required', 'numeric', 'min:0'],
            'payment_status' => ['required', Rule::in(['Paid', 'Unpaid', 'Overdue'])],
            'notes' => ['nullable', 'string', 'max:20000'],
        ]);

        $customerId = isset($validated['customer_id']) ? (int) $validated['customer_id'] : null;
        if ($customerId !== null && $customerId <= 0) {
            $customerId = null;
        }

        $invoice = null;
        if (! empty($validated['invoice_id'])) {
            $invoice = Invoice::query()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->find((int) $validated['invoice_id']);
        }

        $posOrder = null;
        if (! empty($validated['pos_order_id'])) {
            $posOrder = PosOrder::query()
                ->where('tenant_id', $tenant->id)
                ->find((int) $validated['pos_order_id']);
        }

        if ($customerId === null) {
            if ($invoice !== null) {
                $customerId = $invoice->customer_id !== null ? (int) $invoice->customer_id : null;
            } elseif ($posOrder !== null && $posOrder->customer_id !== null) {
                $customerId = (int) $posOrder->customer_id;
            }
        } else {
            if ($invoice !== null && $invoice->customer_id !== null
                && (int) $invoice->customer_id !== $customerId) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['The selected invoice does not belong to this customer.'],
                ]);
            }
            if ($posOrder !== null && $posOrder->customer_id !== null
                && (int) $posOrder->customer_id !== $customerId) {
                throw ValidationException::withMessages([
                    'pos_order_id' => ['The selected receipt does not match this customer.'],
                ]);
            }
        }

        if ($invoice !== null && $posOrder !== null) {
            $ic = $invoice->customer_id;
            $pc = $posOrder->customer_id;
            if ($ic !== null && $pc !== null && (int) $ic !== (int) $pc) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['Invoice and receipt must belong to the same customer when both are set.'],
                ]);
            }
        }

        $lineRows = [];
        foreach ($validated['lines'] as $lineInput) {
            $product = Product::query()
                ->where('tenant_id', $tenant->id)
                ->findOrFail((int) $lineInput['product_id']);
            $qty = (int) $lineInput['quantity'];
            $storeId = (int) $lineInput['store_id'];
            $unitPrice = round((float) ($product->selling_price ?? 0), 2);
            $lineTotal = round($unitPrice * $qty, 2);
            $lineRows[] = [
                'product' => $product,
                'qty' => $qty,
                'store_id' => $storeId,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
                'product_name' => (string) $product->name,
            ];
        }

        $totalAmount = round(array_sum(array_column($lineRows, 'line_total')), 2);
        $paid = min(round((float) $validated['amount_paid'], 2), $totalAmount);
        $due = max(0, round($totalAmount - $paid, 2));

        $names = array_map(fn (array $r) => $r['product_name'], $lineRows);
        $productNameSummary = count($names) === 1
            ? $names[0]
            : ($names[0].' (+'.(count($names) - 1).' more)');
        $storeIds = array_values(array_unique(array_map(fn (array $r) => $r['store_id'], $lineRows)));
        $headerStoreId = count($storeIds) === 1 ? $storeIds[0] : null;
        $headerProductId = $lineRows[0]['product']->id;
        $headerQty = (int) array_sum(array_map(fn (array $r) => $r['qty'], $lineRows));

        $updated = DB::transaction(function () use (
            $tenant,
            $salesReturn,
            $validated,
            $lineRows,
            $totalAmount,
            $paid,
            $due,
            $productNameSummary,
            $headerProductId,
            $headerStoreId,
            $headerQty,
            $customerId
        ): SalesReturn {
            $model = SalesReturn::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($salesReturn->id);

            $model->load(['lines.product']);
            $this->reverseReceivedStock($model);

            $model->lines()->delete();

            $model->update([
                'invoice_id' => $validated['invoice_id'] ?? null,
                'pos_order_id' => $validated['pos_order_id'] ?? null,
                'product_id' => $headerProductId,
                'store_id' => $headerStoreId,
                'customer_id' => $customerId,
                'product_name' => $productNameSummary,
                'quantity' => $headerQty,
                'returned_at' => isset($validated['returned_at'])
                    ? $validated['returned_at']
                    : now()->toDateTimeString(),
                'status' => $validated['status'],
                'total_amount' => $totalAmount,
                'amount_paid' => $paid,
                'amount_due' => $due,
                'payment_status' => $validated['payment_status'],
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($lineRows as $row) {
                SalesReturnLine::query()->create([
                    'tenant_id' => $tenant->id,
                    'sales_return_id' => $model->id,
                    'product_id' => $row['product']->id,
                    'store_id' => $row['store_id'],
                    'quantity' => $row['qty'],
                    'unit_price' => $row['unit_price'],
                    'line_total' => $row['line_total'],
                    'product_name' => $row['product_name'],
                ]);
            }

            if ($validated['status'] === 'Received') {
                $stock = app(ProductStoreStockService::class);
                foreach ($lineRows as $row) {
                    $stock->adjustBucket($row['product'], $row['store_id'], $row['qty']);
                    $stock->syncProductTotalFromBuckets($row['product']->fresh());
                }
            }

            return $model->fresh([
                'customer:id,name',
                'invoice:id,invoice_ref',
                'posOrder:id,order_no,customer_name',
                'product:id,name,sku',
                'store:id,store_name',
                'lines.product:id,name,sku',
                'lines.store:id,store_name',
            ]);
        });

        return response()->json([
            'message' => 'Sales return updated.',
            'sales_return' => $this->serialize($updated),
        ]);
    }

    public function destroy(Request $request, SalesReturn $salesReturn): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        if ((int) $salesReturn->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        DB::transaction(function () use ($tenant, $salesReturn): void {
            $model = SalesReturn::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($salesReturn->id);
            $model->load(['lines.product']);
            $this->reverseReceivedStock($model);
            $model->delete();
        });

        return response()->json([
            'message' => 'Sales return deleted.',
        ]);
    }

    /**
     * Remove stock added when a return was marked Received (before update/delete).
     */
    private function reverseReceivedStock(SalesReturn $model): void
    {
        if ($model->status !== 'Received') {
            return;
        }

        $model->loadMissing(['lines.product']);
        $stock = app(ProductStoreStockService::class);

        if ($model->lines->isNotEmpty()) {
            foreach ($model->lines as $line) {
                $product = $line->product;
                if ($product === null) {
                    $product = Product::query()->find($line->product_id);
                }
                if ($product === null) {
                    continue;
                }
                $stock->adjustBucket($product, (int) $line->store_id, -(int) $line->quantity);
                $stock->syncProductTotalFromBuckets($product->fresh());
            }

            return;
        }

        if ($model->product_id && $model->store_id && $model->quantity) {
            $product = Product::query()->find($model->product_id);
            if ($product !== null) {
                $stock->adjustBucket($product, (int) $model->store_id, -(int) $model->quantity);
                $stock->syncProductTotalFromBuckets($product->fresh());
            }
        }
    }

    private function nextSalesReturnNo(int $tenantId): string
    {
        $last = SalesReturn::query()
            ->where('tenant_id', $tenantId)
            ->where('sales_return_no', 'like', 'SR-%')
            ->orderByDesc('id')
            ->value('sales_return_no');

        $n = 0;
        if (is_string($last) && preg_match('/^SR-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'SR-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(SalesReturn $r): array
    {
        $r->loadMissing([
            'customer:id,name',
            'invoice:id,invoice_ref',
            'posOrder:id,order_no,customer_name',
            'product:id,name,sku',
            'store:id,store_name',
            'lines.product:id,name,sku',
            'lines.store:id,store_name',
        ]);

        $linesPayload = $this->serializeLinesPayload($r);
        $summary = $this->summaryForList($r, $linesPayload);

        return [
            'id' => $r->id,
            'return_ref' => $r->sales_return_no,
            'sales_return_no' => $r->sales_return_no,
            'product_id' => $r->product_id,
            'store_id' => $r->store_id,
            'quantity' => $summary['quantity'],
            'product_name' => $summary['product_name'],
            'product_sku' => $summary['product_sku'],
            'store_name' => $summary['store_name'],
            'lines' => $linesPayload,
            'returned_at' => $r->returned_at?->toIso8601String(),
            'date_display' => $r->returned_at?->format('d M Y'),
            'customer_id' => $r->customer_id,
            'customer_name' => $r->customer?->name ?? '',
            'invoice_id' => $r->invoice_id,
            'invoice_ref' => $r->invoice?->invoice_ref ?? '',
            'pos_order_id' => $r->pos_order_id,
            'receipt_no' => $r->posOrder?->order_no ?? '',
            'status' => $r->status,
            'total_amount' => (string) $r->total_amount,
            'amount_paid' => (string) $r->amount_paid,
            'amount_due' => (string) $r->amount_due,
            'total_display' => $this->formatKes($r->total_amount),
            'paid_display' => $this->formatKes($r->amount_paid),
            'due_display' => $this->formatKes($r->amount_due),
            'payment_status' => $r->payment_status,
            'notes' => $r->notes,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function serializeLinesPayload(SalesReturn $r): array
    {
        if ($r->relationLoaded('lines') && $r->lines->isNotEmpty()) {
            return $r->lines->map(function (SalesReturnLine $line) {
                return [
                    'id' => $line->id,
                    'product_id' => $line->product_id,
                    'product_name' => $line->product_name ?? $line->product?->name ?? '',
                    'product_sku' => $line->product?->sku ?? '',
                    'store_id' => $line->store_id,
                    'store_name' => $line->store?->store_name ?? '',
                    'quantity' => $line->quantity,
                    'unit_price' => (string) $line->unit_price,
                    'line_total' => (string) $line->line_total,
                ];
            })->values()->all();
        }

        if ($r->product_id) {
            return [[
                'id' => null,
                'product_id' => $r->product_id,
                'product_name' => $r->product_name,
                'product_sku' => $r->product?->sku ?? '',
                'store_id' => $r->store_id,
                'store_name' => $r->store?->store_name ?? '',
                'quantity' => $r->quantity,
                'unit_price' => null,
                'line_total' => null,
            ]];
        }

        return [];
    }

    /**
     * @param  array<int, array<string, mixed>>  $linesPayload
     * @return array{product_name: string, product_sku: string, quantity: int|null, store_name: string}
     */
    private function summaryForList(SalesReturn $r, array $linesPayload): array
    {
        if (count($linesPayload) > 0) {
            $qty = 0;
            foreach ($linesPayload as $line) {
                $qty += (int) ($line['quantity'] ?? 0);
            }
            $names = array_values(array_filter(array_column($linesPayload, 'product_name')));
            $productName = count($names) === 1
                ? (string) $names[0]
                : (($names[0] ?? 'Products').' (+'.(max(0, count($names) - 1)).' more)');
            $skus = array_values(array_filter(array_column($linesPayload, 'product_sku')));
            $stores = array_unique(array_values(array_filter(array_column($linesPayload, 'store_name'))));
            $storeName = count($stores) <= 1 ? ($stores[0] ?? '') : 'Multiple stores';

            return [
                'product_name' => $productName,
                'product_sku' => (string) ($skus[0] ?? ''),
                'quantity' => $qty,
                'store_name' => $storeName,
            ];
        }

        return [
            'product_name' => (string) ($r->product_name ?? ''),
            'product_sku' => (string) ($r->product?->sku ?? ''),
            'quantity' => $r->quantity,
            'store_name' => (string) ($r->store?->store_name ?? ''),
        ];
    }

    private function formatKes(mixed $n): string
    {
        $x = (float) $n;
        $num = number_format($x, 2, '.', ',');

        return 'Ksh'.$num;
    }
}
