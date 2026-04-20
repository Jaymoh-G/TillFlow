<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MpesaWebhookController extends Controller
{
    /**
     * Safaricom STK push result callback (ResultURL).
     */
    public function stkCallback(Request $request): JsonResponse
    {
        $body = $request->all();

        Log::info('M-Pesa STK callback', ['body' => $body]);

        try {
            $result = $body['Body']['stkCallback'] ?? null;
            if (! is_array($result)) {
                return response()->json(['ResultCode' => 0, 'ResultDesc' => 'accepted']);
            }

            $checkoutId = $result['CheckoutRequestID'] ?? null;
            $callbackMeta = $result['CallbackMetadata']['Item'] ?? [];
            $receipt = null;
            $amount = null;
            $phone = null;
            if (is_array($callbackMeta)) {
                foreach ($callbackMeta as $item) {
                    if (! isset($item['Name'], $item['Value'])) {
                        continue;
                    }
                    if ($item['Name'] === 'MpesaReceiptNumber') {
                        $receipt = (string) $item['Value'];
                    }
                    if ($item['Name'] === 'Amount') {
                        $amount = $item['Value'];
                    }
                    if ($item['Name'] === 'PhoneNumber') {
                        $phone = (string) $item['Value'];
                    }
                }
            }

            $resultCode = (int) ($result['ResultCode'] ?? -1);
            $payment = null;
            if (is_string($checkoutId) && $checkoutId !== '') {
                $payment = SubscriptionPayment::query()
                    ->where('method', 'mpesa_stk_pending')
                    ->orderByDesc('id')
                    ->get()
                    ->first(function (SubscriptionPayment $p) use ($checkoutId): bool {
                        $meta = $p->provider_meta;

                        return is_array($meta) && ($meta['checkout_request_id'] ?? null) === $checkoutId;
                    });
            }

            if ($payment instanceof SubscriptionPayment) {
                $meta = (array) ($payment->provider_meta ?? []);
                $meta['stk_callback'] = $body;
                $meta['mpesa_receipt_number'] = $receipt;
                $meta['phone'] = $phone;
                if ($resultCode === 0) {
                    $payment->method = 'mpesa_stk';
                    $payment->reference = $receipt ?? $payment->reference;
                    if ($amount !== null && is_numeric($amount)) {
                        $payment->amount = $amount;
                    }
                    $meta['status'] = 'completed';
                } else {
                    $meta['status'] = 'failed';
                    $meta['result_code'] = $resultCode;
                }
                $payment->provider_meta = $meta;
                $payment->save();
            }
        } catch (\Throwable $e) {
            Log::error('M-Pesa STK callback handling failed', ['e' => $e->getMessage()]);
        }

        return response()->json(['ResultCode' => 0, 'ResultDesc' => 'accepted']);
    }

    /**
     * STK timeout callback (optional).
     */
    public function stkTimeout(Request $request): JsonResponse
    {
        Log::info('M-Pesa STK timeout', ['body' => $request->all()]);

        return response()->json(['ResultCode' => 0, 'ResultDesc' => 'accepted']);
    }
}
