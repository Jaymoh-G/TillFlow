<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

final class ApiEnvelope
{
    /**
     * @param  array<string, mixed>|object|null  $data
     */
    public static function json(bool $success, ?string $message, mixed $data = null, int $status = 200, array $metaExtras = []): JsonResponse
    {
        return response()->json([
            'success' => $success,
            'message' => $message,
            'data' => $data,
            'meta' => array_merge([
                'timestamp' => now()->toIso8601String(),
            ], $metaExtras),
        ], $status);
    }
}
