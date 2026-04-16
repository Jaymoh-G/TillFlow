<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\PosOrderPayment;
use App\Models\Product;
use App\Models\Tenant;
use App\Services\Inventory\ProductStoreStockService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class PosOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $orders = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->withCount('items')
            ->with([
                'cashier:id,name',
                'store:id,store_name',
                'payments:id,pos_order_id,method,transaction_ref',
            ])
            ->get();

        return response()->json([
            'message' => 'POS orders retrieved.',
            'pos_orders' => $orders->map(fn(PosOrder $o) => $this->serializeOrderSummary($o))->values()->all(),
        ]);
    }

    /**
     * Aggregates for the POS "Cash Register" modal: completed orders and payment lines for a calendar day.
     *
     * Query: date (Y-m-d, default today app TZ), store_id (optional).
     */
    public function registerSummary(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'store_id' => ['nullable', 'integer'],
        ]);

        $tz = (string) config('app.timezone', 'UTC');
        $day = isset($validated['date']) && is_string($validated['date'])
            ? $validated['date']
            : Carbon::now($tz)->format('Y-m-d');

        $start = Carbon::parse($day, $tz)->startOfDay();
        $end = Carbon::parse($day, $tz)->endOfDay();

        $ordersQuery = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', PosOrder::STATUS_COMPLETED)
            ->whereBetween('completed_at', [$start, $end]);

        $storeId = isset($validated['store_id']) ? (int) $validated['store_id'] : 0;
        if ($storeId > 0) {
            $ordersQuery->where('store_id', $storeId);
        }

        $user = $request->user();
        $allowed = $user?->allowed_store_ids ?? null;
        if (is_array($allowed) && $allowed !== []) {
            $ordersQuery->whereIn('store_id', array_map('intval', $allowed));
        }

        $orderIdsSub = (clone $ordersQuery)->select('id');

        $totalSaleAmount = (float) (clone $ordersQuery)->sum('total_amount');
        $totalTendered = (float) (clone $ordersQuery)->sum('tendered_amount');
        $totalChange = (float) (clone $ordersQuery)->sum('change_amount');
        $orderCount = (int) (clone $ordersQuery)->count();

        $currency = (string) ((clone $ordersQuery)->orderByDesc('id')->value('currency') ?? 'KES');
        if ($currency === '') {
            $currency = 'KES';
        }

        $paymentBase = PosOrderPayment::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('pos_order_id', $orderIdsSub);

        $totalPaymentLines = (float) (clone $paymentBase)->sum('amount');

        $byMethod = (clone $paymentBase)
            ->selectRaw('method, SUM(amount) as s')
            ->groupBy('method')
            ->pluck('s', 'method');

        $cashPayment = (float) ($byMethod[PosOrderPayment::METHOD_CASH] ?? 0);
        $mpesaPayment = (float) ($byMethod[PosOrderPayment::METHOD_MPESA] ?? 0);
        $cardPayment = (float) ($byMethod[PosOrderPayment::METHOD_CARD] ?? 0);
        $bankTransferPayment = (float) ($byMethod[PosOrderPayment::METHOD_BANK_TRANSFER] ?? 0);
        $chequePayment = (float) ($byMethod[PosOrderPayment::METHOD_CHEQUE] ?? 0);
        $otherPayment = (float) ($byMethod[PosOrderPayment::METHOD_OTHER] ?? 0);

        // Soft "net cash" from sales: cash tendered via payment lines minus change issued (all methods).
        $netCashFromSales = round(max(0.0, $cashPayment - $totalChange), 2);

        return response()->json([
            'message' => 'Register summary retrieved.',
            'register_summary' => [
                'date' => $day,
                'timezone' => $tz,
                'currency' => $currency,
                'order_count' => $orderCount,
                'total_sale_amount' => round($totalSaleAmount, 2),
                'total_tendered' => round($totalTendered, 2),
                'total_payment_lines' => round($totalPaymentLines, 2),
                'total_change_issued' => round($totalChange, 2),
                'payments_by_method' => [
                    'cash' => round($cashPayment, 2),
                    'mpesa' => round($mpesaPayment, 2),
                    'card' => round($cardPayment, 2),
                    'bank_transfer' => round($bankTransferPayment, 2),
                    'cheque' => round($chequePayment, 2),
                    'other' => round($otherPayment, 2),
                ],
                'cash_payment' => round($cashPayment, 2),
                'net_cash_from_sales' => $netCashFromSales,
                'total_sale_return' => 0.0,
                'total_expense' => 0.0,
                'drawer_tracked' => false,
            ],
        ]);
    }

    public function show(Request $request, PosOrder $posOrder): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $posOrder->tenant_id === (int) $tenant->id, 404);

        $posOrder->loadMissing(['items' => fn($q) => $q->orderBy('position'), 'payments', 'store:id,store_name']);

        return response()->json([
            'message' => 'POS order retrieved.',
            'pos_order' => $this->serializeOrder($posOrder),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')->where(fn($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_email' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:8'],
            'notes' => ['nullable', 'string'],

            'discount_amount' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')->where(fn($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'items.*.sku' => ['nullable', 'string', 'max:255'],
            'items.*.product_name' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', Rule::in(PosOrderPayment::METHODS)],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'gt:0'],
            'payments.*.transaction_ref' => ['nullable', 'string', 'max:64'],
            'payments.*.paid_at' => ['nullable', 'date'],
            'payments.*.notes' => ['nullable', 'string'],
        ]);

        $userId = $request->user()?->id;
        $discount = round((float) ($validated['discount_amount'] ?? 0), 2);
        $currency = trim((string) ($validated['currency'] ?? 'KES')) ?: 'KES';

        $storeId = (int) $validated['store_id'];
        $this->assertUserMaySellFromStore($request, $storeId);

        $created = DB::transaction(function () use ($tenant, $validated, $userId, $discount, $currency, $storeId): PosOrder {
            $this->deductInventoryForPosSale($tenant, $validated['items'], $storeId);

            $customer = null;
            if (! empty($validated['customer_id'])) {
                $customer = Customer::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereKey((int) $validated['customer_id'])
                    ->whereNull('deleted_at')
                    ->first();
            }

            $subtotalExTax = 0.0;
            $taxAmt = 0.0;

            $itemsPayload = $validated['items'] ?? [];
            $normalizedItems = [];
            foreach ($itemsPayload as $idx => $row) {
                $qty = round((float) ($row['quantity'] ?? 0), 3);
                $unit = round((float) ($row['unit_price'] ?? 0), 2);
                $pct = round((float) ($row['tax_percent'] ?? 0), 2);
                $lineSub = round($qty * $unit, 2);
                $lineTax = round($lineSub * ($pct / 100.0), 2);
                $lineTotal = round($lineSub + $lineTax, 2);
                $subtotalExTax += $lineSub;
                $taxAmt += $lineTax;

                $normalizedItems[] = [
                    'tenant_id' => $tenant->id,
                    'product_id' => $row['product_id'] ?? null,
                    'sku' => $row['sku'] ?? null,
                    'product_name' => $row['product_name'],
                    'description' => $row['description'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $unit,
                    'tax_percent' => $pct,
                    'line_total' => $lineTotal,
                    'position' => $idx,
                ];
            }

            $subtotalExTax = round($subtotalExTax, 2);
            $taxAmt = round($taxAmt, 2);
            $discountAmt = min($discount, $subtotalExTax + $taxAmt);
            $grandTotal = round(max(0.0, ($subtotalExTax + $taxAmt) - $discountAmt), 2);

            $paymentsPayload = $validated['payments'] ?? [];
            $tendered = 0.0;
            foreach ($paymentsPayload as $p) {
                $tendered += (float) ($p['amount'] ?? 0);
            }
            $tendered = round($tendered, 2);
            $change = round(max(0.0, $tendered - $grandTotal), 2);

            $order = PosOrder::create([
                'tenant_id' => $tenant->id,
                'store_id' => $storeId,
                'order_no' => $this->nextOrderNo($tenant->id),
                'status' => PosOrder::STATUS_COMPLETED,
                'customer_id' => $customer?->id,
                'customer_name' => $customer?->name ?? ($validated['customer_name'] ?? null),
                'customer_email' => $customer?->email ?? ($validated['customer_email'] ?? null),
                'subtotal_amount' => $subtotalExTax,
                'tax_amount' => $taxAmt,
                'discount_amount' => $discountAmt,
                'total_amount' => $grandTotal,
                'tendered_amount' => $tendered,
                'change_amount' => $change,
                'currency' => $currency,
                'created_by' => $userId,
                'completed_at' => now(),
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($normalizedItems as $payload) {
                $payload['pos_order_id'] = $order->id;
                PosOrderItem::create($payload);
            }

            foreach ($paymentsPayload as $p) {
                PosOrderPayment::create([
                    'tenant_id' => $tenant->id,
                    'pos_order_id' => $order->id,
                    'method' => $p['method'],
                    'amount' => round((float) $p['amount'], 2),
                    'transaction_ref' => $p['transaction_ref'] ?? null,
                    'paid_at' => isset($p['paid_at']) ? Carbon::parse($p['paid_at']) : now(),
                    'notes' => $p['notes'] ?? null,
                ]);
            }

            return $order->fresh(['items' => fn($q) => $q->orderBy('position'), 'payments', 'store:id,store_name']);
        });

        return response()->json([
            'message' => 'POS order created.',
            'pos_order' => $this->serializeOrder($created),
        ], 201);
    }

    public function emailPreview(Request $request, PosOrder $posOrder): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        abort_unless((int) $posOrder->tenant_id === (int) $tenant->id, 404);

        $posOrder->loadMissing(['items' => fn($q) => $q->orderBy('position'), 'payments', 'store:id,store_name']);

        $html = View::make('mail.pos-order-receipt-sent', [
            'order' => $posOrder,
            'tenant' => $tenant,
            'logoSrc' => $this->resolveReceiptLogoSrc($tenant),
            'customMessage' => null,
        ])->render();

        $toEmail = strtolower(trim((string) ($posOrder->customer_email ?? '')));
        $subject = 'Receipt ' . trim((string) ($posOrder->order_no ?? ''));
        if (trim((string) ($posOrder->customer_name ?? '')) !== '') {
            $subject .= ' — ' . trim((string) $posOrder->customer_name);
        }

        return response()->json([
            'message' => 'Preview generated.',
            'subject' => $subject,
            'html' => $html,
            'to_email' => $toEmail,
            'message_template' => 'Please find your POS receipt details below.',
        ]);
    }

    public function sendToCustomer(Request $request, PosOrder $posOrder): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        abort_unless((int) $posOrder->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'to_email' => ['nullable', 'email', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
        ]);

        $posOrder->loadMissing(['items' => fn($q) => $q->orderBy('position'), 'payments', 'store:id,store_name']);

        $to = strtolower(trim((string) ($validated['to_email'] ?? $posOrder->customer_email ?? '')));
        if ($to === '') {
            return response()->json([
                'message' => 'Customer email is missing. Add an email, then try again.',
            ], 422);
        }

        $subject = trim((string) ($validated['subject'] ?? ''));
        if ($subject === '') {
            $subject = 'Receipt ' . trim((string) ($posOrder->order_no ?? ''));
            if (trim((string) ($posOrder->customer_name ?? '')) !== '') {
                $subject .= ' — ' . trim((string) $posOrder->customer_name);
            }
        }

        $customMessage = trim((string) ($validated['message'] ?? ''));
        $receiptHtml = View::make('mail.pos-order-receipt-sent', [
            'order' => $posOrder,
            'tenant' => $tenant,
            'logoSrc' => $this->resolveReceiptLogoSrc($tenant),
            'customMessage' => $customMessage !== '' ? $customMessage : null,
        ])->render();

        $pdfBinary = Pdf::setOption([
            'dpi' => 96,
            'defaultFont' => 'Helvetica',
            'isRemoteEnabled' => true,
            'isHtml5ParserEnabled' => true,
            'isFontSubsettingEnabled' => true,
        ])->loadHtml($receiptHtml)
            ->setPaper('a4', 'portrait')
            ->output();
        $attachmentName = trim((string) ($posOrder->order_no ?? '')) !== ''
            ? trim((string) $posOrder->order_no) . '.pdf'
            : 'receipt.pdf';

        try {
            Mail::send([], [], function ($message) use ($to, $subject, $receiptHtml, $pdfBinary, $attachmentName): void {
                $message->to($to)
                    ->subject($subject)
                    ->html($receiptHtml)
                    ->attachData($pdfBinary, $attachmentName, ['mime' => 'application/pdf']);
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not send the receipt email. Check mail configuration (MAIL_*) or try again.',
            ], 500);
        }

        $posOrder->sent_to_customer_at = now();
        $posOrder->saveQuietly();

        return response()->json([
            'message' => 'Receipt sent to the customer.',
            'pos_order' => $this->serializeOrder($posOrder->fresh(['items' => fn($q) => $q->orderBy('position'), 'payments', 'store:id,store_name'])),
        ]);
    }

    private function serializeOrderSummary(PosOrder $o): array
    {
        $paymentMethods = $o->relationLoaded('payments')
            ? $o->payments->pluck('method')->filter()->map(fn($m) => (string) $m)->unique()->values()->all()
            : [];

        $paymentType = null;
        if (count($paymentMethods) === 1) {
            $paymentType = $paymentMethods[0];
        } elseif (count($paymentMethods) > 1) {
            $paymentType = 'mixed';
        }

        $reference = null;
        if ($o->relationLoaded('payments')) {
            $reference = $o->payments->pluck('transaction_ref')->filter()->map(fn($r) => trim((string) $r))->first() ?: null;
        }

        return [
            'id' => $o->id,
            'order_no' => $o->order_no,
            'status' => $o->status,
            'store_id' => $o->store_id,
            'store_name' => $o->relationLoaded('store') ? $o->store?->store_name : null,
            'customer_id' => $o->customer_id,
            'customer_name' => $o->customer_name,
            'total_amount' => $o->total_amount,
            'tendered_amount' => $o->tendered_amount,
            'change_amount' => $o->change_amount,
            'currency' => $o->currency,
            'completed_at' => optional($o->completed_at)->toISOString(),
            'items_count' => $o->items_count ?? null,
            'sent_to_customer_at' => $o->sent_to_customer_at ? $o->sent_to_customer_at->toISOString() : null,
            'biller' => $o->relationLoaded('cashier') ? ($o->cashier?->name) : null,
            'reference' => $reference,
            'payment_type' => $paymentType,
        ];
    }

    private function serializeOrder(PosOrder $o): array
    {
        return [
            'id' => $o->id,
            'tenant_id' => $o->tenant_id,
            'store_id' => $o->store_id,
            'store_name' => $o->relationLoaded('store') ? $o->store?->store_name : null,
            'order_no' => $o->order_no,
            'status' => $o->status,
            'customer_id' => $o->customer_id,
            'customer_name' => $o->customer_name,
            'customer_email' => $o->customer_email,
            'subtotal_amount' => $o->subtotal_amount,
            'tax_amount' => $o->tax_amount,
            'discount_amount' => $o->discount_amount,
            'total_amount' => $o->total_amount,
            'tendered_amount' => $o->tendered_amount,
            'change_amount' => $o->change_amount,
            'currency' => $o->currency,
            'created_by' => $o->created_by,
            'completed_at' => $o->completed_at ? $o->completed_at->toISOString() : null,
            'voided_at' => $o->voided_at ? $o->voided_at->toISOString() : null,
            'notes' => $o->notes,
            'sent_to_customer_at' => $o->sent_to_customer_at ? $o->sent_to_customer_at->toISOString() : null,
            'items' => $o->items->map(fn(PosOrderItem $it) => [
                'id' => $it->id,
                'product_id' => $it->product_id,
                'sku' => $it->sku,
                'product_name' => $it->product_name,
                'description' => $it->description,
                'quantity' => $it->quantity,
                'unit_price' => $it->unit_price,
                'tax_percent' => $it->tax_percent,
                'line_total' => $it->line_total,
                'position' => $it->position,
            ])->values()->all(),
            'payments' => $o->payments->map(fn(PosOrderPayment $p) => [
                'id' => $p->id,
                'method' => $p->method,
                'amount' => $p->amount,
                'transaction_ref' => $p->transaction_ref,
                'paid_at' => $p->paid_at ? $p->paid_at->toISOString() : null,
                'notes' => $p->notes,
            ])->values()->all(),
        ];
    }

    /**
     * When the user model defines a non-empty {@see $allowed_store_ids} array, restrict sales to those stores.
     */
    private function assertUserMaySellFromStore(Request $request, int $storeId): void
    {
        $user = $request->user();
        if ($user === null) {
            return;
        }

        $allowed = $user->allowed_store_ids ?? null;
        if (! is_array($allowed) || $allowed === []) {
            return;
        }

        $allowedInts = array_map('intval', $allowed);
        if (! in_array($storeId, $allowedInts, true)) {
            throw new AccessDeniedHttpException('You are not allowed to sell from this store.');
        }
    }

    /**
     * Decrease per-store bucket qty and sync `products.qty` (locks rows to avoid overselling).
     *
     * @param  array<int, array<string, mixed>>  $itemsPayload
     */
    private function deductInventoryForPosSale(Tenant $tenant, array $itemsPayload, int $storeId): void
    {
        /** @var ProductStoreStockService $service */
        $service = app(ProductStoreStockService::class);

        /** @var array<int, int> $byProduct */
        $byProduct = [];

        foreach ($itemsPayload as $row) {
            $qtyFloat = round((float) ($row['quantity'] ?? 0), 3);
            $need = (int) $qtyFloat;
            if ($need < 1 && $qtyFloat > 0) {
                $need = 1;
            }
            if ($need < 1) {
                continue;
            }

            $productId = isset($row['product_id']) ? (int) $row['product_id'] : 0;
            if ($productId <= 0) {
                $sku = isset($row['sku']) ? trim((string) $row['sku']) : '';
                if ($sku === '') {
                    continue;
                }
                $found = Product::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->where('sku', $sku)
                    ->first();
                $productId = $found ? (int) $found->id : 0;
            }

            if ($productId <= 0) {
                continue;
            }

            $byProduct[$productId] = ($byProduct[$productId] ?? 0) + $need;
        }

        if ($byProduct === []) {
            return;
        }

        ksort($byProduct, SORT_NUMERIC);

        foreach ($byProduct as $productId => $need) {
            $product = Product::query()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->whereKey($productId)
                ->lockForUpdate()
                ->first();

            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => ['A sold product is no longer available. Refresh and try again.'],
                ]);
            }

            $bucket = $service->getBucket($product, $storeId);
            $available = $bucket ? (int) $bucket->qty : 0;

            if ($available < $need) {
                $label = trim((string) ($product->name ?? 'Item'));
                $sku = trim((string) ($product->sku ?? ''));

                throw ValidationException::withMessages([
                    'items' => [
                        'Insufficient stock at the selected store for ' . $label . ($sku !== '' ? ' (SKU ' . $sku . ')' : '')
                            . '. Available: ' . $available . ', needed: ' . $need . '.',
                    ],
                ]);
            }

            $service->adjustBucket($product, $storeId, -$need);
            $service->syncProductTotalFromBuckets($product->fresh());
        }
    }

    private function nextOrderNo(int $tenantId): string
    {
        $last = PosOrder::query()
            ->where('tenant_id', $tenantId)
            ->where('order_no', 'like', 'POS-%')
            ->orderByDesc('id')
            ->value('order_no');

        $n = 0;
        if (is_string($last) && preg_match('/^POS-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'POS-' . str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }

    private function resolveReceiptLogoSrc(Tenant $tenant): ?string
    {
        $uiRaw = $tenant->ui_settings ?? null;
        $ui = [];
        if (is_array($uiRaw)) {
            $ui = $uiRaw;
        } elseif (is_object($uiRaw)) {
            $ui = (array) $uiRaw;
        } elseif (is_string($uiRaw) && trim($uiRaw) !== '') {
            $decoded = json_decode($uiRaw, true);
            if (is_array($decoded)) {
                $ui = $decoded;
            }
        }

        $candidate = trim((string) (
            Arr::get($ui, 'invoiceLogoDataUrl')
            ?? Arr::get($ui, 'invoice_logo_data_url')
            ?? Arr::get($ui, 'company_logo')
            ?? Arr::get($ui, 'companyLogo')
            ?? Arr::get($ui, 'logo')
            ?? Arr::get($ui, 'logo_url')
            ?? ''
        ));

        if ($candidate === '') {
            return null;
        }

        if (str_starts_with($candidate, 'data:image/')) {
            return $candidate;
        }

        if (preg_match('/^https?:\/\//i', $candidate) === 1) {
            return $candidate;
        }

        $relative = ltrim($candidate, '/');
        $publicPath = public_path($relative);
        if (is_file($publicPath)) {
            $base = rtrim((string) config('app.url', ''), '/');

            return $base !== '' ? $base . '/' . $relative : '/' . $relative;
        }

        $storagePath = public_path('storage/' . $relative);
        if (is_file($storagePath)) {
            $base = rtrim((string) config('app.url', ''), '/');

            return $base !== '' ? $base . '/storage/' . $relative : '/storage/' . $relative;
        }

        return null;
    }
}
