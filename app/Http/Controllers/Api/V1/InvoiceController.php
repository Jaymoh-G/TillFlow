<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\InvoiceSentToCustomer;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Product;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $invoices = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->with(['items' => fn ($q) => $q->orderBy('position'), 'customer'])
            ->withCount('payments')
            ->get();

        foreach ($invoices as $inv) {
            $inv->syncStatusFromPaymentState();
        }

        return response()->json([
            'message' => 'Invoices retrieved.',
            'invoices' => $invoices->map(fn (Invoice $i) => $this->serializeInvoice($i))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'issued_at' => ['required', 'date'],
            'due_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'customer_id' => [
                'required',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'invoice_ref' => [
                'nullable',
                'string',
                'max:32',
                Rule::unique('invoices', 'invoice_ref')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'invoice_title' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(array_merge(
                array_values(array_diff(Invoice::STATUSES, [Invoice::STATUS_CANCELLED])),
                ['Sent']
            ))],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'initial_payment_method' => ['nullable', 'string', Rule::in([
                InvoicePayment::METHOD_CASH,
                InvoicePayment::METHOD_BANK_TRANSFER,
                InvoicePayment::METHOD_MPESA,
                InvoicePayment::METHOD_CARD,
                InvoicePayment::METHOD_CHEQUE,
                InvoicePayment::METHOD_OTHER,
            ])],
            'notes' => ['nullable', 'string', 'max:20000'],
            'terms_and_conditions' => ['nullable', 'string', 'max:20000'],

            'discount_type' => ['nullable', 'string', Rule::in(['none', 'before_tax', 'after_tax'])],
            'discount_basis' => ['nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'items.*.product_name' => ['nullable', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:20000'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        [$discType, $discBasis, $discVal] = $this->normalizeDiscountFields(
            $validated['discount_type'] ?? 'none',
            $validated['discount_basis'] ?? 'percent',
            $validated['discount_value'] ?? null
        );

        $customer = $this->resolveCustomer($tenant->id, (int) $validated['customer_id']);

        $status = $validated['status'] ?? Invoice::STATUS_DRAFT;
        if (strcasecmp((string) $status, 'Sent') === 0) {
            $status = Invoice::STATUS_UNPAID;
        }
        if (! in_array($status, Invoice::STATUSES, true)) {
            $status = Invoice::STATUS_DRAFT;
        }

        $isDraftCreate = strcasecmp((string) $status, Invoice::STATUS_DRAFT) === 0;
        $invoiceRef = $isDraftCreate
            ? null
            : ($validated['invoice_ref'] ?? $this->nextInvoiceRef($tenant->id));

        $amountPaidInput = round((float) ($validated['amount_paid'] ?? 0), 2);
        if ($amountPaidInput < 0) {
            $amountPaidInput = 0;
        }
        $totalPreview = (float) $this->buildInvoiceItemRows($tenant, $validated['items'], $discType, $discBasis, $discVal)['total'];
        if ($amountPaidInput - $totalPreview > 0.01) {
            return response()->json([
                'message' => 'Amount paid cannot exceed invoice total.',
            ], 422);
        }

        $initialMethod = $validated['initial_payment_method'] ?? InvoicePayment::METHOD_CASH;

        $invoice = DB::transaction(function () use (
            $tenant,
            $validated,
            $invoiceRef,
            $customer,
            $status,
            $amountPaidInput,
            $discType,
            $discBasis,
            $discVal,
            $initialMethod
        ) {
            $built = $this->buildInvoiceItemRows($tenant, $validated['items'], $discType, $discBasis, $discVal);

            $invoiceTitle = isset($validated['invoice_title']) ? trim((string) $validated['invoice_title']) : '';
            $invoiceTitle = $invoiceTitle !== '' ? $invoiceTitle : null;

            $invoice = Invoice::query()->create([
                'tenant_id' => $tenant->id,
                'invoice_ref' => $invoiceRef,
                'invoice_title' => $invoiceTitle,
                'issued_at' => $validated['issued_at'],
                'due_at' => $validated['due_at'] ?? null,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_image_url' => $customer->avatar_url,
                'status' => $status,
                'sent_to_customer_at' => null,
                'discount_type' => $discType,
                'discount_basis' => $discBasis,
                'discount_value' => $discVal,
                'total_amount' => $built['total'],
                'amount_paid' => '0.00',
                'notes' => $validated['notes'] ?? null,
                'terms_and_conditions' => $validated['terms_and_conditions'] ?? null,
            ]);

            foreach ($built['rows'] as $row) {
                $invoice->items()->create($row);
            }

            if ($amountPaidInput > 0.01) {
                InvoicePayment::query()->create([
                    'tenant_id' => $tenant->id,
                    'invoice_id' => $invoice->id,
                    'receipt_ref' => $this->nextReceiptRef($tenant->id),
                    'amount' => number_format($amountPaidInput, 2, '.', ''),
                    'payment_method' => $initialMethod,
                    'paid_at' => now(),
                    'notes' => null,
                ]);
            }

            $invoice->refresh();
            $invoice->recalculateAmountPaidAndStatus();

            return $invoice->load([
                'items' => fn ($q) => $q->orderBy('position'),
                'payments',
            ]);
        });

        return response()->json([
            'message' => 'Invoice created.',
            'invoice' => $this->serializeInvoice($invoice),
        ], 201);
    }

    public function show(Request $request, string $invoice): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);
        $model->load([
            'items' => fn ($q) => $q->orderBy('position'),
            'payments',
            'customer',
        ]);
        $model->syncStatusFromPaymentState();
        $model->refresh();

        return response()->json([
            'message' => 'Invoice retrieved.',
            'invoice' => $this->serializeInvoice($model),
        ]);
    }

    public function update(Request $request, string $invoice): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = $this->resolveInvoice($request, $invoice);

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cancelled invoices cannot be modified.',
            ], 422);
        }

        $validated = $request->validate([
            'issued_at' => ['nullable', 'date'],
            'due_at' => ['nullable', 'date'],
            'invoice_title' => ['nullable', 'string', 'max:255'],
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'status' => ['nullable', 'string', Rule::in(array_merge(Invoice::STATUSES, ['Sent']))],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:20000'],
            'terms_and_conditions' => ['nullable', 'string', 'max:20000'],

            'discount_type' => ['nullable', 'string', Rule::in(['none', 'before_tax', 'after_tax'])],
            'discount_basis' => ['nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],

            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'items.*.product_name' => ['nullable', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:20000'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0.001'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $model->loadCount('payments');
        $hasPayments = ((int) ($model->payments_count ?? 0)) > 0;

        $issuedAt = $validated['issued_at'] ?? ($model->issued_at ? $model->issued_at->format('Y-m-d') : null);
        $dueAt = array_key_exists('due_at', $validated)
            ? ($validated['due_at'] ?? null)
            : ($model->due_at ? $model->due_at->format('Y-m-d') : null);
        if (is_string($issuedAt) && is_string($dueAt) && $dueAt < $issuedAt) {
            return response()->json([
                'message' => 'Due date cannot be before the issue date.',
            ], 422);
        }

        $discType = $validated['discount_type'] ?? ($model->discount_type ?? 'none');
        $discBasis = $validated['discount_basis'] ?? ($model->discount_basis ?? 'percent');
        $discVal = array_key_exists('discount_value', $validated) ? $validated['discount_value'] : $model->discount_value;
        [$discType, $discBasis, $discVal] = $this->normalizeDiscountFields($discType, $discBasis, $discVal);

        $customer = null;
        if (array_key_exists('customer_id', $validated) && $validated['customer_id'] !== null) {
            $customer = $this->resolveCustomer($tenant->id, (int) $validated['customer_id']);
        }

        $amountPaid = array_key_exists('amount_paid', $validated) ? (float) ($validated['amount_paid'] ?? 0) : (float) ($model->amount_paid ?? 0);
        if ($amountPaid < 0) {
            $amountPaid = 0;
        }

        $invoiceOut = DB::transaction(function () use (
            $tenant,
            $model,
            $validated,
            $issuedAt,
            $dueAt,
            $customer,
            $amountPaid,
            $discType,
            $discBasis,
            $discVal,
            $hasPayments
        ) {
            $update = [
                'issued_at' => $issuedAt,
                'due_at' => $dueAt,
                'discount_type' => $discType,
                'discount_basis' => $discBasis,
                'discount_value' => $discVal,
            ];

            if (! $hasPayments) {
                $update['amount_paid'] = $amountPaid;
            }

            if (array_key_exists('status', $validated) && $validated['status'] !== null) {
                $st = $validated['status'];
                if (strcasecmp($st, Invoice::STATUS_CANCELLED) === 0) {
                    throw new HttpResponseException(response()->json([
                        'message' => 'Use POST /invoices/{id}/cancel to cancel an invoice.',
                    ], 422));
                }
                if (strcasecmp((string) $st, 'Sent') === 0) {
                    $st = Invoice::STATUS_UNPAID;
                }
                if (in_array($st, Invoice::STATUSES, true)) {
                    $update['status'] = $st;
                }
            }
            if (array_key_exists('notes', $validated)) {
                $update['notes'] = $validated['notes'] ?? null;
            }
            if (array_key_exists('terms_and_conditions', $validated)) {
                $update['terms_and_conditions'] = $validated['terms_and_conditions'] ?? null;
            }
            if (array_key_exists('invoice_title', $validated)) {
                $t = isset($validated['invoice_title']) ? trim((string) $validated['invoice_title']) : '';
                $update['invoice_title'] = $t !== '' ? $t : null;
            }
            if ($customer) {
                $update['customer_id'] = $customer->id;
                $update['customer_name'] = $customer->name;
                $update['customer_image_url'] = $customer->avatar_url;
            }

            if (array_key_exists('items', $validated) && is_array($validated['items'])) {
                $built = $this->buildInvoiceItemRows($tenant, $validated['items'], $discType, $discBasis, $discVal);
                $update['total_amount'] = $built['total'];

                $newTotal = round((float) $built['total'], 2);
                $sumPay = round((float) $model->payments()->sum('amount'), 2);
                if ($sumPay - $newTotal > 0.01) {
                    throw new HttpResponseException(response()->json([
                        'message' => 'Invoice total cannot be less than the sum of recorded payments.',
                    ], 422));
                }

                $model->items()->delete();
                foreach ($built['rows'] as $row) {
                    $model->items()->create($row);
                }
            }

            $wasDraft = strcasecmp((string) $model->status, Invoice::STATUS_DRAFT) === 0;
            $newStatus = $update['status'] ?? $model->status;
            $leavingDraft = $wasDraft
                && is_string($newStatus)
                && strcasecmp($newStatus, Invoice::STATUS_DRAFT) !== 0
                && strcasecmp($newStatus, Invoice::STATUS_CANCELLED) !== 0;
            if ($leavingDraft) {
                $model->ensureIssuedInvoiceRef(fn () => $this->nextInvoiceRef($tenant->id));
                $update['invoice_ref'] = $model->invoice_ref;
            }

            $model->fill($update)->save();

            if (! $hasPayments) {
                $t = round((float) $model->total_amount, 2);
                $p = round((float) $model->amount_paid, 2);
                if ($p - $t > 0.01) {
                    throw new HttpResponseException(response()->json([
                        'message' => 'Amount paid cannot exceed invoice total.',
                    ], 422));
                }
            }

            if ($hasPayments) {
                $model->recalculateAmountPaidAndStatus();
            } else {
                $model->syncStatusFromPaymentState();
            }

            return $model->load([
                'items' => fn ($q) => $q->orderBy('position'),
                'payments',
            ]);
        });

        return response()->json([
            'message' => 'Invoice updated.',
            'invoice' => $this->serializeInvoice($invoiceOut),
        ]);
    }

    /**
     * Issue a draft invoice: assign invoice number if needed, set status to Unpaid, email the customer.
     */
    public function sendToCustomer(Request $request, string $invoice): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveInvoice($request, $invoice);

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cancelled invoices cannot be emailed.',
            ], 422);
        }

        $isDraft = strcasecmp((string) $model->status, Invoice::STATUS_DRAFT) === 0;

        $validated = $request->validate([
            /** Optional client-generated PDF (same pipeline as modal PDF); falls back to server Dompdf. */
            'attachment_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:20480'],
            'to_email' => ['nullable', 'string', 'max:255', 'email:rfc'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $model->load('customer');
        $toOverride = strtolower(trim((string) ($validated['to_email'] ?? '')));
        $toCustomer = strtolower(trim((string) ($model->customer?->email ?? '')));
        $email = $toOverride !== '' ? $toOverride : $toCustomer;
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'message' => 'The customer has no valid email address. Update the customer record, then try again.',
            ], 422);
        }

        $subjectOverride = isset($validated['subject']) ? trim((string) $validated['subject']) : null;
        $messageOverride = isset($validated['message']) ? (string) $validated['message'] : null;

        try {
            if ($isDraft) {
                // Commit Draft → Unpaid (and invoice ref) before building mail/PDF so status is persisted while email sends.
                DB::transaction(function () use ($tenant, $model): void {
                    $model->ensureIssuedInvoiceRef(fn () => $this->nextInvoiceRef($tenant->id));
                    $model->status = Invoice::STATUS_UNPAID;
                    $model->save();
                    $model->syncStatusFromPaymentState();
                });

                $fresh = $model->fresh([
                    'items' => fn ($q) => $q->orderBy('position'),
                    'payments',
                    'customer',
                ]);
                if ($fresh === null) {
                    return response()->json([
                        'message' => 'Invoice could not be reloaded after issue.',
                    ], 500);
                }

                $pdfBinary = $this->resolveInvoiceEmailPdfAttachment($request, $tenant, $fresh, true);
                $pdfFilename = $this->invoicePdfAttachmentFilename($fresh);
                Mail::to($email)->send(new InvoiceSentToCustomer($fresh, $pdfBinary, $pdfFilename, $subjectOverride, $messageOverride));

                $fresh->sent_to_customer_at = now();
                $fresh->save();

                $out = $fresh->fresh([
                    'items' => fn ($q) => $q->orderBy('position'),
                    'payments',
                    'customer',
                ]);
            } else {
                $out = DB::transaction(function () use ($request, $tenant, $model, $email, $subjectOverride, $messageOverride): Invoice {
                    $model->load([
                        'items' => fn ($q) => $q->orderBy('position'),
                        'payments',
                        'customer',
                    ]);
                    $pdfBinary = $this->resolveInvoiceEmailPdfAttachment($request, $tenant, $model, false);
                    $pdfFilename = $this->invoicePdfAttachmentFilename($model);
                    Mail::to($email)->send(new InvoiceSentToCustomer($model, $pdfBinary, $pdfFilename, $subjectOverride, $messageOverride));
                    $model->sent_to_customer_at = now();
                    $model->save();

                    return $model->fresh([
                        'items' => fn ($q) => $q->orderBy('position'),
                        'payments',
                        'customer',
                    ]);
                });
            }
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not send the invoice email. Check mail configuration (MAIL_*) or try again.',
            ], 500);
        }

        return response()->json([
            'message' => $isDraft ? 'Invoice sent to the customer.' : 'Invoice email resent to the customer.',
            'invoice' => $this->serializeInvoice($out),
        ]);
    }

    /**
     * Render the same HTML body as the customer email (for UI preview before send).
     */
    public function emailPreview(Request $request, string $invoice): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Cancelled invoices cannot be previewed.',
            ], 422);
        }

        $model->loadMissing('customer');

        $html = View::make('mail.invoice-sent', ['invoice' => $model])->render();
        $ref = trim((string) $model->invoice_ref);
        $subject = ($ref !== '' ? 'Invoice '.$ref : 'Invoice (draft)').' — '.$model->customer_name;
        $toEmail = strtolower(trim((string) ($model->customer?->email ?? '')));
        $messageTemplate = 'Please find your invoice below.';

        return response()->json([
            'message' => 'Preview generated.',
            'subject' => $subject,
            'html' => $html,
            'to_email' => $toEmail,
            'message_template' => $messageTemplate,
        ]);
    }

    public function cancel(Request $request, string $invoice): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);
        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json([
                'message' => 'Invoice is already cancelled.',
            ], 422);
        }

        if (strcasecmp((string) $model->status, Invoice::STATUS_DRAFT) === 0) {
            return response()->json([
                'message' => 'Draft invoices cannot be cancelled.',
            ], 422);
        }

        $model->status = Invoice::STATUS_CANCELLED;
        $model->save();
        $model->load([
            'items' => fn ($q) => $q->orderBy('position'),
            'payments',
        ]);

        return response()->json([
            'message' => 'Invoice cancelled.',
            'invoice' => $this->serializeInvoice($model),
        ]);
    }

    public function restore(Request $request, string $invoice): JsonResponse
    {
        $model = $this->resolveInvoice($request, $invoice);

        if (strcasecmp((string) $model->status, Invoice::STATUS_CANCELLED) !== 0) {
            return response()->json([
                'message' => 'Only cancelled invoices can be restored.',
            ], 422);
        }

        $model->restoreFromCancelled();
        $model->load([
            'items' => fn ($q) => $q->orderBy('position'),
            'payments',
            'customer',
        ]);

        return response()->json([
            'message' => 'Invoice restored.',
            'invoice' => $this->serializeInvoice($model),
        ]);
    }

    public function destroy(Request $request, string $invoice): JsonResponse
    {
        return response()->json([
            'message' => 'Invoices cannot be deleted. Cancel the invoice instead.',
        ], 422);
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

    private function resolveCustomer(int $tenantId, int $id): Customer
    {
        return Customer::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->where('id', $id)
            ->firstOrFail();
    }

    private function resolveProductOrNull(int $tenantId, ?int $id): ?Product
    {
        if (! $id) {
            return null;
        }

        return Product::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->where('id', $id)
            ->first();
    }

    /**
     * @param  array<int, mixed>  $items
     * @return array{rows: array<int, array<string, mixed>>, total: string, subtotal_ex_tax: string, tax_total: string, discount_amount: string}
     */
    private function buildInvoiceItemRows(Tenant $tenant, array $items, string $discType, string $discBasis, ?float $discVal): array
    {
        $rows = [];

        $subtotalExTax = 0.0;
        $taxTotal = 0.0;

        foreach (array_values($items) as $idx => $item) {
            $productId = isset($item['product_id']) ? (int) $item['product_id'] : null;
            $product = $this->resolveProductOrNull($tenant->id, $productId);

            $name = is_string($item['product_name'] ?? null) ? trim((string) $item['product_name']) : '';
            if ($name === '' && $product) {
                $name = (string) $product->name;
            }
            if ($name === '') {
                $name = 'Item';
            }

            $qty = (float) ($item['quantity'] ?? 0);
            if ($qty <= 0) {
                $qty = 1;
            }

            $unitPrice = (float) ($item['unit_price'] ?? 0);
            if ($unitPrice < 0) {
                $unitPrice = 0;
            }

            $taxPercent = (float) ($item['tax_percent'] ?? 0);
            if ($taxPercent < 0) {
                $taxPercent = 0;
            }
            if ($taxPercent > 100) {
                $taxPercent = 100;
            }

            $lineSubEx = $qty * $unitPrice;
            $lineTax = $lineSubEx * ($taxPercent / 100.0);
            $lineTotal = $lineSubEx + $lineTax;

            $subtotalExTax += $lineSubEx;
            $taxTotal += $lineTax;

            $rows[] = [
                'product_id' => $product ? $product->id : null,
                'product_name' => $name,
                'product_image_url' => $product ? $product->image_url : null,
                'description' => is_string($item['description'] ?? null) ? $item['description'] : null,
                'quantity' => number_format($qty, 3, '.', ''),
                'unit_price' => number_format($unitPrice, 2, '.', ''),
                'tax_percent' => number_format($taxPercent, 2, '.', ''),
                'line_total' => number_format($lineTotal, 2, '.', ''),
                'position' => $idx,
            ];
        }

        $discountAmount = $this->computeDiscountAmount($discType, $discBasis, $discVal, $subtotalExTax, $subtotalExTax + $taxTotal);
        $grand = max(0.0, ($subtotalExTax + $taxTotal) - $discountAmount);

        return [
            'rows' => $rows,
            'subtotal_ex_tax' => number_format($subtotalExTax, 2, '.', ''),
            'tax_total' => number_format($taxTotal, 2, '.', ''),
            'discount_amount' => number_format($discountAmount, 2, '.', ''),
            'total' => number_format($grand, 2, '.', ''),
        ];
    }

    private function computeDiscountAmount(string $type, string $basis, ?float $value, float $subtotalExTax, float $totalIncTax): float
    {
        if ($type === 'none' || $value === null) {
            return 0.0;
        }

        $base = $type === 'before_tax' ? $subtotalExTax : $totalIncTax;
        $base = max(0.0, $base);
        if ($base <= 0) {
            return 0.0;
        }

        $value = max(0.0, (float) $value);
        if ($basis === 'fixed') {
            return min($base, $value);
        }

        $pct = min(100.0, $value);

        return ($base * $pct) / 100.0;
    }

    /**
     * @return array{0: string, 1: string, 2: ?float}
     */
    private function normalizeDiscountFields(string $type, string $basis, mixed $value): array
    {
        $type = in_array($type, ['none', 'before_tax', 'after_tax'], true) ? $type : 'none';
        $basis = in_array($basis, ['percent', 'fixed'], true) ? $basis : 'percent';

        $val = null;
        if ($value !== null && $value !== '') {
            $val = (float) $value;
            if ($val < 0) {
                $val = 0;
            }
            if ($basis === 'percent') {
                $val = min(100.0, $val);
            }
        }

        if ($type === 'none') {
            $val = null;
        }

        return [$type, $basis, $val];
    }

    private function nextInvoiceRef(int $tenantId): string
    {
        // Pattern: INV-000001 (per tenant). Drafts do not consume refs (invoice_ref null).
        // Only consider issued rows so legacy INV-* drafts cannot inflate the sequence.
        $last = Invoice::query()
            ->where('tenant_id', $tenantId)
            ->where('invoice_ref', 'like', 'INV-%')
            ->where('status', '<>', Invoice::STATUS_DRAFT)
            ->orderByDesc('id')
            ->value('invoice_ref');

        $n = 0;
        if (is_string($last) && preg_match('/^INV-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        $next = $n + 1;

        return 'INV-'.str_pad((string) $next, 6, '0', STR_PAD_LEFT);
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

    private function resolveInvoiceEmailPdfAttachment(Request $request, Tenant $tenant, Invoice $inv, bool $forceServer): string
    {
        if (! $forceServer) {
            $upload = $request->file('attachment_pdf');
            if ($upload !== null && $upload->isValid()) {
                $bytes = @file_get_contents($upload->getRealPath());
                if (is_string($bytes) && str_starts_with($bytes, '%PDF')) {
                    return $bytes;
                }
            }
        }

        return $this->buildInvoicePdfBinary($tenant, $inv);
    }

    private function invoicePdfAttachmentFilename(Invoice $inv): string
    {
        $ref = preg_replace('/[^\w.-]+/', '_', (string) $inv->invoice_ref) ?: 'invoice';

        return 'invoice-'.$ref.'.pdf';
    }

    /**
     * @return array{rows: list<array<string, mixed>>, subEx: float, taxAmt: float, discountAmt: float, discountLabel: string, grandTotal: float, dtype: string}
     */
    private function invoicePdfViewModel(Invoice $inv): array
    {
        $inv->loadMissing(['items' => fn ($q) => $q->orderBy('position')]);
        $items = $inv->items;
        $rows = [];
        if ($items->isEmpty()) {
            $total = (float) $inv->total_amount;
            $title = trim((string) ($inv->invoice_title ?? ''));
            if ($title === '') {
                $title = '—';
            }
            $rows[] = [
                'title' => $title,
                'desc' => '',
                'qty' => 1.0,
                'unit' => $total,
                'lineTotal' => $total,
                'taxP' => 0.0,
            ];
        } else {
            foreach ($items as $item) {
                $qty = (float) ($item->quantity ?? 1);
                $unit = (float) ($item->unit_price ?? 0);
                $taxP = (float) ($item->tax_percent ?? 0);
                if ($taxP < 0 || ! is_finite($taxP)) {
                    $taxP = 0.0;
                }
                $sub = round($qty * $unit, 2);
                $lt = $item->line_total !== null
                    ? (float) $item->line_total
                    : round($sub * (1 + $taxP / 100), 2);
                $rows[] = [
                    'title' => (string) ($item->product_name ?? '—'),
                    'desc' => trim((string) ($item->description ?? '')),
                    'qty' => $qty,
                    'unit' => $unit,
                    'lineTotal' => $lt,
                    'taxP' => $taxP,
                ];
            }
        }
        $subEx = 0.0;
        $taxAmt = 0.0;
        foreach ($rows as $r) {
            $sub = round($r['qty'] * $r['unit'], 2);
            $subEx += $sub;
            $taxAmt += round(max(0.0, $r['lineTotal'] - $sub), 2);
        }
        $subEx = round($subEx, 2);
        $taxAmt = round($taxAmt, 2);
        [$dtype, $basis, $val] = $this->normalizeDiscountFields(
            (string) ($inv->discount_type ?? 'none'),
            (string) ($inv->discount_basis ?? 'percent'),
            $inv->discount_value
        );
        $discountAmt = $this->computeDiscountAmount($dtype, $basis, $val, $subEx, $subEx + $taxAmt);
        $discountLabel = 'Discount';
        if ($dtype !== 'none') {
            if ($basis === 'fixed') {
                $discountLabel = 'Discount';
            } else {
                $p = min(100.0, max(0.0, (float) ($val ?? 0)));
                $discountLabel = 'Discount ('.number_format($p, 2).'%)';
            }
        }
        $grandTotal = round((float) $inv->total_amount, 2);

        return [
            'rows' => $rows,
            'subEx' => $subEx,
            'taxAmt' => $taxAmt,
            'discountAmt' => round($discountAmt, 2),
            'discountLabel' => $discountLabel,
            'grandTotal' => $grandTotal,
            'dtype' => $dtype,
        ];
    }

    private function buildInvoicePdfBinary(Tenant $tenant, Invoice $inv): string
    {
        $tenant = $tenant->fresh();
        $vm = $this->invoicePdfViewModel($inv);
        $inv->loadMissing('customer');
        $customer = $inv->customer;
        $issuedAt = $inv->issued_at ? $inv->issued_at->format('j M Y') : '—';
        $dueAt = $inv->due_at ? $inv->due_at->format('j M Y') : '—';

        $companyName = trim((string) ($tenant->name ?? ''));
        $companyAddr = trim((string) ($tenant->company_address_line ?? ''));
        $companyWebsite = trim((string) ($tenant->company_website ?? ''));
        $companyWebsiteHref = '';
        if ($companyWebsite !== '') {
            $companyWebsiteHref = preg_match('#^https?://#i', $companyWebsite) ? $companyWebsite : 'https://'.$companyWebsite;
        }
        $companyEmail = trim((string) ($tenant->company_email ?? ''));
        $companyPhone = trim((string) ($tenant->company_phone ?? ''));

        $customerEmail = ($customer && trim((string) ($customer->email ?? '')) !== '')
            ? trim((string) $customer->email) : '';
        $customerPhone = ($customer && trim((string) ($customer->phone ?? '')) !== '')
            ? trim((string) $customer->phone) : '';
        $customerAddr = ($customer && trim((string) ($customer->location ?? '')) !== '')
            ? trim((string) $customer->location) : '';

        $footer = $this->resolveInvoiceFooterLines($tenant);
        $companyLogoSrc = $this->resolveInvoicePdfCompanyLogoSrc($tenant);

        $html = view('pdf.invoice-detail', [
            'inv' => $inv,
            'vm' => $vm,
            'issuedAt' => $issuedAt,
            'dueAt' => $dueAt,
            'companyName' => $companyName,
            'companyAddr' => $companyAddr,
            'companyWebsite' => $companyWebsite,
            'companyWebsiteHref' => $companyWebsiteHref,
            'companyLogoSrc' => $companyLogoSrc,
            'companyEmail' => $companyEmail,
            'companyPhone' => $companyPhone,
            'customerEmail' => $customerEmail,
            'customerPhone' => $customerPhone,
            'customerAddr' => $customerAddr,
            'footerPayment' => $footer['payment'],
            'footerBank' => $footer['bank'],
            'footerClosing' => $footer['closing'],
        ])->render();

        $chroot = realpath(public_path()) ?: public_path();

        return Pdf::loadHTML($html)
            ->setPaper('a4')
            ->setOptions([
                'isRemoteEnabled' => true,
                'isHtml5ParserEnabled' => true,
                'chroot' => $chroot,
            ])
            ->output();
    }

    /**
     * Logo for Dompdf: prefer data URI from public disk; else absolute URL (requires isRemoteEnabled).
     */
    private function resolveInvoicePdfCompanyLogoSrc(Tenant $tenant): ?string
    {
        $raw = Arr::get($tenant->ui_settings ?? [], 'website.companyLogos.logo');
        if (! is_string($raw)) {
            return null;
        }
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }
        if (str_starts_with($raw, 'data:image')) {
            return $raw;
        }
        $baseUrl = rtrim((string) config('app.url'), '/');
        if (preg_match('#^https?://#i', $raw)) {
            return $this->invoicePdfLogoUrlToDataUri($raw) ?? $raw;
        }
        if (str_starts_with($raw, '//')) {
            $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
            $url = $scheme.':'.$raw;

            return $this->invoicePdfLogoUrlToDataUri($url) ?? $url;
        }
        $pathPart = str_starts_with($raw, '/') ? $raw : '/'.$raw;
        $publicFile = public_path(ltrim($pathPart, '/'));
        if (is_file($publicFile) && is_readable($publicFile)) {
            return $this->invoicePdfFileToDataUri($publicFile);
        }

        $absolute = $baseUrl.$pathPart;

        return $this->invoicePdfLogoUrlToDataUri($absolute) ?? $absolute;
    }

    private function invoicePdfFileToDataUri(string $path): ?string
    {
        try {
            $bin = @file_get_contents($path);
            if ($bin === false || $bin === '') {
                return null;
            }
            $mime = @mime_content_type($path) ?: 'image/png';
            if (! is_string($mime) || $mime === '') {
                $mime = 'image/png';
            }

            return 'data:'.$mime.';base64,'.base64_encode($bin);
        } catch (\Throwable) {
            return null;
        }
    }

    private function invoicePdfLogoUrlToDataUri(string $url): ?string
    {
        try {
            $ctx = stream_context_create([
                'http' => ['timeout' => 8],
                'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
            ]);
            $bin = @file_get_contents($url, false, $ctx);
            if ($bin === false || $bin === '') {
                return null;
            }
            $mime = 'image/png';
            $lower = strtolower($url);
            if (str_contains($lower, '.jpg') || str_contains($lower, '.jpeg')) {
                $mime = 'image/jpeg';
            } elseif (str_contains($lower, '.gif')) {
                $mime = 'image/gif';
            } elseif (str_contains($lower, '.webp')) {
                $mime = 'image/webp';
            } elseif (str_contains($lower, '.svg')) {
                $mime = 'image/svg+xml';
            }

            return 'data:'.$mime.';base64,'.base64_encode($bin);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array{payment: string, bank: string, closing: string}
     */
    private function resolveInvoiceFooterLines(Tenant $tenant): array
    {
        $defaults = [
            'payment' => 'Cheque to: Breezetech Management Systems Ltd',
            'bank' => 'Bank transfer to: Acc: 1286283051 · Bank: KCB Bank · SWIFT/BIC code: KCBLKENXXX · Bank code is 01',
            'closing' => 'Thank you for your business.',
        ];
        if (! Schema::hasColumn('tenants', 'quotation_footer_payment_line')) {
            return $defaults;
        }
        $pay = trim((string) ($tenant->quotation_footer_payment_line ?? ''));
        $bank = trim((string) ($tenant->quotation_footer_bank_line ?? ''));
        $close = trim((string) ($tenant->quotation_footer_closing_line ?? ''));

        return [
            'payment' => $pay !== '' ? $pay : $defaults['payment'],
            'bank' => $bank !== '' ? $bank : $defaults['bank'],
            'closing' => $close !== '' ? $close : $defaults['closing'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeInvoice(Invoice $i): array
    {
        $deliveredByItem = [];
        if ($i->relationLoaded('items') && $i->items->isNotEmpty()) {
            $itemIds = $i->items->pluck('id')->values()->all();
            $deliveredByItem = DB::table('delivery_note_items as dni')
                ->join('delivery_notes as dn', 'dn.id', '=', 'dni.delivery_note_id')
                ->select('dni.invoice_item_id', DB::raw('SUM(dni.qty) as delivered_qty'))
                ->where('dn.tenant_id', $i->tenant_id)
                ->where('dn.invoice_id', $i->id)
                ->where('dn.status', '!=', Invoice::STATUS_CANCELLED)
                ->whereIn('dni.invoice_item_id', $itemIds)
                ->groupBy('dni.invoice_item_id')
                ->pluck('delivered_qty', 'dni.invoice_item_id')
                ->all();
        }

        $payments = [];
        if ($i->relationLoaded('payments')) {
            $payments = $i->payments->map(fn ($p) => [
                'id' => $p->id,
                'receipt_ref' => $p->receipt_ref,
                'amount' => $p->amount,
                'payment_method' => $p->payment_method,
                'paid_at' => $p->paid_at ? $p->paid_at->toISOString() : null,
                'notes' => $p->notes,
                'transaction_id' => $p->transaction_id,
                'sent_to_customer_at' => $p->sent_to_customer_at ? $p->sent_to_customer_at->toISOString() : null,
            ])->values()->all();
        }

        return [
            'id' => $i->id,
            'invoice_ref' => $i->invoice_ref,
            'invoice_title' => $i->invoice_title,
            'issued_at' => $i->issued_at ? $i->issued_at->format('Y-m-d') : null,
            'due_at' => $i->due_at ? $i->due_at->format('Y-m-d') : null,
            'customer_id' => $i->customer_id,
            'customer_name' => $i->customer_name,
            'customer_email' => $i->relationLoaded('customer') && $i->customer ? $i->customer->email : null,
            'customer_image_url' => $i->customer_image_url,
            'status' => $i->status,
            'sent_to_customer_at' => $i->sent_to_customer_at ? $i->sent_to_customer_at->toISOString() : null,
            'discount_type' => $i->discount_type,
            'discount_basis' => $i->discount_basis,
            'discount_value' => $i->discount_value,
            'total_amount' => $i->total_amount,
            'amount_paid' => $i->amount_paid,
            'notes' => $i->notes,
            'terms_and_conditions' => $i->terms_and_conditions,
            'items' => $i->relationLoaded('items')
                ? $i->items->map(fn ($row) => [
                    'id' => $row->id,
                    'product_id' => $row->product_id,
                    'product_name' => $row->product_name,
                    'product_image_url' => $row->product_image_url,
                    'description' => $row->description,
                    'quantity' => $row->quantity,
                    'delivered_qty' => number_format(max(0, (float) ($deliveredByItem[$row->id] ?? 0)), 3, '.', ''),
                    'remaining_qty' => number_format(max(0, (float) $row->quantity - (float) ($deliveredByItem[$row->id] ?? 0)), 3, '.', ''),
                    'unit_price' => $row->unit_price,
                    'tax_percent' => $row->tax_percent,
                    'line_total' => $row->line_total,
                    'position' => $row->position,
                ])->values()->all()
                : [],
            'payments' => $payments,
            'payment_count' => $i->relationLoaded('payments')
                ? $i->payments->count()
                : (int) ($i->payments_count ?? 0),
            'created_at' => $i->created_at ? $i->created_at->toISOString() : null,
            'updated_at' => $i->updated_at ? $i->updated_at->toISOString() : null,
        ];
    }
}
