<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformPlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = Plan::query()
            ->withCount([
                'subscriptions as active_subscriptions_count' => function ($q): void {
                    $q->where('status', 'active')
                        ->where(function ($q2): void {
                            $q2->whereNull('ends_at')->orWhere('ends_at', '>', now());
                        });
                },
            ])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Plans retrieved.',
            'data' => [
                'plans' => $plans->map(fn (Plan $p) => $this->serializePlan($p))->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);
        $plan = Plan::query()->create($data);

        return response()->json([
            'success' => true,
            'message' => 'Plan created.',
            'data' => ['plan' => $this->serializePlan($plan->fresh())],
        ], 201);
    }

    public function show(Plan $plan): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Plan retrieved.',
            'data' => ['plan' => $this->serializePlan($plan)],
        ]);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $data = $this->validated($request, $plan);
        $plan->fill($data);
        $plan->save();

        return response()->json([
            'success' => true,
            'message' => 'Plan updated.',
            'data' => ['plan' => $this->serializePlan($plan->fresh())],
        ]);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        if ($plan->subscriptions()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a plan that has subscriptions. Deactivate it instead.',
                'data' => null,
            ], 422);
        }

        $plan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Plan deleted.',
            'data' => null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Plan $plan): array
    {
        $slugRule = Rule::unique('plans', 'slug');
        if ($plan !== null) {
            $slugRule = $slugRule->ignore($plan->id);
        }

        $validSlugs = array_values(array_unique(config('permissions.slugs', [])));

        $sometimes = $plan !== null;

        return $request->validate([
            'name' => [$sometimes ? 'sometimes' : 'required', 'string', 'max:255'],
            'slug' => [$sometimes ? 'sometimes' : 'required', 'string', 'max:100', $slugRule],
            'price_amount' => [$sometimes ? 'sometimes' : 'required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'billing_interval' => [$sometimes ? 'sometimes' : 'required', 'string', 'in:month,year'],
            'allowed_permission_slugs' => ['nullable', 'array'],
            'allowed_permission_slugs.*' => ['string', Rule::in($validSlugs)],
            'features' => ['nullable', 'array'],
            'included_stores' => ['nullable', 'integer', 'min:1'],
            'max_stores' => ['nullable', 'integer', 'min:1'],
            'extra_store_price_amount' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlan(Plan $plan): array
    {
        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'slug' => $plan->slug,
            'price_amount' => (float) $plan->price_amount,
            'currency' => $plan->currency,
            'billing_interval' => $plan->billing_interval,
            'allowed_permission_slugs' => $plan->allowed_permission_slugs,
            'features' => $plan->features,
            'included_stores' => (int) $plan->included_stores,
            'max_stores' => $plan->max_stores !== null ? (int) $plan->max_stores : null,
            'extra_store_price_amount' => $plan->extra_store_price_amount !== null ? (float) $plan->extra_store_price_amount : null,
            'is_active' => (bool) $plan->is_active,
            'active_subscriptions_count' => (int) ($plan->active_subscriptions_count ?? 0),
            'created_at' => $plan->created_at?->toIso8601String(),
            'updated_at' => $plan->updated_at?->toIso8601String(),
        ];
    }
}
