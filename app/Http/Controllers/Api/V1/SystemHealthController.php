<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class SystemHealthController extends Controller
{
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'TillFlow API',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function ready(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 'not_ready',
                'service' => 'TillFlow API',
                'database' => 'down',
                'message' => $exception->getMessage(),
            ], 503);
        }

        return response()->json([
            'status' => 'ready',
            'service' => 'TillFlow API',
            'database' => 'up',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
