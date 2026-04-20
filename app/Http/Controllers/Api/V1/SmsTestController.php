<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\Sms\TenantSmsSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsTestController extends Controller
{
    public function __construct(
        private readonly TenantSmsSender $sms,
    ) {}

    public function sendTest(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'to' => ['required', 'string', 'max:32'],
            'message' => ['nullable', 'string', 'max:480'],
        ]);

        $msg = trim((string) ($validated['message'] ?? ''));
        if ($msg === '') {
            $msg = 'TillFlow test SMS — your gateway is configured correctly.';
        }

        $result = $this->sms->send($tenant, $validated['to'], $msg);

        return response()->json([
            'message' => 'Test SMS sent.',
            'provider' => $result['provider'],
            'detail' => $result['detail'],
        ]);
    }
}
