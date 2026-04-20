<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;
use App\Models\TenantSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSubscriptionPaymentController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_subscription_id' => ['required', 'integer', 'exists:tenant_subscriptions,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:8'],
            'paid_at' => ['nullable', 'date'],
            'method' => ['required', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        /** @var TenantSubscription $sub */
        $sub = TenantSubscription::query()->findOrFail((int) $data['tenant_subscription_id']);

        $user = $request->user();

        $payment = SubscriptionPayment::query()->create([
            'tenant_subscription_id' => $sub->id,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'KES',
            'paid_at' => isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now(),
            'method' => $data['method'],
            'reference' => $data['reference'] ?? null,
            'notes' => $data['notes'] ?? null,
            'recorded_by' => $user?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payment recorded.',
            'data' => ['payment' => $this->serializePayment($payment)],
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePayment(SubscriptionPayment $p): array
    {
        return [
            'id' => $p->id,
            'tenant_subscription_id' => $p->tenant_subscription_id,
            'amount' => (float) $p->amount,
            'currency' => $p->currency,
            'paid_at' => $p->paid_at?->toIso8601String(),
            'method' => $p->method,
            'reference' => $p->reference,
            'notes' => $p->notes,
        ];
    }
}
