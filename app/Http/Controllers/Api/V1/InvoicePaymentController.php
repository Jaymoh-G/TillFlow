<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\InvoicePaymentReceiptSentToCustomer;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\Rule;

class InvoicePaymentController extends Controller
{
    /** @var list<string> */
    private const USER_PAYMENT_METHODS = [
        InvoicePayment::METHOD_CASH,
        InvoicePayment::METHOD_BANK_TRANSFER,
        InvoicePayment::METHOD_MPESA,
        InvoicePayment::METHOD_CARD,
        InvoicePayment::METHOD_CHEQUE,
        InvoicePayment::METHOD_OTHER,
    ];

    public function indexAll(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $q = InvoicePayment::query()
            ->where('tenant_id', $tenant->id)
            ->with(['invoice' => fn ($rel) => $rel->select('id', 'invoice_ref', 'customer_name', 'total_amount', 'amount_paid', 'status', 'issued_at')]);

        if ($request->filled('invoice_id')) {
            $q->where('invoice_id', (int) $request->query('invoice_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('paid_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('paid_at', '<=', $request->query('to'));
        }
        if ($request->filled('q')) {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $q->where(function ($sub) use ($needle): void {
                $sub->where('receipt_ref', 'like', $needle)
                    ->orWhere('transaction_id', 'like', $needle)
                    ->orWhereHas('invoice', fn ($inv) => $inv->where('invoice_ref', 'like', $needle)
                        ->orWhere('customer_name', 'like', $needle));
            });
        }

        $rows = $q->orderByDesc('paid_at')->orderByDesc('id')->limit(500)->get();

        return response()->json([
            'message' => 'Invoice payments retrieved.',
            'payments' => $rows->map(fn (InvoicePayment $p) => $this->serializePayment($p))->values()->all(),
        ]);
    }

    public function index(Request $request, string $invoice): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);
        $payments = InvoicePayment::query()
            ->where('tenant_id', $model->tenant_id)
            ->where('invoice_id', $model->id)
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Payments retrieved.',
            'payments' => $payments->map(fn (InvoicePayment $p) => $this->serializePayment($p))->values()->all(),
        ]);
    }

    public function store(Request $request, string $invoice): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveInvoice($request, $invoice);

        if (strcasecmp((string) $model->status, Invoice::STATUS_DRAFT) === 0) {
            return response()->json([
                'message' => 'Record payments after issuing the invoice (move out of Draft).',
            ], 422);
        }

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cannot record payments on a cancelled invoice.',
            ], 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', Rule::in(self::USER_PAYMENT_METHODS)],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:20000'],
            'transaction_id' => ['nullable', 'string', 'max:191'],
        ]);

        $amount = round((float) $validated['amount'], 2);
        $total = round((float) $model->total_amount, 2);
        $currentPaid = round((float) $model->payments()->sum('amount'), 2);

        if ($currentPaid + $amount - $total > 0.01) {
            return response()->json([
                'message' => 'Payment would exceed invoice total.',
            ], 422);
        }

        $payment = DB::transaction(function () use ($tenant, $model, $validated, $amount): InvoicePayment {
            $paidAt = isset($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : now();

            $tid = isset($validated['transaction_id']) ? trim((string) $validated['transaction_id']) : '';
            $row = InvoicePayment::query()->create([
                'tenant_id' => $tenant->id,
                'invoice_id' => $model->id,
                'receipt_ref' => $this->nextReceiptRef($tenant->id),
                'amount' => number_format($amount, 2, '.', ''),
                'payment_method' => $validated['payment_method'],
                'paid_at' => $paidAt,
                'notes' => $validated['notes'] ?? null,
                'transaction_id' => $tid !== '' ? $tid : null,
            ]);

            $model->refresh();
            $model->recalculateAmountPaidAndStatus();

            return $row->fresh();
        });

        return response()->json([
            'message' => 'Payment recorded.',
            'payment' => $this->serializePayment($payment),
            'invoice' => $this->serializedInvoice($request, $model->id),
        ], 201);
    }

    public function update(Request $request, string $invoice, string $payment): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);
        $pay = $this->resolvePayment($model, $payment);

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cannot edit payments on a cancelled invoice.',
            ], 422);
        }

        $validated = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', Rule::in(array_merge(
                self::USER_PAYMENT_METHODS,
                [InvoicePayment::METHOD_OPENING_BALANCE]
            ))],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:20000'],
            'transaction_id' => ['nullable', 'string', 'max:191'],
        ]);

        $newAmount = array_key_exists('amount', $validated) && $validated['amount'] !== null
            ? round((float) $validated['amount'], 2)
            : round((float) $pay->amount, 2);
        $others = round((float) $model->payments()->where('id', '!=', $pay->id)->sum('amount'), 2);
        $total = round((float) $model->total_amount, 2);
        if ($others + $newAmount - $total > 0.01) {
            return response()->json([
                'message' => 'Payments would exceed invoice total.',
            ], 422);
        }

        DB::transaction(function () use ($model, $pay, $validated): void {
            if (array_key_exists('amount', $validated) && $validated['amount'] !== null) {
                $pay->amount = number_format(round((float) $validated['amount'], 2), 2, '.', '');
            }
            if (array_key_exists('payment_method', $validated) && $validated['payment_method'] !== null) {
                $pay->payment_method = $validated['payment_method'];
            }
            if (array_key_exists('paid_at', $validated) && $validated['paid_at'] !== null) {
                $pay->paid_at = Carbon::parse($validated['paid_at']);
            }
            if (array_key_exists('notes', $validated)) {
                $pay->notes = $validated['notes'];
            }
            if (array_key_exists('transaction_id', $validated)) {
                $raw = $validated['transaction_id'];
                $pay->transaction_id = ($raw !== null && trim((string) $raw) !== '') ? trim((string) $raw) : null;
            }
            $pay->save();

            $model->refresh();
            $model->recalculateAmountPaidAndStatus();
        });

        $pay->refresh();

        return response()->json([
            'message' => 'Payment updated.',
            'payment' => $this->serializePayment($pay),
            'invoice' => $this->serializedInvoice($request, $model->id),
        ]);
    }

    public function destroy(Request $request, string $invoice, string $payment): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);
        $pay = $this->resolvePayment($model, $payment);

        if ((string) $pay->payment_method === InvoicePayment::METHOD_OPENING_BALANCE) {
            return response()->json([
                'message' => 'Opening balance payments cannot be deleted.',
            ], 422);
        }

        DB::transaction(function () use ($model, $pay): void {
            $pay->delete();
            $model->refresh();
            $model->recalculateAmountPaidAndStatus();
        });

        return response()->json([
            'message' => 'Payment deleted.',
            'invoice' => $this->serializedInvoice($request, $model->id),
        ]);
    }

    public function sendToCustomer(Request $request, string $payment): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $pay = InvoicePayment::query()
            ->where('tenant_id', $tenant->id)
            ->with(['invoice.customer'])
            ->where('id', (int) $payment)
            ->firstOrFail();

        $invoice = $pay->invoice;
        if ($invoice === null) {
            return response()->json([
                'message' => 'Receipt invoice not found.',
            ], 404);
        }
        if (strcasecmp((string) $invoice->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cannot email receipts for cancelled invoices.',
            ], 422);
        }

        $validated = $request->validate([
            'to_email' => ['nullable', 'string', 'max:255', 'email:rfc'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $toOverride = strtolower(trim((string) ($validated['to_email'] ?? '')));
        $toCustomer = strtolower(trim((string) ($invoice->customer?->email ?? '')));
        $toFallback = strtolower(trim((string) ($invoice->customer_email ?? '')));
        $email = $toOverride !== '' ? $toOverride : ($toCustomer !== '' ? $toCustomer : $toFallback);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'message' => 'The customer has no valid email address. Update the customer record, then try again.',
            ], 422);
        }

        $subjectOverride = isset($validated['subject']) ? trim((string) $validated['subject']) : null;
        $messageOverride = isset($validated['message']) ? (string) $validated['message'] : null;

        try {
            Mail::to($email)->send(new InvoicePaymentReceiptSentToCustomer($invoice, $pay, $subjectOverride, $messageOverride));
            $pay->sent_to_customer_at = now();
            $pay->save();
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not send the receipt email. Check mail configuration (MAIL_*) or try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Receipt sent to the customer.',
            'payment' => $this->serializePayment($pay->fresh()),
        ]);
    }

    public function emailPreview(Request $request, string $payment): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $pay = InvoicePayment::query()
            ->where('tenant_id', $tenant->id)
            ->with(['invoice.customer'])
            ->where('id', (int) $payment)
            ->firstOrFail();

        $invoice = $pay->invoice;
        if ($invoice === null) {
            return response()->json([
                'message' => 'Receipt invoice not found.',
            ], 404);
        }

        $html = View::make('mail.invoice-payment-receipt-sent', [
            'invoice' => $invoice,
            'payment' => $pay,
        ])->render();
        $toEmail = strtolower(trim((string) ($invoice->customer?->email ?? $invoice->customer_email ?? '')));
        $subject = 'Receipt '.trim((string) ($pay->receipt_ref ?? ''));
        if (trim((string) $invoice->invoice_ref) !== '') {
            $subject .= ' — Invoice '.trim((string) $invoice->invoice_ref);
        }
        if (trim((string) $invoice->customer_name) !== '') {
            $subject .= ' — '.trim((string) $invoice->customer_name);
        }

        return response()->json([
            'message' => 'Preview generated.',
            'subject' => $subject,
            'html' => $html,
            'to_email' => $toEmail,
            'message_template' => 'Please find your payment receipt details below.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializedInvoice(Request $request, int $invoiceId): array
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $fresh = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $invoiceId)
            ->with([
                'items' => fn ($q) => $q->orderBy('position'),
                'payments',
            ])
            ->firstOrFail();
        $fresh->syncStatusFromPaymentState();
        $fresh->refresh();

        return app(InvoiceController::class)->serializeInvoice($fresh);
    }

    private function resolveInvoice(Request $request, string $invoice): Invoice
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $q = Invoice::query()->where('tenant_id', $tenant->id);
        if (ctype_digit($invoice)) {
            return $q->where('id', (int) $invoice)->firstOrFail();
        }

        return $q->where('invoice_ref', $invoice)->firstOrFail();
    }

    private function resolvePayment(Invoice $invoice, string $paymentId): InvoicePayment
    {
        if (ctype_digit($paymentId)) {
            return InvoicePayment::query()
                ->where('tenant_id', $invoice->tenant_id)
                ->where('invoice_id', $invoice->id)
                ->where('id', (int) $paymentId)
                ->firstOrFail();
        }

        return InvoicePayment::query()
            ->where('tenant_id', $invoice->tenant_id)
            ->where('invoice_id', $invoice->id)
            ->where('receipt_ref', $paymentId)
            ->firstOrFail();
    }

    private function nextReceiptRef(int $tenantId): string
    {
        $last = InvoicePayment::query()
            ->where('tenant_id', $tenantId)
            ->where('receipt_ref', 'like', 'RCP-%')
            ->orderByDesc('id')
            ->value('receipt_ref');

        $n = 0;
        if (is_string($last) && preg_match('/^RCP-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'RCP-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePayment(InvoicePayment $p): array
    {
        $p->loadMissing('invoice');
        $inv = $p->invoice;

        return [
            'id' => $p->id,
            'invoice_id' => $p->invoice_id,
            'invoice_ref' => $inv?->invoice_ref,
            'customer_name' => $inv?->customer_name,
            'receipt_ref' => $p->receipt_ref,
            'amount' => $p->amount,
            'payment_method' => $p->payment_method,
            'paid_at' => $p->paid_at ? $p->paid_at->toISOString() : null,
            'notes' => $p->notes,
            'transaction_id' => $p->transaction_id,
            'sent_to_customer_at' => $p->sent_to_customer_at ? $p->sent_to_customer_at->toISOString() : null,
            'created_at' => $p->created_at ? $p->created_at->toISOString() : null,
            'updated_at' => $p->updated_at ? $p->updated_at->toISOString() : null,
            'invoice_issued_at' => $inv?->issued_at ? $inv->issued_at->toISOString() : null,
            'invoice_total_amount' => $inv !== null ? (float) $inv->total_amount : null,
            'invoice_amount_paid' => $inv !== null ? (float) $inv->amount_paid : null,
            'invoice_status' => $inv?->status,
        ];
    }
}
