<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;
use App\Models\TenantSubscription;
use App\Services\Mpesa\MpesaDarajaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformMpesaController extends Controller
{
    public function stkPush(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_subscription_id' => ['required', 'integer', 'exists:tenant_subscriptions,id'],
            'amount' => ['required', 'numeric', 'min:1'],
            'phone' => ['required', 'string', 'min:9', 'max:20'],
            'currency' => ['sometimes', 'string', 'max:8'],
        ]);

        /** @var TenantSubscription $sub */
        $sub = TenantSubscription::query()->findOrFail((int) $data['tenant_subscription_id']);

        $service = app(MpesaDarajaService::class);

        $customerMsg = null;
        $checkoutId = null;
        /** @var array<string, mixed> $stkResponse */
        $stkResponse = [];

        $pending = SubscriptionPayment::query()->create([
            'tenant_subscription_id' => $sub->id,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'KES',
            'paid_at' => now(),
            'method' => 'mpesa_stk_pending',
            'reference' => null,
            'notes' => 'Awaiting Safaricom STK result',
            'recorded_by' => $request->user()?->id,
            'provider_meta' => ['status' => 'pending'],
        ]);

        try {
            $stkResponse = $service->lipaNaMpesaOnline(
                (string) $data['phone'],
                (float) $data['amount'],
                'sub-'.$sub->id,
                'TillFlow subscription'
            );

            $checkoutId = $stkResponse['CheckoutRequestID'] ?? null;
            $customerMsg = $stkResponse['CustomerMessage'] ?? null;

            $meta = array_merge((array) $pending->provider_meta, [
                'checkout_request_id' => $checkoutId,
                'stk_raw' => $stkResponse,
            ]);
            $pending->forceFill(['provider_meta' => $meta])->save();
        } catch (\Throwable $e) {
            $pending->delete();

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $customerMsg ?? 'STK Push sent.',
            'data' => [
                'checkout_request_id' => $checkoutId,
                'subscription_payment_id' => $pending->id,
                'mpesa_response' => $stkResponse,
            ],
        ]);
    }
}
