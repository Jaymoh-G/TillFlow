<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Biller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuotationController extends Controller
{
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

        [$discType, $discBasis, $discVal] = $this->normalizeQuotationDiscountFields(
            $validated['discount_type'] ?? 'none',
            $validated['discount_basis'] ?? 'percent',
            $validated['discount_value'] ?? null
        );

        $quoteRef = $validated['quote_ref'] ?? $this->nextQuoteRef($tenant->id);
        $customer = $this->resolveCustomer($tenant->id, (int) $validated['customer_id']);
        $billerPayload = $this->resolveBillerPayload($tenant->id, $validated['biller_id'] ?? null);

        $quoteTitle = $validated['quote_title'] ?? null;
        if (is_string($quoteTitle)) {
            $quoteTitle = trim($quoteTitle);
        }
        $quoteTitle = ($quoteTitle === '' || $quoteTitle === null) ? null : $quoteTitle;

        $quotation = DB::transaction(function () use ($tenant, $validated, $quoteRef, $quoteTitle, $customer, $billerPayload, $discType, $discBasis, $discVal) {
            $built = $this->buildQuotationItemRows($tenant, $validated['items']);
            $rows = $built['rows'];
            $total = $built['total'];

            $quotation = Quotation::query()->create([
                'tenant_id' => $tenant->id,
                'quote_ref' => $quoteRef,
                'quote_title' => $quoteTitle,
                'quoted_at' => $validated['quoted_at'],
                'expires_at' => $validated['expires_at'] ?? null,
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
            [$dt, $db, $dv] = $this->normalizeQuotationDiscountFields($dt, $db, $dv);
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
                $built = $this->buildQuotationItemRows($tenant, $validated['items']);
                foreach ($built['rows'] as $data) {
                    $model->items()->create($data);
                }
                $model->total_amount = $built['total'];
            }

            $model->fill(Arr::except($validated, ['items', 'customer_id', 'biller_id']));
            $model->save();
        });

        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position')]);

        return response()->json([
            'message' => 'Quotation updated.',
            'quotation' => $this->serializeQuotation($model),
        ]);
    }

    public function destroy(Request $request, string $quotation): JsonResponse
    {
        $model = $this->resolveQuotation($request, $quotation);
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

        return response()->json([
            'message' => 'Quotation email sent to customer.',
            'quotation' => $this->serializeQuotation($model),
        ]);
    }

    public function convertToInvoice(Request $request, string $quotation): JsonResponse
    {
        $model = $this->resolveQuotation($request, $quotation);
        $model->loadMissing([
            'items' => fn ($q) => $q->orderBy('position'),
            'customer:id,name,email,phone,location,avatar_url',
        ]);

        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $invoice = DB::transaction(function () use ($tenant, $model): Invoice {
            $invoice = Invoice::query()->create([
                'tenant_id' => $tenant->id,
                'invoice_ref' => $this->nextInvoiceRefForQuotation($tenant->id),
                'invoice_title' => trim((string) ($model->quote_title ?? '')) ?: null,
                'issued_at' => now()->toDateString(),
                'due_at' => $model->expires_at ? $model->expires_at->format('Y-m-d') : null,
                'customer_id' => $model->customer_id,
                'customer_name' => $model->customer_name,
                'customer_image_url' => $model->customer_image_url,
                'status' => Invoice::STATUS_UNPAID,
                'sent_to_customer_at' => null,
                'discount_type' => $model->discount_type ?? 'none',
                'discount_basis' => $model->discount_basis ?? 'percent',
                'discount_value' => $model->discount_value,
                'total_amount' => (float) $model->total_amount,
                'amount_paid' => '0.00',
                'notes' => $model->client_note,
                'terms_and_conditions' => $model->terms_and_conditions,
            ]);

            foreach ($model->items as $item) {
                $invoice->items()->create([
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'product_image_url' => $item->product_image_url,
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'tax_percent' => $item->tax_percent,
                    'line_total' => $item->line_total,
                    'position' => $item->position,
                ]);
            }

            $model->status = 'Accepted';
            $model->save();

            return $invoice->fresh(['items' => fn ($q) => $q->orderBy('position')]);
        });

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

    /**
     * Email attachment PDF — same information and layout as the on-screen quotation view / download.
     *
     * @return array{rows: list<array<string, mixed>>, subEx: float, taxAmt: float, discountAmt: float, discountLabel: string, grandTotal: float, dtype: string}
     */
    private function quotationPdfViewModel(Quotation $q): array
    {
        $q->loadMissing(['items' => fn ($r) => $r->orderBy('position')]);
        $items = $q->items;
        $rows = [];
        if ($items->isEmpty()) {
            $total = (float) $q->total_amount;
            $title = trim((string) ($q->quote_title ?? ''));
            if ($title === '') {
                $title = '—';
            }
            $rows[] = [
                'title' => $title,
                'desc' => '',
                'qty' => 1.0,
                'unit' => $total,
                'disc' => 0.0,
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
                    'disc' => 0.0,
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
            $taxAmt += round($sub * ($r['taxP'] / 100), 2);
        }
        $subEx = round($subEx, 2);
        $taxAmt = round($taxAmt, 2);
        $dtype = (string) ($q->discount_type ?? 'none');
        $basis = ($q->discount_basis === 'fixed') ? 'fixed' : 'percent';
        $valStr = $q->discount_value ?? '0';
        $discountAmt = 0.0;
        $discountLabel = 'Discount';
        if ($dtype !== 'none') {
            if ($basis === 'fixed') {
                $discountAmt = round($this->parseDiscountValueFixedForPdf($valStr), 2);
            } else {
                $p = $this->parseDiscountPercentForPdf($valStr);
                $discountAmt = round($subEx * ($p / 100), 2);
                $discountLabel = 'Discount ('.$p.'%)';
            }
        }
        $grandTotal = round((float) $q->total_amount, 2);

        return [
            'rows' => $rows,
            'subEx' => $subEx,
            'taxAmt' => $taxAmt,
            'discountAmt' => $discountAmt,
            'discountLabel' => $discountLabel,
            'grandTotal' => $grandTotal,
            'dtype' => $dtype,
        ];
    }

    private function parseDiscountPercentForPdf(mixed $raw): float
    {
        $x = (float) preg_replace('/[^0-9.-]/', '', (string) ($raw ?? '0'));
        if (! is_finite($x) || $x < 0) {
            return 0.0;
        }
        if ($x > 100) {
            return 100.0;
        }

        return round($x, 2);
    }

    private function parseDiscountValueFixedForPdf(mixed $raw): float
    {
        $x = (float) preg_replace('/[^0-9.-]/', '', (string) ($raw ?? '0'));
        if (! is_finite($x) || $x < 0) {
            return 0.0;
        }

        return round($x, 2);
    }

    private function buildQuotationPdfBinary(Tenant $tenant, Quotation $q): string
    {
        $tenant = $tenant->fresh();
        $vm = $this->quotationPdfViewModel($q);
        $q->loadMissing('customer');
        $customer = $q->customer;
        $quotedAt = $q->quoted_at ? $q->quoted_at->format('j M Y') : '—';
        $expiresAt = $q->expires_at ? $q->expires_at->format('j M Y') : '—';

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

        $footer = $this->resolveQuotationFooterLines($tenant);

        $companyLogoSrc = $this->resolveQuotationPdfCompanyLogoSrc($tenant);

        $html = view('pdf.quotation-detail', [
            'q' => $q,
            'vm' => $vm,
            'quotedAt' => $quotedAt,
            'expiresAt' => $expiresAt,
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
    private function resolveQuotationPdfCompanyLogoSrc(Tenant $tenant): ?string
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
            return $this->quotationPdfLogoUrlToDataUri($raw) ?? $raw;
        }
        if (str_starts_with($raw, '//')) {
            $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
            $url = $scheme.':'.$raw;

            return $this->quotationPdfLogoUrlToDataUri($url) ?? $url;
        }
        $pathPart = str_starts_with($raw, '/') ? $raw : '/'.$raw;
        $publicFile = public_path(ltrim($pathPart, '/'));
        if (is_file($publicFile) && is_readable($publicFile)) {
            return $this->quotationPdfFileToDataUri($publicFile);
        }

        $absolute = $baseUrl.$pathPart;

        return $this->quotationPdfLogoUrlToDataUri($absolute) ?? $absolute;
    }

    private function quotationPdfFileToDataUri(string $path): ?string
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

    private function quotationPdfLogoUrlToDataUri(string $url): ?string
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
    private function resolveQuotationFooterLines(Tenant $tenant): array
    {
        $defaults = [
            'payment' => 'Cheque to: Breezetech Management Systems Ltd',
            'bank' => 'Bank transfer to: Acc: 1286283051 · Bank: KCB Bank · SWIFT/BIC code: KCBLKENXXX · Bank code is 01',
            'closing' => 'Thank you for your interest. This quotation is valid until the date shown above.',
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
     * @param  array<int, array<string, mixed>>  $items
     * @return array{rows: array<int, array<string, mixed>>, total: float}
     */
    private function buildQuotationItemRows(Tenant $tenant, array $items): array
    {
        $rows = [];
        $total = 0.0;
        foreach ($items as $position => $row) {
            $pid = $row['product_id'] ?? null;
            $hasProductId = $pid !== null && $pid !== '' && (int) $pid > 0;

            if ($hasProductId) {
                $product = $this->resolveProduct($tenant->id, (int) $pid);
                $qty = (float) $row['quantity'];
                $unit = array_key_exists('unit_price', $row) && $row['unit_price'] !== null
                    ? (float) $row['unit_price']
                    : (float) ($product->selling_price ?? 0);
                $taxPct = $this->normalizeTaxPercent($row['tax_percent'] ?? null);
                $lineTotal = $this->lineTotalWithTax($qty, $unit, $taxPct);
                $total += $lineTotal;
                $rows[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_image_url' => $this->firstProductImagePublicUrl($product),
                    'description' => $this->normalizeItemDescription($row['description'] ?? null),
                    'quantity' => $qty,
                    'unit_price' => $unit,
                    'tax_percent' => $taxPct,
                    'line_total' => $lineTotal,
                    'position' => (int) $position,
                ];

                continue;
            }

            $name = trim((string) ($row['product_name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([
                    'items' => 'Each line must either use a catalog product or include a custom item description.',
                ]);
            }
            $qty = (float) $row['quantity'];
            $unit = array_key_exists('unit_price', $row) && $row['unit_price'] !== null
                ? (float) $row['unit_price']
                : 0.0;
            $taxPct = $this->normalizeTaxPercent($row['tax_percent'] ?? null);
            $lineTotal = $this->lineTotalWithTax($qty, $unit, $taxPct);
            $total += $lineTotal;
            $rows[] = [
                'product_id' => null,
                'product_name' => $name,
                'product_image_url' => null,
                'description' => $this->normalizeItemDescription($row['description'] ?? null),
                'quantity' => $qty,
                'unit_price' => $unit,
                'tax_percent' => $taxPct,
                'line_total' => $lineTotal,
                'position' => (int) $position,
            ];
        }

        return ['rows' => $rows, 'total' => round($total, 2)];
    }

    private function normalizeTaxPercent(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }
        $n = (float) $value;
        if ($n < 0) {
            return 0.0;
        }
        if ($n > 100) {
            return 100.0;
        }

        return round($n, 2);
    }

    private function lineTotalWithTax(float $qty, float $unit, float $taxPercent): float
    {
        $subtotal = round($qty * $unit, 2);

        return round($subtotal * (1 + $taxPercent / 100), 2);
    }

    private function normalizeItemDescription(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    /**
     * @return array{0: string, 1: string, 2: float|null}
     */
    private function normalizeQuotationDiscountFields(mixed $discountType, mixed $discountBasis, mixed $discountValue): array
    {
        $dt = $discountType === null || $discountType === '' ? 'none' : (string) $discountType;
        if (! in_array($dt, ['none', 'before_tax', 'after_tax'], true)) {
            $dt = 'none';
        }
        if ($dt === 'none') {
            return ['none', 'percent', null];
        }
        $db = $discountBasis === null || $discountBasis === '' ? 'percent' : (string) $discountBasis;
        if (! in_array($db, ['percent', 'fixed'], true)) {
            $db = 'percent';
        }
        if ($discountValue === null || $discountValue === '') {
            $dv = 0.0;
        } else {
            $dv = (float) $discountValue;
        }
        if ($dv < 0) {
            throw ValidationException::withMessages(['discount_value' => 'Discount value cannot be negative.']);
        }
        if ($db === 'percent' && $dv > 100) {
            throw ValidationException::withMessages(['discount_value' => 'Percent discount cannot exceed 100.']);
        }

        return [$dt, $db, round($dv, 2)];
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

    private function resolveProduct(int $tenantId, int $productId): Product
    {
        return Product::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($productId)
            ->with(['variants' => fn ($q) => $q->orderBy('id')])
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

    private function firstProductImagePublicUrl(Product $product): ?string
    {
        foreach ($product->variants as $variant) {
            if ($variant->image_path) {
                return Storage::disk('public')->url($variant->image_path);
            }
        }

        return null;
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

    private function nextInvoiceRefForQuotation(int $tenantId): string
    {
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

        return 'INV-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }
}
