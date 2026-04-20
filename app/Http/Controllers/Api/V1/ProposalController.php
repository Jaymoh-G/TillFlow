<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Biller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Proposal;
use App\Models\ProposalItem;
use App\Models\Quotation;
use App\Models\Tenant;
use App\Services\QuotationToInvoiceService;
use App\Services\SalesDocumentLinesService;
use App\Services\SalesDocumentPdfService;
use App\Support\CustomerCodeGenerator;
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

class ProposalController extends Controller
{
    public function __construct(
        private readonly SalesDocumentLinesService $lines,
        private readonly SalesDocumentPdfService $pdfService,
        private readonly QuotationToInvoiceService $quotationToInvoice,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $proposals = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->with(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer'])
            ->orderByDesc('proposed_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Proposals retrieved.',
            'proposals' => $proposals->map(fn (Proposal $p) => $this->serializeProposal($p))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $this->validateProposalPayload($request, $tenant, true);
        $this->assertRecipientXor($validated);
        $this->assertLeadNotTerminalForCreate($tenant->id, $validated);

        [$discType, $discBasis, $discVal] = $this->lines->normalizeDiscountFields(
            $validated['discount_type'] ?? 'none',
            $validated['discount_basis'] ?? 'percent',
            $validated['discount_value'] ?? null
        );

        $proposalRef = $validated['proposal_ref'] ?? $this->nextProposalRef($tenant->id);
        $billerPayload = $this->resolveBillerPayload($tenant->id, $validated['biller_id'] ?? null);
        [$recipientName, $recipientImageUrl] = $this->resolveRecipientSnapshot($tenant->id, $validated);

        $proposalTitle = $this->normalizeOptionalString($validated['proposal_title'] ?? null);

        $expiresAt = $validated['expires_at'] ?? null;
        if ($expiresAt === null || $expiresAt === '') {
            $auto = TenantAutomationSettings::forTenant($tenant);
            $days = $auto['proposalDefaultValidDays'];
            $base = Carbon::parse($validated['proposed_at'])->startOfDay();
            $expiresAt = $base->copy()->addDays($days)->toDateString();
        }

        $proposal = DB::transaction(function () use ($tenant, $validated, $proposalRef, $proposalTitle, $billerPayload, $discType, $discBasis, $discVal, $recipientName, $recipientImageUrl, $expiresAt) {
            $built = $this->lines->buildItemRows($tenant, $validated['items']);
            $rows = $built['rows'];
            $total = $built['total'];

            $proposal = Proposal::query()->create([
                'tenant_id' => $tenant->id,
                'proposal_ref' => $proposalRef,
                'proposal_title' => $proposalTitle,
                'proposed_at' => $validated['proposed_at'],
                'expires_at' => $expiresAt,
                'lead_id' => $validated['lead_id'] ?? null,
                'customer_id' => $validated['customer_id'] ?? null,
                'biller_id' => $billerPayload['biller_id'],
                'biller_name' => $billerPayload['biller_name'],
                'recipient_name' => $recipientName,
                'recipient_image_url' => $recipientImageUrl,
                'status' => $validated['status'],
                'discount_type' => $discType,
                'discount_basis' => $discBasis,
                'discount_value' => $discVal,
                'total_amount' => $total,
                'client_note' => $validated['client_note'] ?? null,
                'terms_and_conditions' => $validated['terms_and_conditions'] ?? null,
            ]);

            foreach ($rows as $data) {
                $proposal->items()->create($data);
            }

            return $proposal->load(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);
        });

        return response()->json([
            'message' => 'Proposal created.',
            'proposal' => $this->serializeProposal($proposal),
        ], 201);
    }

    public function show(Request $request, string $proposal): JsonResponse
    {
        $model = $this->resolveProposal($request, $proposal);
        $model->load(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);

        return response()->json([
            'message' => 'Proposal retrieved.',
            'proposal' => $this->serializeProposal($model),
        ]);
    }

    public function update(Request $request, string $proposal): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveProposal($request, $proposal);

        if ($model->status === 'Accepted' || $model->quotation_id !== null) {
            throw ValidationException::withMessages([
                'proposal' => 'Accepted proposals cannot be updated.',
            ]);
        }

        $validated = $this->validateProposalPayload($request, $tenant, false, $model);
        if (array_key_exists('lead_id', $validated) || array_key_exists('customer_id', $validated)) {
            $lid = array_key_exists('lead_id', $validated) ? $validated['lead_id'] : $model->lead_id;
            $cid = array_key_exists('customer_id', $validated) ? $validated['customer_id'] : $model->customer_id;
            $merged = ['lead_id' => $lid, 'customer_id' => $cid];
            $this->assertRecipientXor($merged);
            $this->assertLeadNotTerminalForCreate($tenant->id, $merged);
        }

        [$discType, $discBasis, $discVal] = $this->lines->normalizeDiscountFields(
            Arr::get($validated, 'discount_type', $model->discount_type ?? 'none'),
            Arr::get($validated, 'discount_basis', $model->discount_basis ?? 'percent'),
            Arr::get($validated, 'discount_value', $model->discount_value)
        );

        $billerPayload = $this->resolveBillerPayload(
            $tenant->id,
            array_key_exists('biller_id', $validated) ? $validated['biller_id'] : $model->biller_id
        );

        DB::transaction(function () use ($model, $validated, $tenant, $discType, $discBasis, $discVal, $billerPayload): void {
            if (array_key_exists('lead_id', $validated) || array_key_exists('customer_id', $validated)) {
                $lid = array_key_exists('lead_id', $validated) ? $validated['lead_id'] : $model->lead_id;
                $cid = array_key_exists('customer_id', $validated) ? $validated['customer_id'] : $model->customer_id;
                $snap = $this->resolveRecipientSnapshot($tenant->id, ['lead_id' => $lid, 'customer_id' => $cid]);
                $model->lead_id = $lid;
                $model->customer_id = $cid;
                $model->recipient_name = $snap[0];
                $model->recipient_image_url = $snap[1];
            }

            if (array_key_exists('items', $validated)) {
                $model->items()->delete();
                $built = $this->lines->buildItemRows($tenant, $validated['items']);
                foreach ($built['rows'] as $data) {
                    $model->items()->create($data);
                }
                $model->total_amount = $built['total'];
            }

            $model->biller_id = $billerPayload['biller_id'];
            $model->biller_name = $billerPayload['biller_name'];
            $model->discount_type = $discType;
            $model->discount_basis = $discBasis;
            $model->discount_value = $discVal;

            $fill = Arr::only($validated, [
                'proposal_ref',
                'proposal_title',
                'proposed_at',
                'expires_at',
                'status',
                'client_note',
                'terms_and_conditions',
            ]);
            if (array_key_exists('proposal_title', $fill)) {
                $fill['proposal_title'] = $this->normalizeOptionalString($fill['proposal_title'] ?? null);
            }
            $model->fill($fill);
            $model->save();
        });

        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);

        return response()->json([
            'message' => 'Proposal updated.',
            'proposal' => $this->serializeProposal($model),
        ]);
    }

    public function destroy(Request $request, string $proposal): JsonResponse
    {
        $model = $this->resolveProposal($request, $proposal);
        if ($model->status === 'Accepted' || $model->quotation_id !== null) {
            throw ValidationException::withMessages([
                'proposal' => 'Accepted proposals cannot be deleted.',
            ]);
        }
        $model->delete();

        return response()->json([
            'message' => 'Proposal deleted.',
        ]);
    }

    public function sendToRecipient(Request $request, string $proposal): JsonResponse
    {
        $model = $this->resolveProposal($request, $proposal);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model->loadMissing([
            'items' => fn ($q) => $q->orderBy('position'),
            'lead',
            'customer:id,name,email,phone,location',
        ]);

        $validated = $request->validate([
            'to' => ['nullable', 'email:rfc,dns', 'max:255'],
            'cc' => ['nullable', 'array'],
            'cc.*' => ['email:rfc,dns', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:20000'],
            'attachment_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $defaultTo = '';
        if ($model->customer_id && $model->customer) {
            $defaultTo = trim((string) ($model->customer->email ?? ''));
        } elseif ($model->lead_id && $model->lead) {
            $defaultTo = trim((string) ($model->lead->email ?? ''));
        }
        $to = trim((string) ($validated['to'] ?? $defaultTo));
        if ($to === '') {
            throw ValidationException::withMessages([
                'email' => 'Recipient email is required before sending the proposal.',
            ]);
        }

        $ccList = array_values(array_filter(array_map(
            static fn ($mail) => trim((string) $mail),
            $validated['cc'] ?? []
        )));
        $subject = trim((string) ($validated['subject'] ?? ('Proposal '.$model->proposal_ref)));
        if ($subject === '') {
            $subject = 'Proposal '.$model->proposal_ref;
        }
        $messageBody = trim((string) ($validated['message'] ?? ''));
        if ($messageBody === '') {
            $messageBody = "Hello {$model->recipient_name},\n\nPlease find your proposal {$model->proposal_ref}.\nTotal: Ksh ".number_format((float) $model->total_amount, 2)."\nStatus: {$model->status}\n\nThank you.";
        }

        $viewUrl = CustomerViewUrl::forProposal($tenant->id, (int) $model->id);
        $messageBody .= "\n\nView online (confirm we know you opened this proposal):\n".$viewUrl;

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
                $pdfBinary = $this->pdfService->renderProposalPdfBinary($tenant, $model);
            }
            $pdfFilename = 'proposal-'.$model->proposal_ref.'.pdf';
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
            Log::warning('Proposal send-to-recipient email failed.', [
                'proposal_id' => $model->id,
                'to' => $to,
                'error' => $e->getMessage(),
            ]);
            throw ValidationException::withMessages([
                'email' => 'Could not send proposal email.',
            ]);
        }

        $model->status = 'Sent';
        $model->save();

        if ($model->lead_id) {
            $lead = Lead::query()->where('tenant_id', $tenant->id)->whereKey($model->lead_id)->first();
            if ($lead && ! $lead->isTerminal()) {
                $lead->status = Lead::STATUS_PROPOSAL_SENT;
                $lead->save();
            }
        }

        $model->refresh()->load(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);

        return response()->json([
            'message' => 'Proposal email sent.',
            'proposal' => $this->serializeProposal($model),
        ]);
    }

    public function accept(Request $request, string $proposal): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveProposal($request, $proposal);
        $model->loadMissing(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);

        if ($model->status === 'Accepted' || $model->quotation_id !== null) {
            throw ValidationException::withMessages([
                'proposal' => 'This proposal has already been accepted.',
            ]);
        }

        $validated = $request->validate([
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'convert_to' => ['nullable', 'string', Rule::in(['quotation', 'invoice'])],
        ]);

        $convertTo = $validated['convert_to'] ?? 'quotation';
        if (! in_array($convertTo, ['quotation', 'invoice'], true)) {
            $convertTo = 'quotation';
        }

        if ($convertTo === 'invoice') {
            $user = $request->user();
            if (! $user || ! method_exists($user, 'hasPermission') || ! $user->hasPermission('sales.invoices.manage')) {
                throw ValidationException::withMessages([
                    'convert_to' => 'Creating an invoice requires the sales.invoices.manage permission.',
                ]);
            }
        }

        if (! in_array($model->status, ['Draft', 'Sent', 'Expired', 'Declined'], true)) {
            throw ValidationException::withMessages([
                'proposal' => 'Proposal cannot be accepted in its current state.',
            ]);
        }

        /** @var Invoice|null $invoice */
        $invoice = null;
        /** @var Quotation|null $quotation */
        $quotation = null;

        if ($convertTo === 'invoice') {
            DB::transaction(function () use ($tenant, $model, $validated, &$invoice) {
                $customer = $this->resolveCustomerForAccept($tenant, $model, $validated['customer_id'] ?? null);
                $invoice = $this->quotationToInvoice->createInvoiceFromProposal($tenant, $model, $customer);

                $model->status = 'Accepted';
                $model->accepted_at = now();
                $model->save();

                if ($model->lead_id && $model->lead) {
                    $lead = $model->lead;
                    $lead->status = Lead::STATUS_CLOSED_WON;
                    $lead->converted_customer_id = $customer->id;
                    $lead->converted_at = now();
                    $lead->save();
                }
            });
        } else {
            $quotation = DB::transaction(function () use ($tenant, $model, $validated) {
                $customer = $this->resolveCustomerForAccept($tenant, $model, $validated['customer_id'] ?? null);
                $quoteRef = $this->nextQuoteRef($tenant->id);
                $quotedAt = now()->toDateString();

                $quotation = Quotation::query()->create([
                    'tenant_id' => $tenant->id,
                    'quote_ref' => $quoteRef,
                    'quote_title' => $model->proposal_title,
                    'quoted_at' => $quotedAt,
                    'expires_at' => $model->expires_at,
                    'customer_id' => $customer->id,
                    'customer_name' => $customer->name,
                    'biller_id' => $model->biller_id,
                    'biller_name' => $model->biller_name,
                    'status' => 'Accepted',
                    'discount_type' => $model->discount_type ?? 'none',
                    'discount_basis' => $model->discount_basis ?? 'percent',
                    'discount_value' => $model->discount_value,
                    'total_amount' => $model->total_amount,
                    'customer_image_url' => $customer->avatar_url,
                    'client_note' => $model->client_note,
                    'terms_and_conditions' => $model->terms_and_conditions,
                ]);

                foreach ($model->items as $item) {
                    $quotation->items()->create([
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
                $model->quotation_id = $quotation->id;
                $model->accepted_at = now();
                $model->save();

                if ($model->lead_id && $model->lead) {
                    $lead = $model->lead;
                    $lead->status = Lead::STATUS_CLOSED_WON;
                    $lead->converted_customer_id = $customer->id;
                    $lead->converted_at = now();
                    $lead->save();
                }

                return $quotation->fresh(['items' => fn ($q) => $q->orderBy('position')]);
            });
        }

        $freshProposal = $model->fresh(['items' => fn ($q) => $q->orderBy('position'), 'lead', 'customer']);

        $payload = [
            'message' => $invoice
                ? 'Proposal accepted; invoice created.'
                : 'Proposal accepted and converted to quotation.',
            'proposal' => $this->serializeProposal($freshProposal),
        ];

        if ($quotation instanceof Quotation) {
            $payload['quotation'] = [
                'id' => $quotation->id,
                'quote_ref' => $quotation->quote_ref,
                'status' => $quotation->status,
            ];
        }

        if ($invoice instanceof Invoice) {
            $payload['invoice'] = [
                'id' => $invoice->id,
                'invoice_ref' => $invoice->invoice_ref,
                'status' => $invoice->status,
            ];
        }

        return response()->json($payload, 201);
    }

    private function resolveCustomerForAccept(Tenant $tenant, Proposal $proposal, ?int $explicitCustomerId): Customer
    {
        if ($proposal->customer_id) {
            return Customer::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($proposal->customer_id)
                ->firstOrFail();
        }

        $lead = $proposal->lead ?? Lead::query()->where('tenant_id', $tenant->id)->whereKey($proposal->lead_id)->firstOrFail();

        if ($lead->status === Lead::STATUS_CLOSED_LOST) {
            throw ValidationException::withMessages([
                'lead' => 'Cannot accept a proposal for a lost lead.',
            ]);
        }

        if ($explicitCustomerId) {
            $c = Customer::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($explicitCustomerId)
                ->firstOrFail();

            return $c;
        }

        $phone = trim((string) $lead->phone);
        $existing = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->where('phone', $phone)
            ->first();
        if ($existing) {
            throw ValidationException::withMessages([
                'phone' => 'A customer with this phone number already exists. Pass customer_id to link this lead to that customer.',
            ]);
        }

        $email = $this->normalizeOptionalString($lead->email);
        if ($email) {
            $byEmail = Customer::query()
                ->where('tenant_id', $tenant->id)
                ->where('email', $email)
                ->first();
            if ($byEmail) {
                throw ValidationException::withMessages([
                    'email' => 'A customer with this email already exists. Pass customer_id to link this lead to that customer.',
                ]);
            }
        }

        return Customer::query()->create([
            'tenant_id' => $tenant->id,
            'code' => CustomerCodeGenerator::next($tenant->id),
            'name' => $lead->name,
            'email' => $email,
            'company' => $this->normalizeOptionalString($lead->company),
            'phone' => $phone,
            'location' => $this->normalizeOptionalString($lead->location),
            'status' => 'Active',
            'avatar_url' => null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assertRecipientXor(array $validated): void
    {
        $lid = $validated['lead_id'] ?? null;
        $cid = $validated['customer_id'] ?? null;
        $hasL = $lid !== null && $lid !== '' && (int) $lid > 0;
        $hasC = $cid !== null && $cid !== '' && (int) $cid > 0;
        if ($hasL === $hasC) {
            throw ValidationException::withMessages([
                'recipient' => 'Set exactly one of lead_id or customer_id.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assertLeadNotTerminalForCreate(int $tenantId, array $validated): void
    {
        $lid = $validated['lead_id'] ?? null;
        if (! $lid) {
            return;
        }
        $lead = Lead::query()->where('tenant_id', $tenantId)->whereKey((int) $lid)->first();
        if ($lead && $lead->isTerminal()) {
            throw ValidationException::withMessages([
                'lead_id' => 'Cannot attach a proposal to a closed lead.',
            ]);
        }
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    private function resolveRecipientSnapshot(int $tenantId, array $validated): array
    {
        if (! empty($validated['customer_id'])) {
            $c = Customer::query()->where('tenant_id', $tenantId)->whereKey((int) $validated['customer_id'])->firstOrFail();

            return [$c->name, $c->avatar_url];
        }
        $l = Lead::query()->where('tenant_id', $tenantId)->whereKey((int) $validated['lead_id'])->firstOrFail();

        return [$l->name, null];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProposalPayload(Request $request, Tenant $tenant, bool $isCreate, ?Proposal $existing = null): array
    {
        $proposalRefRule = [
            'nullable',
            'string',
            'max:32',
            Rule::unique('proposals', 'proposal_ref')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
        ];
        if (! $isCreate && $existing) {
            $proposalRefRule = [
                'sometimes',
                'nullable',
                'string',
                'max:32',
                Rule::unique('proposals', 'proposal_ref')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($existing->id),
            ];
        }

        return $request->validate([
            'proposed_at' => [$isCreate ? 'required' : 'sometimes', 'date'],
            'expires_at' => [
                'nullable',
                'date',
                function (string $attribute, mixed $value, \Closure $fail) use ($request, $existing): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    $prop = $request->input('proposed_at');
                    if (! $prop && $existing) {
                        $prop = $existing->proposed_at?->toDateString();
                    }
                    if (is_string($prop) && $prop !== '' && (string) $value < $prop) {
                        $fail('Valid until must be on or after the proposed date.');
                    }
                },
            ],
            'lead_id' => [
                $isCreate ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                Rule::exists('leads', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'customer_id' => [
                $isCreate ? 'nullable' : 'sometimes',
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'status' => [$isCreate ? 'required' : 'sometimes', 'string', Rule::in(['Draft', 'Sent', 'Expired', 'Declined', 'Accepted'])],
            'items' => [$isCreate ? 'required' : 'sometimes', 'array', 'min:1'],
            'items.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
            'items.*.product_name' => ['nullable', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:20000'],
            'items.*.quantity' => [$isCreate ? 'required' : 'sometimes', 'numeric', 'min:0.001'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'proposal_ref' => $proposalRefRule,
            'client_note' => ['nullable', 'string', 'max:20000'],
            'terms_and_conditions' => ['nullable', 'string', 'max:20000'],
            'proposal_title' => ['nullable', 'string', 'max:500'],
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
    }

    private function resolveProposal(Request $request, string $id): Proposal
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
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

    private function nextProposalRef(int $tenantId): string
    {
        $refs = Proposal::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('proposal_ref');

        $max = 0;
        foreach ($refs as $ref) {
            if (preg_match('/^PR-(\d+)$/i', (string) $ref, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'PR-'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
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

    /**
     * @return array<string, mixed>
     */
    private function serializeProposal(Proposal $p): array
    {
        $p->loadMissing(['items' => fn ($r) => $r->orderBy('position'), 'lead', 'customer']);

        $leadEmail = $p->lead ? (trim((string) ($p->lead->email ?? '')) !== '' ? trim((string) $p->lead->email) : null) : null;
        $custEmail = $p->customer ? (trim((string) ($p->customer->email ?? '')) !== '' ? trim((string) $p->customer->email) : null) : null;

        return [
            ...$p->only([
                'id',
                'proposal_ref',
                'proposal_title',
                'proposed_at',
                'expires_at',
                'lead_id',
                'customer_id',
                'biller_id',
                'biller_name',
                'recipient_name',
                'recipient_image_url',
                'status',
                'discount_type',
                'discount_basis',
                'discount_value',
                'total_amount',
                'client_note',
                'terms_and_conditions',
                'quotation_id',
                'accepted_at',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
            'lead_email' => $leadEmail,
            'customer_email' => $custEmail,
            'items' => $p->items->map(fn (ProposalItem $i) => $i->only([
                'id',
                'proposal_id',
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

    private function normalizeOptionalString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
