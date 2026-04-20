<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformTenantSubscriptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $query = TenantSubscription::query()
            ->with(['tenant:id,name,slug', 'plan:id,name,slug,price_amount,currency,billing_interval'])
            ->orderByDesc('starts_at');

        if (is_string($from) && $from !== '') {
            $query->whereDate('starts_at', '>=', $from);
        }
        if (is_string($to) && $to !== '') {
            $query->whereDate('starts_at', '<=', $to);
        }

        $rows = $query->get();

        return response()->json([
            'success' => true,
            'message' => 'Subscriptions retrieved.',
            'data' => [
                'subscriptions' => $rows->map(fn (TenantSubscription $s) => $this->serializeRow($s))->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'status' => ['sometimes', 'string', 'max:32'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'purchased_extra_stores' => ['sometimes', 'integer', 'min:0'],
        ]);

        $tenant = Tenant::query()->findOrFail((int) $data['tenant_id']);

        TenantSubscription::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled']);

        $sub = TenantSubscription::query()->create([
            'tenant_id' => $tenant->id,
            'plan_id' => (int) $data['plan_id'],
            'status' => $data['status'] ?? 'active',
            'starts_at' => isset($data['starts_at']) ? Carbon::parse($data['starts_at']) : now(),
            'ends_at' => isset($data['ends_at']) ? Carbon::parse($data['ends_at']) : null,
            'purchased_extra_stores' => (int) ($data['purchased_extra_stores'] ?? 0),
        ]);

        $sub->load(['tenant:id,name,slug', 'plan']);

        return response()->json([
            'success' => true,
            'message' => 'Subscription created.',
            'data' => ['subscription' => $this->serializeRow($sub)],
        ], 201);
    }

    public function update(Request $request, TenantSubscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['sometimes', 'integer', 'exists:plans,id'],
            'status' => ['sometimes', 'string', 'max:32'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'purchased_extra_stores' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('starts_at', $data)) {
            $subscription->starts_at = $data['starts_at'] !== null ? Carbon::parse($data['starts_at']) : $subscription->starts_at;
        }
        if (array_key_exists('ends_at', $data)) {
            $subscription->ends_at = $data['ends_at'] !== null ? Carbon::parse($data['ends_at']) : null;
        }
        if (isset($data['plan_id'])) {
            /** @var Plan $plan */
            $plan = Plan::query()->findOrFail((int) $data['plan_id']);
            $subscription->plan_id = $plan->id;
        }
        if (isset($data['status'])) {
            $subscription->status = $data['status'];
        }
        if (isset($data['purchased_extra_stores'])) {
            $subscription->purchased_extra_stores = (int) $data['purchased_extra_stores'];
        }

        $subscription->save();
        $subscription->load(['tenant:id,name,slug', 'plan']);

        return response()->json([
            'success' => true,
            'message' => 'Subscription updated.',
            'data' => ['subscription' => $this->serializeRow($subscription)],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRow(TenantSubscription $s): array
    {
        $tenant = $s->tenant;
        $plan = $s->plan;

        return [
            'id' => $s->id,
            'tenant_id' => $s->tenant_id,
            'tenant_name' => $tenant->name ?? null,
            'tenant_slug' => $tenant->slug ?? null,
            'plan_id' => $s->plan_id,
            'plan_name' => $plan->name ?? null,
            'plan_slug' => $plan->slug ?? null,
            'status' => $s->status,
            'starts_at' => $s->starts_at?->toIso8601String(),
            'ends_at' => $s->ends_at?->toIso8601String(),
            'purchased_extra_stores' => (int) $s->purchased_extra_stores,
            'amount' => $plan ? (float) $plan->price_amount : null,
            'currency' => $plan->currency ?? null,
            'billing_interval' => $plan->billing_interval ?? null,
        ];
    }
}
