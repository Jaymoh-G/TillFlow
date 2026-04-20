<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Biller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Tenant;
use App\Services\ActivityLogWriter;
use App\Services\QuotationToInvoiceService;
use App\Services\SalesDocumentLinesService;
use App\Services\SalesDocumentPdfService;
use App\Support\ActivityLogProperties;
use App\Support\CustomerViewUrl;
use App\Support\TenantAutomationSettings;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuotationController extends Controller
{
    public function __construct(
        private readonly SalesDocumentLinesService $lines,
        private readonly SalesDocumentPdfService $pdfService,
        private readonly QuotationToInvoiceService $quotationToInvoice,
        private readonly ActivityLogWriter $activityLogWriter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $quotations = Quotation::query()
            ->where('tenant_id', $tenant->id)
            ->with(['items' => fn ($q) => $q->orderBy('position')])
            ->orderByDesc('quoted_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Quotations retrieved.',
            'quotations' => $quotations->map(fn (Quotation $q) => $this->serializeQuotation($q))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'quoted_at' => ['required', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:quoted_at'],
            'customer_id' => [
                'required',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'status' => ['required', 'string', Rule::in(['Draft', 'Sent', 'Expired', 'Declined', 'Accepted'])],
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
            'quote_ref' => [
                'nullable',
                'string',
                'max:32',
                Rule::unique('quotations', 'quote_ref')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'client_note' => ['nullable', 'string', 'max:20000'],
            'terms_and_conditions' => ['nullable', 'string', 'max:20000'],
            'quote_title' => ['nullable', 'string', 'max:500'],
            'biller_id' => [
                'nullable',
                'integer',
                Rule::exists('billers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'discount_type' => ['nullable', 'string', Rule::in(['none', 'before_tax', 'after_tax'])],
            'discount_basis' => ['nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        [$discType, $discBasis, $discVal] = $this->lines->normalizeDiscountFields(
            $validated['discount_type'] ?? 'none',
            $validated['discount_basis'] ?? 'percent',
            $validated['discount_value'] ?? null
        );

        $quoteRef = $validated['quote_ref'] ?? $this->nextQuoteRef($tenant->id);
        $customer = $this->resolveCustomer($tenant->id, (int) $validated['customer_id']);
        $billerPayload = $this->resolveBillerPayload($tenant->id, $validated['biller_id'] ?? null);

        $expiresAt = $validated['expires_at'] ?? null;
        if ($expiresAt === null || $expiresAt === '') {
            $auto = TenantAutomationSettings::forTenant($tenant);
            $days = $auto['quoteDefaultValidDays'];
            $base = Carbon::parse($validated['quoted_at'])->startOfDay();
            $expiresAt = $base->copy()->addDays($days)->toDateString();
        }

        $quoteTitle = $validated['quote_title'] ?? null;
        if (is_string($quoteTitle)) {
            $quoteTitle = trim($quoteTitle);
        }
        $quoteTitle = ($quoteTitle === '' || $quoteTitle === null) ? null : $quoteTitle;

        $quotation = DB::transaction(function () use ($tenant, $validated, $quoteRef, $quoteTitle, $customer, $billerPayload, $discType, $discBasis, $discVal) {
            $built = $this->lines->buildItemRows($tenant, $validated['items']);
            $rows = $built['rows'];
            $total = $built['total'];

            $quotation = Quotation::query()->create([
                'tenant_id' => $tenant->id,
                'quote_ref' => $quoteRef,
                'quote_title' => $quoteTitle,
                'quoted_at' => $validated['quoted_at'],
                'expires_at' => $expiresAt,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'biller_id' => $billerPayload['biller_id'],
                'biller_name' => $billerPayload['biller_name'],
                'status' => $validated['status'],
                'discount_type' => $discType,
                'discount_basis' => $discBasis,
                'discount_value' => $discVal,
                'total_amount' => $total,
                'customer_image_url' => $customer->avatar_url,
                'client_note' => $validated['client_note'] ?? null,
                'terms_and_conditions' => $validated['terms_and_conditions'] ?? null,
            ]);

            foreach ($rows as $data) {
                $quotation->items()->create($data);
            }

            return $quotation->load(['items' => fn ($q) => $q->orderBy('position')]);
        });

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'quotation.created',
            $quotation,
            ActivityLogProperties::quotation($quotation),
            $request
        );

        return response()->json([
            'message' => 'Quotation created.',
            'quotation' => $this->serializeQuotation($quotation),
        ], 201);
    }

    public function show(Request $request, string $quotation): JsonResponse
    {
        $model = $this->resolveQuotation($request, $quotation);
        $model->load(['items' => fn ($q) => $q->orderBy('position')]);

        return response()->json([
            'message' => 'Quotation retrieved.',
            'quotation' => $this->serializeQuotation($model),
        ]);
    }

    public function update(Request $request, string $quotation): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveQuotation($request, $quotation);

        $validated = $request->validate([
            'quoted_at' => ['sometimes', 'required', 'date'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'customer_id' => [
                'sometimes',
                'required',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'status' => ['sometimes', 'required', 'string', Rule::in(['Draft', 'Sent', 'Expired', 'Declined', 'Accepted'])],
            'items' => ['sometimes', 'required', 'array', 'min:1'],
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
            'client_note' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'terms_and_conditions' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'quote_title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'biller_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('billers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'discount_type' => ['sometimes', 'nullable', 'string', Rule::in(['none', 'before_tax', 'after_tax'])],
            'discount_basis' => ['sometimes', 'nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('discount_type', $validated)
            || array_key_exists('discount_basis', $validated)
            || array_key_exists('discount_value', $validated)) {
            $dt = array_key_exists('discount_type', $validated) ? $validated['discount_type'] : $model->discount_type;
            $db = array_key_exists('discount_basis', $validated) ? $validated['discount_basis'] : $model->discount_basis;
            $dv = array_key_exists('discount_value', $validated) ? $validated['discount_value'] : $model->discount_value;
            [$dt, $db, $dv] = $this->lines->normalizeDiscountFields($dt, $db, $dv);
            $validated['discount_type'] = $dt;
            $validated['discount_basis'] = $db;
            $validated['discount_value'] = $dv;
        }

        if (array_key_exists('quote_title', $validated)) {
            $t = $validated['quote_title'];
            if (is_string($t)) {
                $t = trim($t);
            }
            $validated['quote_title'] = ($t === '' || $t === null) ? null : $t;
        }

        DB::transaction(function () use ($model, $validated, $tenant): void {
            if (array_key_exists('customer_id', $validated)) {
                $customer = $this->resolveCustomer($tenant->id, (int) $validated['customer_id']);
                $model->customer_id = $customer->id;
                $model->customer_name = $customer->name;
                $model->customer_image_url = $customer->avatar_url;
            }

            if (array_key_exists('biller_id', $validated)) {
                $bp = $this->resolveBillerPayload($tenant->id, $validated['biller_id']);
                $model->biller_id = $bp['biller_id'];
                $model->biller_name = $bp['biller_name'];
            }

            if (array_key_exists('items', $validated)) {
                $model->items()->delete();
                $built = $this->lines->buildItemRows($tenant, $validated['items']);
                foreach ($built['rows'] as $data) {
                    $model->items()->create($data);
                }
                $model->total_amount = $built['total'];
            }

            $model->fill(Arr::except($validated, ['items', 'customer_id', 'biller_id']));
            $model->save();
        });

        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position')]);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'quotation.updated',
            $model,
            ActivityLogProperties::quotation($model),
            $request
        );

        return response()->json([
            'message' => 'Quotation updated.',
            'quotation' => $this->serializeQuotation($model),
        ]);
    }

    public function destroy(Request $request, string $quotation): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveQuotation($request, $quotation);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'quotation.deleted',
            $model,
            ActivityLogProperties::quotation($model),
            $request
        );

        $model->delete();

        return response()->json([
            'message' => 'Quotation deleted.',
        ]);
    }

    public function sendToCustomer(Request $request, string $quotation): JsonResponse
    {
        $model = $this->resolveQuotation($request, $quotation);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model->loadMissing([
            'items' => fn ($q) => $q->orderBy('position'),
            'customer:id,name,email,phone,location',
        ]);
        $validated = $request->validate([
            'to' => ['nullable', 'email:rfc,dns', 'max:255'],
            'cc' => ['nullable', 'array'],
            'cc.*' => ['email:rfc,dns', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:20000'],
            /** Optional client-generated PDF (same pipeline as modal Download PDF); falls back to server Dompdf. */
            'attachment_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:20480'],
        ]);
        $to = trim((string) ($validated['to'] ?? ($model->customer?->email ?? '')));
        if ($to === '') {
            throw ValidationException::withMessages([
                'customer_email' => 'Customer email is required before sending quotation.',
            ]);
        }
        $ccList = array_values(array_filter(array_map(
            static fn ($mail) => trim((string) $mail),
            $validated['cc'] ?? []
        )));
        $subject = trim((string) ($validated['subject'] ?? ('Quotation '.$model->quote_ref)));
        if ($subject === '') {
            $subject = 'Quotation '.$model->quote_ref;
        }
        $messageBody = trim((string) ($validated['message'] ?? ''));
        if ($messageBody === '') {
            $messageBody = "Hello {$model->customer_name},\n\nPlease find your quotation {$model->quote_ref}.\nTotal: Ksh ".number_format((float) $model->total_amount, 2)."\nStatus: {$model->status}\n\nThank you.";
        }

        $viewUrl = CustomerViewUrl::forQuotation($tenant->id, (int) $model->id);
        $messageBody .= "\n\nView online (confirm we know you opened this quotation):\n".$viewUrl;

        try {
            $pdfBinary = null;
            $upload = $request->file('attachment_pdf');
            if ($upload && $upload->isValid()) {
                $bytes = @file_get_contents($upload->getRealPath());
                if (is_string($bytes) && str_starts_with($bytes, '%PDF')) {
                    $pdfBinary = $bytes;
                }
            }
            if ($pdfBinary === null) {
                $pdfBinary = $this->buildQuotationPdfBinary($tenant, $model);
            }
            $pdfFilename = 'quotation-'.$model->quote_ref.'.pdf';
            Mail::raw(
                $messageBody,
                function ($message) use ($to, $ccList, $subject, $pdfBinary, $pdfFilename): void {
                    $mail = $message->to($to)->subject($subject);
                    if (! empty($ccList)) {
                        $mail->cc($ccList);
                    }
                    $mail->attachData($pdfBinary, $pdfFilename, [
                        'mime' => 'application/pdf',
                    ]);
                }
            );
        } catch (\Throwable $e) {
            Log::warning('Quotation send-to-customer email failed.', [
                'quotation_id' => $model->id,
                'customer_email' => $to,
                'customer_cc' => $ccList,
                'error' => $e->getMessage(),
            ]);
            throw ValidationException::withMessages([
                'email' => 'Could not send quotation email to customer.',
            ]);
        }

        $model->status = 'Sent';
        $model->save();
        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position')]);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'quotation.sent_to_customer',
            $model,
            array_merge(ActivityLogProperties::quotation($model), ['recipient_email' => $to]),
            $request
        );

        return response()->json([
            'message' => 'Quotation email sent to customer.',
            'quotation' => $this->serializeQuotation($model),
        ]);
    }

    public function convertToInvoice(Request $request, string $quotation): JsonResponse
    {
        $model = $this->resolveQuotation($request, $quotation);

        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $invoice = DB::transaction(function () use ($tenant, $model): Invoice {
            return $this->quotationToInvoice->createInvoiceFromQuotation($tenant, $model);
        });

        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position')]);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'quotation.converted_to_invoice',
            $model,
            array_merge(ActivityLogProperties::quotation($model), [
                'new_invoice_id' => $invoice->id,
                'new_invoice_ref' => $invoice->invoice_ref,
            ]),
            $request
        );
        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'invoice.created_from_quotation',
            $invoice,
            array_merge(ActivityLogProperties::invoice($invoice), [
                'quotation_id' => $model->id,
                'quote_ref' => $model->quote_ref,
            ]),
            $request
        );

        return response()->json([
            'message' => 'Quotation converted to invoice.',
            'invoice' => [
                'id' => $invoice->id,
                'invoice_ref' => $invoice->invoice_ref,
                'status' => $invoice->status,
            ],
            'quotation' => $this->serializeQuotation($model->fresh(['items' => fn ($q) => $q->orderBy('position')])),
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeQuotation(Quotation $q): array
    {
        $q->loadMissing([
            'items' => fn ($r) => $r->orderBy('position'),
            'customer:id,email,phone,location',
        ]);
        $cust = $q->customer;
        $custEmail = $cust && trim((string) ($cust->email ?? '')) !== '' ? trim((string) $cust->email) : null;
        $custPhone = $cust && trim((string) ($cust->phone ?? '')) !== '' ? trim((string) $cust->phone) : null;
        $custLoc = $cust && trim((string) ($cust->location ?? '')) !== '' ? trim((string) $cust->location) : null;

        return [
            ...$q->only([
                'id',
                'quote_ref',
                'quote_title',
                'quoted_at',
                'expires_at',
                'customer_id',
                'biller_id',
                'biller_name',
                'customer_name',
                'status',
                'discount_type',
                'discount_basis',
                'discount_value',
                'total_amount',
                'customer_image_url',
                'client_note',
                'terms_and_conditions',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
            'customer_email' => $custEmail,
            'customer_phone' => $custPhone,
            'customer_location' => $custLoc,
            'items' => $q->items->map(fn (QuotationItem $i) => $i->only([
                'id',
                'quotation_id',
                'product_id',
                'product_name',
                'product_image_url',
                'description',
                'quantity',
                'unit_price',
                'tax_percent',
                'line_total',
                'position',
                'created_at',
                'updated_at',
            ]))->values()->all(),
        ];
    }

    private function buildQuotationPdfBinary(Tenant $tenant, Quotation $q): string
    {
        return $this->pdfService->renderQuotationPdfBinary($tenant, $q);
    }

    private function resolveQuotation(Request $request, string $id): Quotation
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Quotation::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();
    }

    private function resolveCustomer(int $tenantId, int $customerId): Customer
    {
        return Customer::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($customerId)
            ->firstOrFail();
    }

    /**
     * @return array{biller_id: int|null, biller_name: string|null}
     */
    private function resolveBillerPayload(int $tenantId, mixed $billerId): array
    {
        if ($billerId === null || $billerId === '') {
            return ['biller_id' => null, 'biller_name' => null];
        }

        $biller = Biller::query()
            ->where('tenant_id', $tenantId)
            ->whereKey((int) $billerId)
            ->firstOrFail();

        return ['biller_id' => $biller->id, 'biller_name' => $biller->name];
    }

    private function nextQuoteRef(int $tenantId): string
    {
        $refs = Quotation::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('quote_ref');

        $max = 0;
        foreach ($refs as $ref) {
            if (preg_match('/^QT-(\d+)$/i', (string) $ref, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'QT-'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }
}
