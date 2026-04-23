<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function vapidPublicKey(): JsonResponse
    {
        $key = config('push.vapid.public_key');
        if (! is_string($key) || $key === '') {
            // 200 + null key: clients skip subscribe; avoids noisy 503 in dev when push is disabled.
            return response()->json([
                'message' => 'Web Push is not configured on the server.',
                'public_key' => null,
            ]);
        }

        return response()->json([
            'message' => 'VAPID public key.',
            'public_key' => $key,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'endpoint' => ['required', 'string'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string', 'max:2048'],
            'keys.auth' => ['required', 'string', 'max:512'],
            'content_encoding' => ['nullable', 'string', 'max:32'],
        ]);

        $encoding = isset($validated['content_encoding']) && is_string($validated['content_encoding']) && $validated['content_encoding'] !== ''
            ? $validated['content_encoding']
            : 'aes128gcm';
        $endpointHash = hash('sha256', $validated['endpoint']);

        PushSubscription::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'endpoint_hash' => $endpointHash,
            ],
            [
                'tenant_id' => $tenant->id,
                'endpoint' => $validated['endpoint'],
                'public_key' => $validated['keys']['p256dh'],
                'auth_secret' => $validated['keys']['auth'],
                'content_encoding' => $encoding,
            ],
        );

        return response()->json([
            'message' => 'Push subscription saved.',
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'endpoint' => ['required', 'string'],
        ]);
        $endpointHash = hash('sha256', $validated['endpoint']);

        PushSubscription::query()
            ->where('user_id', $user->id)
            ->where('endpoint_hash', $endpointHash)
            ->delete();

        return response()->json([
            'message' => 'Push subscription removed.',
        ]);
    }
}
