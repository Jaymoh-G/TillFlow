<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PlatformDashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $tenantTotal = Tenant::query()->count();
        $plansTotal = Plan::query()->where('is_active', true)->count();

        $since = Carbon::now()->subDays(7);
        $activeTenants = Tenant::query()
            ->whereNotNull('last_active_at')
            ->where('last_active_at', '>=', $since)
            ->count();

        $activeSubscriptions = TenantSubscription::query()
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->count();

        $mrrApprox = (float) DB::table('tenant_subscriptions as ts')
            ->join('plans as p', 'p.id', '=', 'ts.plan_id')
            ->where('ts.status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ts.ends_at')->orWhere('ts.ends_at', '>', now());
            })
            ->where('p.billing_interval', 'month')
            ->sum(DB::raw('p.price_amount + (ts.purchased_extra_stores * COALESCE(p.extra_store_price_amount, 0))'));

        return response()->json([
            'success' => true,
            'message' => 'Dashboard stats.',
            'data' => [
                'tenant_total' => $tenantTotal,
                'plans_total' => $plansTotal,
                'tenants_active_last_7_days' => $activeTenants,
                'active_subscriptions' => $activeSubscriptions,
                'mrr_approx_monthly_kes' => round($mrrApprox, 2),
            ],
        ]);
    }
}
