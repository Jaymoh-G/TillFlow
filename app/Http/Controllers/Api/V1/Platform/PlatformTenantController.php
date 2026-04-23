<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Services\Tenants\TenantRoleProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlatformTenantController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'status' => ['sometimes', 'string', Rule::in([Tenant::STATUS_ACTIVE, Tenant::STATUS_SUSPENDED])],
            'company_phone' => ['nullable', 'string', 'max:64', Rule::unique('tenants', 'company_phone')],
            'company_website' => ['nullable', 'string', 'max:512'],
            'company_address_line' => ['nullable', 'string', 'max:2000'],
        ]);

        $name = trim($data['name']);
        $slugBase = isset($data['slug']) && $data['slug'] !== ''
            ? Str::slug((string) $data['slug'])
            : Str::slug($name);
        if ($slugBase === '') {
            $slugBase = 'tenant';
        }

        $slug = $slugBase;
        $n = 1;
        while (Tenant::query()->where('slug', $slug)->exists()) {
            $slug = $slugBase.'-'.$n;
            $n++;
        }

        $tenant = Tenant::query()->create([
            'name' => $name,
            'slug' => $slug,
            'status' => $data['status'] ?? Tenant::STATUS_ACTIVE,
            'company_email' => null,
            'company_phone' => $this->nullableTrim($data['company_phone'] ?? null),
            'company_fax' => null,
            'company_website' => $this->nullableTrim($data['company_website'] ?? null),
            'company_address_line' => $this->nullableTrim($data['company_address_line'] ?? null),
            'company_country' => null,
            'company_state' => null,
            'company_city' => null,
            'company_postal_code' => null,
        ]);

        app(TenantRoleProvisioningService::class)->ensureForTenant($tenant);

        return response()->json([
            'success' => true,
            'message' => 'Tenant created. Add company contacts next; billing email comes from the primary contact.',
            'data' => [
                'tenant' => $this->serializeTenant($tenant->fresh(), null),
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $status = $request->query('status');

        $query = Tenant::query()->orderBy('name');

        if ($q !== '') {
            $query->where(function ($w) use ($q): void {
                $w->where('name', 'like', '%'.$q.'%')
                    ->orWhere('slug', 'like', '%'.$q.'%');
            });
        }

        if (is_string($status) && $status !== '') {
            $query->where('status', $status);
        }

        $tenants = $query->get();
        $ids = $tenants->pluck('id')->all();

        $currentSubs = TenantSubscription::query()
            ->whereIn('tenant_id', $ids)
            ->where('status', 'active')
            ->where(function ($q2): void {
                $q2->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->with('plan')
            ->orderByDesc('starts_at')
            ->get()
            ->unique('tenant_id')
            ->keyBy('tenant_id');

        return response()->json([
            'success' => true,
            'message' => 'Tenants retrieved.',
            'data' => [
                'tenants' => $tenants->map(function (Tenant $t) use ($currentSubs) {
                    $sub = $currentSubs->get($t->id);

                    return $this->serializeTenant($t, $sub);
                })->values(),
            ],
        ]);
    }

    public function show(Tenant $tenant): JsonResponse
    {
        $tenant->load(['subscriptions' => function ($rel): void {
            $rel->with('plan', 'payments')->orderByDesc('starts_at');
        }]);

        $current = $tenant->subscriptions->first(function (TenantSubscription $s): bool {
            if ($s->status !== 'active') {
                return false;
            }
            if ($s->ends_at === null) {
                return true;
            }

            return $s->ends_at->isFuture();
        });

        return response()->json([
            'success' => true,
            'message' => 'Tenant retrieved.',
            'data' => ['tenant' => $this->serializeTenantDetail($tenant, $current)],
        ]);
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('tenants', 'slug')->ignore($tenant->id)],
            'status' => ['sometimes', 'string', Rule::in([Tenant::STATUS_ACTIVE, Tenant::STATUS_SUSPENDED])],
            'suspended_reason' => ['nullable', 'string', 'max:2000'],
            'company_email' => ['nullable', 'email', 'max:255', Rule::unique('tenants', 'company_email')->ignore($tenant->id)],
            'company_phone' => ['nullable', 'string', 'max:64', Rule::unique('tenants', 'company_phone')->ignore($tenant->id)],
            'company_fax' => ['nullable', 'string', 'max:64'],
            'company_website' => ['nullable', 'string', 'max:512'],
            'company_address_line' => ['nullable', 'string', 'max:2000'],
            'company_country' => ['nullable', 'string', 'max:32'],
            'company_state' => ['nullable', 'string', 'max:64'],
            'company_city' => ['nullable', 'string', 'max:64'],
            'company_postal_code' => ['nullable', 'string', 'max:32'],
        ]);

        $fill = $data;
        if (array_key_exists('name', $fill)) {
            $fill['name'] = trim((string) $fill['name']);
        }
        foreach (['company_email', 'company_phone', 'company_fax', 'company_website', 'company_address_line',
            'company_country', 'company_state', 'company_city', 'company_postal_code', ] as $k) {
            if (array_key_exists($k, $fill)) {
                $fill[$k] = $this->nullableTrim($fill[$k] ?? null);
            }
        }

        $tenant->fill($fill);
        $tenant->save();

        return response()->json([
            'success' => true,
            'message' => 'Tenant updated.',
            'data' => ['tenant' => $this->serializeTenant($tenant->fresh(), null)],
        ]);
    }

    private function nullableTrim(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $t = trim($v);

        return $t === '' ? null : $t;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTenant(Tenant $tenant, ?TenantSubscription $currentSub = null): array
    {
        if ($currentSub === null) {
            $currentSub = $tenant->relationLoaded('subscriptions')
                ? $tenant->subscriptions->first()
                : TenantSubscription::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('status', 'active')
                    ->where(function ($q2): void {
                        $q2->whereNull('ends_at')->orWhere('ends_at', '>', now());
                    })
                    ->with('plan')
                    ->latest('starts_at')
                    ->first();
        }

        $sub = $currentSub;

        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'status' => $tenant->status ?? Tenant::STATUS_ACTIVE,
            'suspended_reason' => $tenant->suspended_reason,
            'last_active_at' => $tenant->last_active_at?->toIso8601String(),
            'created_at' => $tenant->created_at?->toIso8601String(),
            'company_email' => $tenant->company_email,
            'company_phone' => $tenant->company_phone,
            'company_fax' => $tenant->company_fax,
            'company_website' => $tenant->company_website,
            'company_address_line' => $tenant->company_address_line,
            'company_country' => $tenant->company_country,
            'company_state' => $tenant->company_state,
            'company_city' => $tenant->company_city,
            'company_postal_code' => $tenant->company_postal_code,
            'current_plan' => $sub && $sub->plan ? [
                'id' => $sub->plan->id,
                'name' => $sub->plan->name,
                'slug' => $sub->plan->slug,
            ] : null,
            'subscription_ends_at' => $sub?->ends_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTenantDetail(Tenant $tenant, ?TenantSubscription $current): array
    {
        $base = $this->serializeTenant($tenant, $current);

        $base['subscriptions'] = $tenant->subscriptions->map(function ($sub): array {
            return [
                'id' => $sub->id,
                'status' => $sub->status,
                'starts_at' => $sub->starts_at?->toIso8601String(),
                'ends_at' => $sub->ends_at?->toIso8601String(),
                'purchased_extra_stores' => (int) $sub->purchased_extra_stores,
                'plan' => $sub->plan ? [
                    'id' => $sub->plan->id,
                    'name' => $sub->plan->name,
                    'slug' => $sub->plan->slug,
                ] : null,
                'payments' => $sub->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'amount' => (float) $p->amount,
                    'currency' => $p->currency,
                    'paid_at' => $p->paid_at?->toIso8601String(),
                    'method' => $p->method,
                    'reference' => $p->reference,
                ])->values(),
            ];
        })->values();

        return $base;
    }
}
