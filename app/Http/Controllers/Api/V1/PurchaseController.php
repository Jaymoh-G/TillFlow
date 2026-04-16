<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\PurchaseOrderAddedMail;
use App\Mail\PurchasePaymentUpdatedMail;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseLine;
use App\Models\PurchasePayment;
use App\Models\PurchaseReceipt;
use App\Models\StockAdjustment;
use App\Models\Supplier;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->with(['supplier:id,name,code,email'])
            ->orderByDesc('purchase_date')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json([
            'message' => 'Purchases retrieved.',
            'purchases' => $rows->map(fn (Purchase $p) => $this->toListPayload($p)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'supplier_id' => [
                'required',
                'integer',
                Rule::exists('suppliers', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'reference' => [
                'required',
                'string',
                'max:120',
                Rule::unique('purchases', 'reference')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'purchase_date' => ['required', 'date'],
            'status' => ['required', 'string', Rule::in(['Draft', 'Received', 'Pending', 'Ordered', 'Partial', 'Return'])],
            'purchase_type' => ['sometimes', 'string', Rule::in(['stock', 'expense'])],
            'order_tax' => ['nullable', 'numeric', 'min:0'],
            'order_discount' => ['nullable', 'numeric', 'min:0'],
            'shipping' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:6000'],
            'payment_status' => ['sometimes', 'string', Rule::in(['Paid', 'Unpaid', 'Overdue', 'Refunded'])],
            'paid_amount' => ['sometimes', 'numeric', 'min:0'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'lines.*.product_name' => ['nullable', 'string', 'max:255'],
            'lines.*.qty' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $orderTax = round((float) ($validated['order_tax'] ?? 0), 2);
        $orderDisc = round((float) ($validated['order_discount'] ?? 0), 2);
        $shipping = round((float) ($validated['shipping'] ?? 0), 2);
        $purchaseType = strtolower((string) ($validated['purchase_type'] ?? 'stock'));
        if (! in_array($purchaseType, ['stock', 'expense'], true)) {
            $purchaseType = 'stock';
        }

        $lineRows = [];
        $linesTotal = 0.0;
        foreach ($validated['lines'] as $i => $line) {
            $pid = $line['product_id'] ?? null;
            $hasProductId = $pid !== null && (int) $pid > 0;
            $qty = (float) $line['qty'];
            $disc = round((float) ($line['discount'] ?? 0), 2);
            $taxPct = (float) ($line['tax_percent'] ?? 0);

            if ($hasProductId) {
                $product = $this->resolveProduct($tenant->id, (int) $pid);
                $productName = (string) $product->name;
                $price = $this->resolveLineUnitPrice($line, $product);
            } else {
                $productName = trim((string) ($line['product_name'] ?? ''));
                if ($productName === '') {
                    throw ValidationException::withMessages([
                        'lines' => 'Each line must either use a catalog product or include a product name.',
                    ]);
                }
                $price = array_key_exists('unit_price', $line) && $line['unit_price'] !== null && $line['unit_price'] !== ''
                    ? (float) $line['unit_price']
                    : 0.0;
            }

            $sub = max(0, round($qty * $price - $disc, 2));
            $taxAmt = round($sub * ($taxPct / 100), 2);
            $lineTotal = round($sub + $taxAmt, 2);
            $linesTotal = round($linesTotal + $lineTotal, 2);

            $lineRows[] = [
                'sort_order' => $i,
                'product_id' => $hasProductId ? (int) $pid : null,
                'product_name' => $productName,
                'qty' => $qty,
                'unit_price' => $price,
                'discount_amount' => $disc,
                'tax_percent' => $taxPct,
                'line_total' => $lineTotal,
            ];
        }

        $grand = max(0, round($linesTotal + $orderTax + $shipping - $orderDisc, 2));
        $paidAmount = round((float) ($validated['paid_amount'] ?? 0), 2);
        $paymentStatus = $validated['payment_status'] ?? 'Unpaid';
        if (! in_array($paymentStatus, ['Paid', 'Unpaid', 'Overdue', 'Refunded'], true)) {
            $paymentStatus = 'Unpaid';
        }
        if ($paidAmount < 0) {
            $paidAmount = 0;
        }
        if ($paidAmount > $grand) {
            $paidAmount = $grand;
        }
        $due = round(max(0, $grand - $paidAmount), 2);

        /** @var Purchase $purchase */
        $purchase = DB::transaction(function () use (
            $tenant,
            $validated,
            $orderTax,
            $orderDisc,
            $shipping,
            $purchaseType,
            $grand,
            $paidAmount,
            $due,
            $paymentStatus,
            $lineRows
        ): Purchase {
            $purchase = Purchase::query()->create([
                'tenant_id' => $tenant->id,
                'supplier_id' => (int) $validated['supplier_id'],
                'reference' => trim($validated['reference']),
                'purchase_date' => $validated['purchase_date'],
                'status' => $validated['status'],
                'purchase_type' => $purchaseType,
                'order_tax' => $orderTax,
                'order_discount' => $orderDisc,
                'shipping' => $shipping,
                'description' => $this->normalizeDescription($validated['description'] ?? null),
                'grand_total' => $grand,
                'paid_amount' => $paidAmount,
                'due_amount' => $due,
                'payment_status' => $paymentStatus,
            ]);

            foreach ($lineRows as $row) {
                $purchase->lines()->create($row);
            }

            return tap($purchase, fn (Purchase $p) => $p->load(['supplier:id,name,code,email', 'lines']));
        });

        return response()->json([
            'message' => 'Purchase created.',
            'purchase' => $this->toDetailPayload($purchase),
        ], 201);
    }

    public function show(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        $model->load(['supplier:id,name,code,email', 'lines']);

        return response()->json([
            'message' => 'Purchase retrieved.',
            'purchase' => $this->toDetailPayload($model),
        ]);
    }

    public function update(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'supplier_id' => [
                'required',
                'integer',
                Rule::exists('suppliers', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'reference' => [
                'required',
                'string',
                'max:120',
                Rule::unique('purchases', 'reference')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'purchase_date' => ['required', 'date'],
            'status' => ['required', 'string', Rule::in(['Draft', 'Received', 'Pending', 'Ordered', 'Partial', 'Return'])],
            'purchase_type' => ['sometimes', 'string', Rule::in(['stock', 'expense'])],
            'order_tax' => ['nullable', 'numeric', 'min:0'],
            'order_discount' => ['nullable', 'numeric', 'min:0'],
            'shipping' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:6000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')
                ),
            ],
            'lines.*.product_name' => ['nullable', 'string', 'max:255'],
            'lines.*.qty' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $orderTax = round((float) ($validated['order_tax'] ?? 0), 2);
        $orderDisc = round((float) ($validated['order_discount'] ?? 0), 2);
        $shipping = round((float) ($validated['shipping'] ?? 0), 2);
        $purchaseType = strtolower((string) ($validated['purchase_type'] ?? $model->purchase_type ?? 'stock'));
        if (! in_array($purchaseType, ['stock', 'expense'], true)) {
            $purchaseType = 'stock';
        }

        $lineRows = [];
        $linesTotal = 0.0;
        foreach ($validated['lines'] as $i => $line) {
            $pid = $line['product_id'] ?? null;
            $hasProductId = $pid !== null && (int) $pid > 0;
            $qty = (float) $line['qty'];
            $disc = round((float) ($line['discount'] ?? 0), 2);
            $taxPct = (float) ($line['tax_percent'] ?? 0);

            if ($hasProductId) {
                $product = $this->resolveProduct($tenant->id, (int) $pid);
                $productName = (string) $product->name;
                $price = $this->resolveLineUnitPrice($line, $product);
            } else {
                $productName = trim((string) ($line['product_name'] ?? ''));
                if ($productName === '') {
                    throw ValidationException::withMessages([
                        'lines' => 'Each line must either use a catalog product or include a product name.',
                    ]);
                }
                $price = array_key_exists('unit_price', $line) && $line['unit_price'] !== null && $line['unit_price'] !== ''
                    ? (float) $line['unit_price']
                    : 0.0;
            }

            $sub = max(0, round($qty * $price - $disc, 2));
            $taxAmt = round($sub * ($taxPct / 100), 2);
            $lineTotal = round($sub + $taxAmt, 2);
            $linesTotal = round($linesTotal + $lineTotal, 2);

            $lineRows[] = [
                'sort_order' => $i,
                'product_id' => $hasProductId ? (int) $pid : null,
                'product_name' => $productName,
                'qty' => $qty,
                'unit_price' => $price,
                'discount_amount' => $disc,
                'tax_percent' => $taxPct,
                'line_total' => $lineTotal,
            ];
        }

        $grand = max(0, round($linesTotal + $orderTax + $shipping - $orderDisc, 2));

        DB::transaction(function () use ($model, $validated, $orderTax, $orderDisc, $shipping, $purchaseType, $grand, $lineRows): void {
            $paidAmount = min((float) $model->paid_amount, $grand);
            $due = round(max(0, $grand - $paidAmount), 2);
            $paymentStatus = $due <= 0 ? 'Paid' : ($paidAmount > 0 ? 'Overdue' : 'Unpaid');

            $model->update([
                'supplier_id' => (int) $validated['supplier_id'],
                'reference' => trim($validated['reference']),
                'purchase_date' => $validated['purchase_date'],
                'status' => $validated['status'],
                'purchase_type' => $purchaseType,
                'order_tax' => $orderTax,
                'order_discount' => $orderDisc,
                'shipping' => $shipping,
                'description' => $this->normalizeDescription($validated['description'] ?? null),
                'grand_total' => $grand,
                'paid_amount' => $paidAmount,
                'due_amount' => $due,
                'payment_status' => $paymentStatus,
            ]);

            $existingLines = $model->lines()->orderBy('sort_order')->orderBy('id')->get()->values();
            foreach ($lineRows as $idx => $row) {
                /** @var PurchaseLine $lineModel */
                $lineModel = $existingLines[$idx] ?? new PurchaseLine(['purchase_id' => $model->id, 'received_qty' => 0]);
                $receivedQty = (float) ($lineModel->received_qty ?? 0);
                $nextQty = (float) $row['qty'];
                if ($receivedQty > $nextQty) {
                    $receivedQty = $nextQty;
                }
                $lineModel->fill($row + ['received_qty' => $receivedQty]);
                $lineModel->purchase_id = $model->id;
                $lineModel->save();
            }
            for ($i = count($lineRows); $i < $existingLines->count(); $i++) {
                $line = $existingLines[$i];
                if ((float) $line->received_qty > 0) {
                    continue;
                }
                $line->delete();
            }
        });

        $model->refresh()->load(['supplier:id,name,code,email', 'lines']);
        $this->refreshPurchaseStatus($model);
        $model->refresh()->load(['supplier:id,name,code,email', 'lines']);

        return response()->json([
            'message' => 'Purchase updated.',
            'purchase' => $this->toDetailPayload($model),
        ]);
    }

    public function receive(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $user = $request->user();

        $validated = $request->validate([
            'received_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'reference' => ['nullable', 'string', 'max:120'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.line_id' => ['required', 'integer'],
            'lines.*.qty_received' => ['required', 'integer', 'min:1'],
        ]);

        $model = DB::transaction(function () use ($tenant, $model, $validated, $user): Purchase {
            $model = Purchase::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($model->id)
                ->lockForUpdate()
                ->firstOrFail();

            $model->load(['lines']);
            $linesById = $model->lines->keyBy('id');

            $receipt = PurchaseReceipt::query()->create([
                'tenant_id' => $tenant->id,
                'purchase_id' => $model->id,
                'received_at' => $validated['received_at'] ?? now()->toDateString(),
                'reference' => $validated['reference'] ?? $model->reference,
                'note' => $this->normalizeDescription($validated['note'] ?? null),
                'created_by_user_id' => $user?->id,
            ]);

            foreach ($validated['lines'] as $entry) {
                /** @var PurchaseLine|null $line */
                $line = $linesById->get((int) $entry['line_id']);
                if (! $line) {
                    throw ValidationException::withMessages([
                        'lines' => 'One or more purchase lines are invalid.',
                    ]);
                }
                $qtyReceived = (int) $entry['qty_received'];
                $remaining = max(0, (int) floor((float) $line->qty - (float) $line->received_qty));
                if ($qtyReceived > $remaining + 0.0001) {
                    throw ValidationException::withMessages([
                        'lines' => "Cannot receive more than remaining quantity for line {$line->id}.",
                    ]);
                }
                if ($qtyReceived <= 0) {
                    continue;
                }

                if ($model->purchase_type === 'stock' && $line->product_id) {
                    $product = Product::query()
                        ->where('tenant_id', $tenant->id)
                        ->whereNull('deleted_at')
                        ->whereKey($line->product_id)
                        ->lockForUpdate()
                        ->first();
                    if ($product) {
                        $before = (int) $product->qty;
                        $after = $before + $qtyReceived;
                        $product->qty = $after;
                        $product->save();

                        StockAdjustment::query()->create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'type' => 'add',
                            'quantity' => $qtyReceived,
                            'qty_before' => $before,
                            'qty_after' => $after,
                            'reference' => (string) ($validated['reference'] ?? $model->reference),
                            'notes' => trim((string) ("Purchase receipt #{$receipt->id}")) ?: null,
                            'created_by_user_id' => $user?->id,
                        ]);
                    }
                }

                $line->received_qty = round((float) $line->received_qty + $qtyReceived, 3);
                $line->save();

                $receipt->lines()->create([
                    'purchase_line_id' => $line->id,
                    'product_id' => $line->product_id,
                    'qty_received' => $qtyReceived,
                ]);
            }

            $model->load(['lines']);
            $this->refreshPurchaseStatus($model);

            return $model->fresh(['supplier:id,name,code,email', 'lines']);
        });

        return response()->json([
            'message' => 'Purchase receipt recorded.',
            'purchase' => $this->toDetailPayload($model),
        ], 201);
    }

    public function receipts(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        $model->load([
            'receipts.lines',
            'receipts.createdBy:id,name,email',
        ]);

        return response()->json([
            'message' => 'Purchase receipts retrieved.',
            'receipts' => $model->receipts->map(function (PurchaseReceipt $receipt): array {
                return [
                    'id' => $receipt->id,
                    'purchase_id' => $receipt->purchase_id,
                    'received_at' => $receipt->received_at?->format('Y-m-d'),
                    'reference' => $receipt->reference,
                    'note' => $receipt->note,
                    'created_at' => $receipt->created_at?->toIso8601String(),
                    'created_by' => $receipt->createdBy?->only(['id', 'name', 'email']),
                    'lines' => $receipt->lines->map(fn ($line) => [
                        'id' => $line->id,
                        'purchase_line_id' => $line->purchase_line_id,
                        'product_id' => $line->product_id,
                        'qty_received' => (string) $line->qty_received,
                    ])->values()->all(),
                ];
            })->values()->all(),
        ]);
    }

    public function addPayment(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $user = $request->user();

        $validated = $request->validate([
            'paid_at' => ['nullable', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['nullable', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $payment = DB::transaction(function () use ($tenant, $model, $validated, $user): PurchasePayment {
            $model = Purchase::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($model->id)
                ->lockForUpdate()
                ->firstOrFail();

            $amount = round((float) $validated['amount'], 2);
            $dueBefore = round((float) $model->due_amount, 2);
            if ($amount > $dueBefore + 0.0001) {
                throw ValidationException::withMessages([
                    'amount' => 'Payment amount cannot exceed due amount.',
                ]);
            }

            $payment = PurchasePayment::query()->create([
                'tenant_id' => $tenant->id,
                'purchase_id' => $model->id,
                'paid_at' => $validated['paid_at'] ?? now()->toDateString(),
                'amount' => $amount,
                'method' => trim((string) ($validated['method'] ?? 'Cash')) ?: 'Cash',
                'reference' => $validated['reference'] ?? null,
                'note' => $this->normalizeDescription($validated['note'] ?? null),
                'created_by_user_id' => $user?->id,
            ]);

            $model->paid_amount = round((float) $model->paid_amount + $amount, 2);
            $model->due_amount = round(max(0, (float) $model->grand_total - (float) $model->paid_amount), 2);
            $model->payment_status = (float) $model->due_amount <= 0
                ? 'Paid'
                : ((float) $model->paid_amount > 0 ? 'Overdue' : 'Unpaid');
            $model->save();

            return $payment->fresh(['createdBy:id,name,email']);
        });

        $model->refresh()->load(['supplier:id,name,code,email', 'lines']);
        $this->sendPurchasePaymentUpdatedEmail($model, $payment);

        return response()->json([
            'message' => 'Purchase payment recorded.',
            'payment' => [
                'id' => $payment->id,
                'purchase_id' => $payment->purchase_id,
                'paid_at' => $payment->paid_at?->format('Y-m-d'),
                'amount' => (string) $payment->amount,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'note' => $payment->note,
                'created_at' => $payment->created_at?->toIso8601String(),
                'created_by' => $payment->createdBy?->only(['id', 'name', 'email']),
            ],
            'purchase' => $this->toDetailPayload($model),
        ], 201);
    }

    public function payments(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        $rows = $model->payments()->with('createdBy:id,name,email')->get();

        return response()->json([
            'message' => 'Purchase payments retrieved.',
            'payments' => $rows->map(fn (PurchasePayment $payment) => [
                'id' => $payment->id,
                'purchase_id' => $payment->purchase_id,
                'paid_at' => $payment->paid_at?->format('Y-m-d'),
                'amount' => (string) $payment->amount,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'note' => $payment->note,
                'created_at' => $payment->created_at?->toIso8601String(),
                'created_by' => $payment->createdBy?->only(['id', 'name', 'email']),
            ])->values()->all(),
        ]);
    }

    public function sendToSupplier(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        $model->load(['supplier:id,name,code,email', 'lines']);

        $validated = $request->validate([
            'to' => ['nullable', 'email:rfc'],
            'cc' => ['nullable', 'array'],
            'cc.*' => ['email:rfc'],
            'subject' => ['nullable', 'string', 'max:190'],
            'message' => ['nullable', 'string', 'max:8000'],
        ]);

        $to = trim((string) ($validated['to'] ?? $model->supplier?->email ?? ''));
        if ($to === '') {
            throw ValidationException::withMessages([
                'supplier_email' => 'Supplier email is required before sending purchase.',
            ]);
        }

        $cc = collect($validated['cc'] ?? [])
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->values()
            ->all();
        $subject = isset($validated['subject']) ? trim((string) $validated['subject']) : null;
        $message = isset($validated['message']) ? trim((string) $validated['message']) : null;

        try {
            $mail = Mail::to($to);
            if (! empty($cc)) {
                $mail->cc($cc);
            }
            $mail->send(new PurchaseOrderAddedMail($model, $subject, $message));
            if (
                Schema::hasColumn('purchases', 'last_sent_to') &&
                Schema::hasColumn('purchases', 'last_sent_cc') &&
                Schema::hasColumn('purchases', 'last_sent_at')
            ) {
                $model->last_sent_to = $to;
                $model->last_sent_cc = ! empty($cc) ? implode(', ', $cc) : null;
                $model->last_sent_at = now();
                $model->save();
            }
        } catch (\Throwable $e) {
            Log::warning('Purchase send-to-supplier email failed.', [
                'purchase_id' => $model->id,
                'supplier_email' => $to,
                'cc' => $cc,
                'error' => $e->getMessage(),
            ]);
            throw ValidationException::withMessages([
                'email' => 'Could not send purchase email to supplier.',
            ]);
        }

        if ($model->status === 'Draft') {
            $model->status = 'Ordered';
            $model->save();
            $model->refresh()->load(['supplier:id,name,code,email', 'lines']);
        }

        return response()->json([
            'message' => 'Purchase email sent to supplier.',
            'purchase' => $this->toDetailPayload($model),
        ]);
    }

    public function destroy(Request $request, string $purchase): JsonResponse
    {
        $model = $this->resolvePurchase($request, $purchase);
        $model->delete();

        return response()->json([
            'message' => 'Purchase deleted.',
        ]);
    }

    private function resolvePurchase(Request $request, string $purchaseId): Purchase
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($purchaseId)
            ->firstOrFail();
    }

    private function normalizeDescription(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $t = trim($value);

        return $t === '' ? null : $t;
    }

    /**
     * @return array<string, mixed>
     */
    private function toListPayload(Purchase $p): array
    {
        $supplierName = $p->supplier instanceof Supplier ? (string) $p->supplier->name : '—';

        return [
            'id' => $p->id,
            'supplier_id' => $p->supplier_id,
            'supplier_name' => $supplierName,
            'supplier_email' => $p->supplier instanceof Supplier ? (string) ($p->supplier->email ?? '') : '',
            'reference' => $p->reference,
            'purchase_date' => $p->purchase_date->format('Y-m-d'),
            'status' => $p->status,
            'purchase_type' => $p->purchase_type ?? 'stock',
            'grand_total' => (string) $p->grand_total,
            'paid_amount' => (string) $p->paid_amount,
            'due_amount' => (string) $p->due_amount,
            'payment_status' => $p->payment_status,
            'last_sent_to' => $p->last_sent_to,
            'last_sent_cc' => $p->last_sent_cc,
            'last_sent_at' => optional($p->last_sent_at)->toIso8601String(),
            'ordered_qty' => (string) $p->lines()->sum('qty'),
            'received_qty' => (string) $p->lines()->sum('received_qty'),
            'remaining_qty' => (string) max(0, (float) $p->lines()->sum('qty') - (float) $p->lines()->sum('received_qty')),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function toDetailPayload(Purchase $p): array
    {
        $base = $this->toListPayload($p);

        $base['order_tax'] = (string) $p->order_tax;
        $base['order_discount'] = (string) $p->order_discount;
        $base['shipping'] = (string) $p->shipping;
        $base['description'] = $p->description;
        $base['lines'] = $p->lines->map(fn (PurchaseLine $line) => [
            'id' => $line->id,
            'sort_order' => $line->sort_order,
            'product_id' => $line->product_id,
            'product_name' => $line->product_name,
            'qty' => (string) $line->qty,
            'received_qty' => (string) $line->received_qty,
            'unit_price' => (string) $line->unit_price,
            'discount_amount' => (string) $line->discount_amount,
            'tax_percent' => (string) $line->tax_percent,
            'line_total' => (string) $line->line_total,
        ])->values()->all();

        return $base;
    }

    private function refreshPurchaseStatus(Purchase $purchase): void
    {
        $ordered = (float) $purchase->lines()->sum('qty');
        $received = (float) $purchase->lines()->sum('received_qty');
        $remaining = max(0, round($ordered - $received, 3));
        if ($purchase->status === 'Draft' && $received <= 0.0001) {
            return;
        }
        $nextStatus = $remaining <= 0.0001
            ? 'Received'
            : ($received > 0.0001 ? 'Partial' : 'Ordered');
        $purchase->status = $nextStatus;
        $purchase->save();
    }

    private function sendPurchasePaymentUpdatedEmail(Purchase $purchase, PurchasePayment $payment): void
    {
        $purchase->loadMissing('supplier');
        $to = trim((string) ($purchase->supplier?->email ?? ''));
        if ($to === '') {
            return;
        }
        try {
            Mail::to($to)->send(new PurchasePaymentUpdatedMail($purchase, $payment));
        } catch (\Throwable $e) {
            Log::warning('Purchase payment email failed.', [
                'purchase_id' => $purchase->id,
                'payment_id' => $payment->id,
                'supplier_email' => $to,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function resolveProduct(int $tenantId, int $productId): Product
    {
        return Product::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->whereKey($productId)
            ->firstOrFail();
    }

    /** Prefer buying (cost) price for purchase lines; fall back to selling price. */
    private function defaultPurchaseUnitPrice(Product $product): float
    {
        if ($product->buying_price !== null) {
            return max(0, round((float) $product->buying_price, 2));
        }
        if ($product->selling_price !== null) {
            return max(0, round((float) $product->selling_price, 2));
        }

        return 0.0;
    }

    /**
     * @param  array<string, mixed>  $line
     */
    private function resolveLineUnitPrice(array $line, Product $product): float
    {
        if (array_key_exists('unit_price', $line) && $line['unit_price'] !== null && $line['unit_price'] !== '') {
            return max(0, round((float) $line['unit_price'], 2));
        }

        return $this->defaultPurchaseUnitPrice($product);
    }
}
