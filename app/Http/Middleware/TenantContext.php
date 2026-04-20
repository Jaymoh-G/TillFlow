<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantContext
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ! $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is not assigned to a tenant.',
            ], 403);
        }

        $tenant = Tenant::query()->find($user->tenant_id);
        if (! $tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found.',
            ], 403);
        }

        if ($tenant->status !== Tenant::STATUS_ACTIVE) {
            return response()->json([
                'success' => false,
                'message' => 'This tenant account is suspended.',
                'data' => ['reason' => $tenant->suspended_reason],
            ], 403);
        }

        $tenant->forceFill(['last_active_at' => now()])->saveQuietly();

        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }
}
