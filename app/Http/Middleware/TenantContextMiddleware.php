<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantContextMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if (! $user->tenant_id) {
            return response()->json([
                'message' => 'User is not linked to a tenant.',
            ], 403);
        }

        $tenant = Tenant::query()
            ->where('id', $user->tenant_id)
            ->where('status', 'active')
            ->first();

        if (! $tenant) {
            return response()->json([
                'message' => 'Tenant is not active or does not exist.',
            ], 403);
        }

        $request->attributes->set('tenant', $tenant);
        app()->instance('currentTenant', $tenant);

        return $next($request);
    }
}
