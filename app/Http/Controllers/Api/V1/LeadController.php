<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Proposal;
use App\Models\Tenant;
use App\Support\CustomerCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $leads = Lead::query()
            ->where('tenant_id', $tenant->id)
            ->with('latestProposal')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Leads retrieved.',
            'leads' => $leads->map(fn (Lead $l) => $this->serializeLead($l))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }
        if (! $request->filled('status')) {
            $request->merge(['status' => Lead::STATUS_NEW_LEAD]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('leads', 'email')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'company' => ['nullable', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:64'],
            'location' => ['nullable', 'string', 'max:255'],
            'source' => ['required', 'string', Rule::in(Lead::SOURCES)],
            'status' => ['required', 'string', Rule::in(Lead::STATUSES)],
            'last_contacted_at' => ['nullable', 'date'],
        ]);

        $code = $this->nextLeadCode($tenant->id);
        $email = $this->normalizeOptionalString($validated['email'] ?? null);
        $company = $this->normalizeOptionalString($validated['company'] ?? null);
        $location = $this->normalizeOptionalString($validated['location'] ?? null);

        $lead = Lead::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => $validated['name'],
            'email' => $email,
            'company' => $company,
            'phone' => $validated['phone'],
            'location' => $location,
            'source' => $validated['source'],
            'status' => $validated['status'],
            'last_contacted_at' => $validated['last_contacted_at'] ?? null,
        ]);

        $lead->load('latestProposal');

        return response()->json([
            'message' => 'Lead created.',
            'lead' => $this->serializeLead($lead),
        ], 201);
    }

    public function show(Request $request, string $lead): JsonResponse
    {
        $model = $this->resolveLead($request, $lead);
        $model->load('latestProposal');

        return response()->json([
            'message' => 'Lead retrieved.',
            'lead' => $this->serializeLead($model),
        ]);
    }

    /**
     * Proposals created for this lead (read-only summary rows).
     */
    public function proposalsForLead(Request $request, string $lead): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveLead($request, $lead);

        $rows = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->where('lead_id', $model->id)
            ->orderByDesc('proposed_at')
            ->orderByDesc('id')
            ->get([
                'id',
                'proposal_ref',
                'proposal_title',
                'status',
                'proposed_at',
                'expires_at',
                'total_amount',
            ]);

        return response()->json([
            'message' => 'Proposals for lead.',
            'proposals' => $rows->map(fn (Proposal $p) => [
                'id' => $p->id,
                'proposal_ref' => $p->proposal_ref,
                'proposal_title' => $p->proposal_title,
                'status' => $p->status,
                'proposed_at' => $p->proposed_at?->format('Y-m-d'),
                'expires_at' => $p->expires_at?->format('Y-m-d'),
                'total_amount' => $p->total_amount !== null ? (float) $p->total_amount : null,
            ])->values()->all(),
        ]);
    }

    /**
     * Create a customer from the lead (or link an existing customer) and record conversion on the lead.
     */
    public function convertToCustomer(Request $request, string $lead): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveLead($request, $lead);

        if ($model->converted_customer_id) {
            $cust = Customer::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($model->converted_customer_id)
                ->first();

            return response()->json([
                'message' => 'Lead already has a linked customer.',
                'customer' => $cust ? $cust->only(['id', 'code', 'name', 'email', 'phone', 'company', 'location', 'status']) : null,
                'lead' => $this->serializeLead($model->fresh('latestProposal')),
            ]);
        }

        if ($model->status === Lead::STATUS_CLOSED_LOST) {
            throw ValidationException::withMessages([
                'lead' => 'Cannot convert a lost lead to a customer.',
            ]);
        }

        $validated = $request->validate([
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('customers', 'id')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at')),
            ],
        ]);

        $customer = DB::transaction(function () use ($tenant, $model, $validated) {
            if (! empty($validated['customer_id'])) {
                $c = Customer::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereKey((int) $validated['customer_id'])
                    ->firstOrFail();
            } else {
                $phone = trim((string) $model->phone);
                if ($phone === '') {
                    throw ValidationException::withMessages([
                        'phone' => 'Lead phone is required to create a customer.',
                    ]);
                }

                $existing = Customer::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('phone', $phone)
                    ->first();
                if ($existing) {
                    throw ValidationException::withMessages([
                        'phone' => 'A customer with this phone number already exists. Pass customer_id to link this lead to that customer.',
                    ]);
                }

                $email = $this->normalizeOptionalString($model->email);
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

                $c = Customer::query()->create([
                    'tenant_id' => $tenant->id,
                    'code' => CustomerCodeGenerator::next($tenant->id),
                    'name' => $model->name,
                    'email' => $email,
                    'company' => $this->normalizeOptionalString($model->company),
                    'phone' => $phone,
                    'location' => $this->normalizeOptionalString($model->location),
                    'status' => 'Active',
                    'avatar_url' => null,
                ]);
            }

            $model->converted_customer_id = $c->id;
            $model->converted_at = now();
            $model->save();

            return $c;
        });

        return response()->json([
            'message' => 'Lead converted to customer.',
            'customer' => $customer->only([
                'id',
                'code',
                'name',
                'email',
                'phone',
                'company',
                'location',
                'status',
            ]),
            'lead' => $this->serializeLead($model->fresh('latestProposal')),
        ], 201);
    }

    public function update(Request $request, string $lead): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveLead($request, $lead);

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('leads', 'email')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'company' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:64'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'source' => ['sometimes', 'nullable', 'string', Rule::in(Lead::SOURCES)],
            'status' => ['sometimes', 'required', 'string', Rule::in(Lead::STATUSES)],
            'last_contacted_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('email', $validated)) {
            $validated['email'] = $this->normalizeOptionalString($validated['email']);
        }
        if (array_key_exists('company', $validated)) {
            $validated['company'] = $this->normalizeOptionalString($validated['company']);
        }
        if (array_key_exists('location', $validated)) {
            $validated['location'] = $this->normalizeOptionalString($validated['location']);
        }
        if (array_key_exists('source', $validated)) {
            $validated['source'] = $this->normalizeOptionalString($validated['source']);
        }

        $model->fill($validated);
        $model->save();
        $model->load('latestProposal');

        return response()->json([
            'message' => 'Lead updated.',
            'lead' => $this->serializeLead($model),
        ]);
    }

    public function destroy(Request $request, string $lead): JsonResponse
    {
        $model = $this->resolveLead($request, $lead);
        $model->delete();

        return response()->json([
            'message' => 'Lead deleted.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLead(Lead $l): array
    {
        $lv = $l->relationLoaded('latestProposal') && $l->latestProposal
            ? (float) $l->latestProposal->total_amount
            : null;

        return [
            ...$l->only([
                'id',
                'code',
                'name',
                'email',
                'company',
                'phone',
                'location',
                'source',
                'status',
                'last_contacted_at',
                'converted_customer_id',
                'converted_at',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
            'lead_value' => $lv,
        ];
    }

    private function resolveLead(Request $request, string $leadId): Lead
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Lead::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($leadId)
            ->firstOrFail();
    }

    private function nextLeadCode(int $tenantId): string
    {
        $codes = Lead::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('code');

        $max = 0;
        foreach ($codes as $code) {
            if (preg_match('/^LD(\d+)$/i', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'LD'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
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
