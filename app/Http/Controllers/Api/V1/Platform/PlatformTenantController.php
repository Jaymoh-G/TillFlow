<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformTenantController extends Controller
{
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
            'status' => ['sometimes', 'string', Rule::in([Tenant::STATUS_ACTIVE, Tenant::STATUS_SUSPENDED])],
            'suspended_reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $tenant->fill($data);
        $tenant->save();

        return response()->json([
            'success' => true,
            'message' => 'Tenant updated.',
            'data' => ['tenant' => $this->serializeTenant($tenant->fresh(), null)],
        ]);
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
