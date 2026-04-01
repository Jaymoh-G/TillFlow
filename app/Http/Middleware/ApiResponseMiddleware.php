<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiResponseMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $response instanceof JsonResponse) {
            return $response;
        }

        $original = $response->getData(true);
        $statusCode = $response->getStatusCode();

        if ($this->alreadyWrapped($original)) {
            return $response;
        }

        $wrapped = [
            'success' => $statusCode >= 200 && $statusCode < 400,
            'message' => $original['message'] ?? null,
            'data' => $original,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
            ],
        ];

        return response()->json($wrapped, $statusCode, $response->headers->all());
    }

    private function alreadyWrapped(array $payload): bool
    {
        return array_key_exists('success', $payload)
            && array_key_exists('data', $payload)
            && array_key_exists('meta', $payload);
    }
}
