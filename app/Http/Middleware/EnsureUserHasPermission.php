<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\Billing\PlanEntitlementService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (! $user->hasPermission($permission)) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to perform this action.',
                'data' => ['required_permission' => $permission],
            ], 403);
        }

        $tenant = $request->attributes->get('tenant');
        if ($tenant instanceof Tenant) {
            $entitlement = app(PlanEntitlementService::class);
            if (! $entitlement->planAllowsPermission($tenant, $permission)) {
                return response()->json([
                    'success' => false,
                    'message' => 'This action is not included in your subscription package.',
                    'data' => [
                        'required_permission' => $permission,
                        'reason' => 'plan_restriction',
                    ],
                ], 403);
            }
        }

        return $next($request);
    }
}
