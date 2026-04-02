<?php

namespace App\Http\Middleware;

use App\Support\ApiEnvelope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return ApiEnvelope::json(false, 'Unauthenticated.', null, 401);
        }

        if (! $user->hasPermission($permission)) {
            return ApiEnvelope::json(
                false,
                'You do not have permission to perform this action.',
                ['required_permission' => $permission],
                403
            );
        }

        return $next($request);
    }
}
