<?php

namespace App\Services\Billing;

use App\Models\Plan;
use App\Models\StoreManager;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Illuminate\Validation\ValidationException;

class PlanEntitlementService
{
    public function activeSubscription(Tenant $tenant): ?TenantSubscription
    {
        return $tenant->subscriptions()
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->with('plan')
            ->latest('starts_at')
            ->first();
    }

    public function planAllowsPermission(Tenant $tenant, string $slug): bool
    {
        $sub = $this->activeSubscription($tenant);
        if ($sub === null) {
            return true;
        }
        $plan = $sub->plan;
        if (! $plan instanceof Plan) {
            return true;
        }
        $allowed = $plan->allowed_permission_slugs;
        if ($allowed === null) {
            return true;
        }
        if (! is_array($allowed)) {
            return true;
        }
        $set = collect($allowed);
        if ($set->contains($slug)) {
            return true;
        }
        if ($slug === 'users.manage' && $set->contains('tenant.manage')) {
            return true;
        }
        if (str_ends_with($slug, '.view')) {
            $manage = substr($slug, 0, -strlen('.view')).'.manage';

            return $set->contains($manage);
        }

        return false;
    }

    /**
     * Null = no numeric cap (treat as unlimited for enforcement).
     */
    public function effectiveStoreLimit(Tenant $tenant): ?int
    {
        $sub = $this->activeSubscription($tenant);
        if ($sub === null) {
            return null;
        }
        $plan = $sub->plan;
        if (! $plan instanceof Plan) {
            return null;
        }
        $included = (int) $plan->included_stores;
        $extraPurchased = (int) $sub->purchased_extra_stores;
        $softLimit = $included + $extraPurchased;
        $maxStores = $plan->max_stores;
        if ($maxStores === null) {
            return $softLimit;
        }

        return min((int) $maxStores, $softLimit);
    }

    public function assertCanAddStore(Tenant $tenant): void
    {
        $limit = $this->effectiveStoreLimit($tenant);
        if ($limit === null) {
            return;
        }
        $count = StoreManager::query()->where('tenant_id', $tenant->id)->count();
        if ($count >= $limit) {
            throw ValidationException::withMessages([
                'store_name' => ['Store limit reached for your subscription. Upgrade your plan or purchase additional store slots.'],
            ]);
        }
    }
}
