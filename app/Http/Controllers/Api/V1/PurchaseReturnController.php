<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseLine;
use App\Models\PurchasePayment;
use App\Models\PurchaseReturn;
use App\Models\StockAdjustment;
use App\Models\Supplier;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! Schema::hasTable('purchase_returns')) {
            return response()->json([
                'message' => 'Purchase returns table is not migrated yet.',
                'purchase_returns' => [],
            ]);
        }

        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = PurchaseReturn::query()
            ->where('tenant_id', $tenant->id)
            ->with(['supplier:id,name,email'])
            ->orderByDesc('return_date')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json([
            'message' => 'Purchase returns retrieved.',
            'purchase_returns' => $rows->map(fn (PurchaseReturn $row) => $this->toPayload($row)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertTableExists();

        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant->id);
        $user = $request->user();

        $row = DB::transaction(function () use ($tenant, $validated, $user): PurchaseReturn {
            $sourcePurchase = null;
            $lineRefundTotal = 0.0;
            if (! empty($validated['purchase_id'])) {
                $sourcePurchase = Purchase::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereKey((int) $validated['purchase_id'])
                    ->lockForUpdate()
                    ->firstOrFail();
                $sourcePurchase->load('lines');
                $sourcePaid = round((float) $sourcePurchase->paid_amount, 2);
                $inputRefund = round((float) ($validated['refund_amount'] ?? $validated['paid_amount'] ?? 0), 2);
                if (abs($inputRefund - $sourcePaid) > 0.0001) {
                    throw ValidationException::withMessages([
                        'refund_amount' => 'Money refunded must be exactly equal to the paid amount.',
                    ]);
                }
            }

            $row = PurchaseReturn::query()->create([
                'tenant_id' => $tenant->id,
                'supplier_id' => (int) $validated['supplier_id'],
                'purchase_id' => ! empty($validated['purchase_id']) ? (int) $validated['purchase_id'] : null,
                'reference' => trim((string) $validated['reference']),
                'return_date' => $validated['return_date'],
                'status' => $validated['status'],
                'grand_total' => round((float) ($validated['grand_total'] ?? 0), 2),
                'paid_amount' => round((float) ($validated['paid_amount'] ?? 0), 2),
                'due_amount' => round((float) ($validated['due_amount'] ?? 0), 2),
                'refund_amount' => 0,
                'payment_status' => $validated['payment_status'],
                'description' => $validated['description'] ?? null,
            ]);

            if ($sourcePurchase && ! empty($validated['lines'])) {
                $sourceLines = $sourcePurchase->lines->keyBy('id');
                foreach ($validated['lines'] as $entry) {
                    /** @var PurchaseLine|null $sourceLine */
                    $sourceLine = $sourceLines->get((int) $entry['line_id']);
                    if (! $sourceLine) {
                        throw ValidationException::withMessages([
                            'lines' => 'One or more purchase lines are invalid for this purchase.',
                        ]);
                    }
                    $qtyReturned = round((float) $entry['qty_returned'], 3);
                    if ($qtyReturned <= 0.0001) {
                        continue;
                    }
                    $receivedQty = (float) $sourceLine->received_qty;
                    if ($qtyReturned > $receivedQty + 0.0001) {
                        throw ValidationException::withMessages([
                            'lines' => "Cannot return more than received quantity for line {$sourceLine->id}.",
                        ]);
                    }

                    if ($sourcePurchase->purchase_type === 'stock' && $sourceLine->product_id) {
                        $product = Product::query()
                            ->where('tenant_id', $tenant->id)
                            ->whereNull('deleted_at')
                            ->whereKey($sourceLine->product_id)
                            ->lockForUpdate()
                            ->first();
                        if ($product) {
                            $before = (float) $product->qty;
                            if ($qtyReturned > $before + 0.0001) {
                                throw ValidationException::withMessages([
                                    'lines' => "Insufficient stock to return for product {$product->name}.",
                                ]);
                            }
                            $after = round($before - $qtyReturned, 3);
                            $product->qty = $after;
                            $product->save();

                            StockAdjustment::query()->create([
                                'tenant_id' => $tenant->id,
                                'product_id' => $product->id,
                                'type' => 'sub',
                                'quantity' => $qtyReturned,
                                'qty_before' => $before,
                                'qty_after' => $after,
                                'reference' => (string) ($validated['reference'] ?? $sourcePurchase->reference),
                                'notes' => trim((string) ("Purchase return #{$row->id}")) ?: null,
                                'created_by_user_id' => $user?->id,
                            ]);
                        }
                    }

                    $sourceLine->received_qty = round(max(0, $receivedQty - $qtyReturned), 3);
                    $sourceLine->save();

                    $lineQty = max(0.0001, (float) $sourceLine->qty);
                    $unitRefund = round((float) $sourceLine->line_total / $lineQty, 2);
                    $lineRefund = round($unitRefund * $qtyReturned, 2);
                    $lineRefundTotal = round($lineRefundTotal + $lineRefund, 2);

                    $row->lines()->create([
                        'purchase_line_id' => $sourceLine->id,
                        'product_id' => $sourceLine->product_id,
                        'qty_returned' => $qtyReturned,
                        'line_refund_amount' => $lineRefund,
                    ]);
                }

                $row->grand_total = $lineRefundTotal;
                $row->due_amount = max(0, round($lineRefundTotal - (float) $row->paid_amount, 2));

                $refundAmount = min((float) $sourcePurchase->paid_amount, $lineRefundTotal);
                if ($refundAmount > 0.0001) {
                    PurchasePayment::query()->create([
                        'tenant_id' => $tenant->id,
                        'purchase_id' => $sourcePurchase->id,
                        'paid_at' => $validated['return_date'],
                        'amount' => -1 * round($refundAmount, 2),
                        'method' => 'Refund',
                        'reference' => trim((string) ($validated['reference'] ?? '')),
                        'note' => 'Auto refund from purchase return '.$row->reference,
                        'created_by_user_id' => $user?->id,
                    ]);
                    $sourcePurchase->paid_amount = round(max(0, (float) $sourcePurchase->paid_amount - $refundAmount), 2);
                    $sourcePurchase->due_amount = round(max(0, (float) $sourcePurchase->grand_total - (float) $sourcePurchase->paid_amount), 2);
                    $sourcePurchase->payment_status = 'Refunded';
                }
                $sourcePurchase->status = 'Return';
                $sourcePurchase->save();
                $row->refund_amount = round($refundAmount ?? 0, 2);
                $row->paid_amount = round($row->refund_amount, 2);
                $row->payment_status = $row->due_amount <= 0.0001 ? 'Paid' : 'Unpaid';
                $row->save();
            }

            return $row->fresh(['supplier:id,name,email', 'lines']);
        });

        return response()->json([
            'message' => 'Purchase return created.',
            'purchase_return' => $this->toPayload($row),
        ], 201);
    }

    public function update(Request $request, string $purchaseReturn): JsonResponse
    {
        $this->assertTableExists();

        $row = $this->resolvePurchaseReturn($request, $purchaseReturn);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant->id, (int) $row->id);

        $row->fill([
            'supplier_id' => (int) $validated['supplier_id'],
            'purchase_id' => ! empty($validated['purchase_id']) ? (int) $validated['purchase_id'] : null,
            'reference' => trim((string) $validated['reference']),
            'return_date' => $validated['return_date'],
            'status' => $validated['status'],
            'grand_total' => $validated['grand_total'],
            'paid_amount' => $validated['paid_amount'],
            'due_amount' => $validated['due_amount'],
            'refund_amount' => round((float) ($validated['refund_amount'] ?? (float) $row->refund_amount), 2),
            'payment_status' => $validated['payment_status'],
            'description' => $validated['description'] ?? null,
        ]);
        $row->save();
        $row->load(['supplier:id,name,email']);

        return response()->json([
            'message' => 'Purchase return updated.',
            'purchase_return' => $this->toPayload($row),
        ]);
    }

    public function destroy(Request $request, string $purchaseReturn): JsonResponse
    {
        $this->assertTableExists();

        $row = $this->resolvePurchaseReturn($request, $purchaseReturn);
        $row->delete();

        return response()->json(['message' => 'Purchase return deleted.']);
    }

    private function resolvePurchaseReturn(Request $request, string $id): PurchaseReturn
    {
        $this->assertTableExists();

        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return PurchaseReturn::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, int $tenantId, ?int $exceptId = null): array
    {
        return $request->validate([
            'supplier_id' => [
                'required',
                'integer',
                Rule::exists('suppliers', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenantId)->whereNull('deleted_at')
                ),
            ],
            'purchase_id' => [
                'nullable',
                'integer',
                Rule::exists('purchases', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId)),
            ],
            'reference' => [
                'required',
                'string',
                'max:120',
                Rule::unique('purchase_returns', 'reference')
                    ->where(fn ($q) => $q->where('tenant_id', $tenantId))
                    ->ignore($exceptId),
            ],
            'return_date' => ['required', 'date'],
            'status' => ['required', 'string', Rule::in(['Pending', 'Received', 'Returned'])],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'due_amount' => ['nullable', 'numeric', 'min:0'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_status' => ['required', 'string', Rule::in(['Paid', 'Unpaid', 'Overdue', 'Refunded', 'Unrefunded'])],
            'description' => ['nullable', 'string', 'max:6000'],
            'lines' => ['nullable', 'array'],
            'lines.*.line_id' => ['required_with:lines', 'integer'],
            'lines.*.qty_returned' => ['required_with:lines', 'numeric', 'min:0.001'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toPayload(PurchaseReturn $row): array
    {
        $supplierName = $row->supplier instanceof Supplier ? (string) $row->supplier->name : '—';

        return [
            'id' => $row->id,
            'supplier_id' => $row->supplier_id,
            'supplier_name' => $supplierName,
            'purchase_id' => $row->purchase_id,
            'reference' => $row->reference,
            'return_date' => optional($row->return_date)->format('Y-m-d'),
            'status' => $row->status,
            'grand_total' => (string) $row->grand_total,
            'paid_amount' => (string) $row->paid_amount,
            'due_amount' => (string) $row->due_amount,
            'refund_amount' => (string) $row->refund_amount,
            'payment_status' => $row->payment_status,
            'description' => $row->description,
            'lines' => $row->relationLoaded('lines')
                ? $row->lines->map(fn ($line) => [
                    'id' => $line->id,
                    'purchase_line_id' => $line->purchase_line_id,
                    'product_id' => $line->product_id,
                    'qty_returned' => (string) $line->qty_returned,
                    'line_refund_amount' => (string) $line->line_refund_amount,
                ])->values()->all()
                : [],
        ];
    }

    private function assertTableExists(): void
    {
        if (! Schema::hasTable('purchase_returns')) {
            throw ValidationException::withMessages([
                'purchase_returns' => 'Purchase returns table is missing. Please run php artisan migrate.',
            ]);
        }
    }
}
