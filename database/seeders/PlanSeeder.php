<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $essentials = [
            'tenant.manage', 'users.manage', 'reports.view', 'search.global',
            'catalog.masters.manage', 'catalog.items.manage', 'stores.manage',
            'sales.orders.manage', 'sales.customers.manage',
        ];

        $retailAdd = [
            'sales.quotations.manage', 'sales.invoices.manage', 'sales.invoice_payments.manage',
            'sales.delivery_notes.manage', 'sales.credit_notes.manage', 'sales.returns.manage',
            'sales.billers.manage',
        ];

        $retailPlus = array_values(array_unique(array_merge($essentials, $retailAdd)));

        $deskRetail = array_values(array_filter($retailPlus, static fn (string $s): bool => $s !== 'sales.orders.manage'));

        $businessAdd = [
            'inventory.stock_adjust.manage', 'inventory.stock_transfer.manage',
            'procurement.suppliers.manage', 'procurement.purchases.manage', 'procurement.purchase_returns.manage',
            'finance.expenses.manage', 'system.activity_logs.view',
        ];

        $businessPro = array_values(array_unique(array_merge($retailPlus, $businessAdd)));

        $legacy = Plan::query()->updateOrCreate(
            ['slug' => 'legacy-full'],
            [
                'name' => 'Legacy Full',
                'price_amount' => 0,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => null,
                'features' => null,
                'included_stores' => 999,
                'max_stores' => null,
                'extra_store_price_amount' => null,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'pos-essentials'],
            [
                'name' => 'POS Essentials',
                'price_amount' => 1500,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => $essentials,
                'features' => null,
                'included_stores' => 1,
                'max_stores' => 1,
                'extra_store_price_amount' => null,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'retail-plus'],
            [
                'name' => 'Retail Plus',
                'price_amount' => 3500,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => $retailPlus,
                'features' => null,
                'included_stores' => 3,
                'max_stores' => null,
                'extra_store_price_amount' => 800,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'desk-retail'],
            [
                'name' => 'Desk Retail',
                'price_amount' => 3000,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => $deskRetail,
                'features' => null,
                'included_stores' => 3,
                'max_stores' => null,
                'extra_store_price_amount' => 800,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'business-pro'],
            [
                'name' => 'Business Pro',
                'price_amount' => 7500,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => $businessPro,
                'features' => null,
                'included_stores' => 3,
                'max_stores' => null,
                'extra_store_price_amount' => 1200,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'commerce-suite'],
            [
                'name' => 'Commerce Suite',
                'price_amount' => 12000,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => $businessPro,
                'features' => ['ecommerce' => true],
                'included_stores' => 5,
                'max_stores' => null,
                'extra_store_price_amount' => 1500,
                'is_active' => true,
            ]
        );

        Plan::query()->updateOrCreate(
            ['slug' => 'enterprise'],
            [
                'name' => 'Enterprise',
                'price_amount' => 25000,
                'currency' => 'KES',
                'billing_interval' => 'month',
                'allowed_permission_slugs' => null,
                'features' => null,
                'included_stores' => 999,
                'max_stores' => null,
                'extra_store_price_amount' => null,
                'is_active' => true,
            ]
        );

        foreach (Tenant::query()->cursor() as $tenant) {
            $already = TenantSubscription::query()
                ->where('tenant_id', $tenant->id)
                ->exists();
            if ($already) {
                continue;
            }
            TenantSubscription::query()->create([
                'tenant_id' => $tenant->id,
                'plan_id' => $legacy->id,
                'status' => 'active',
                'starts_at' => now(),
                'ends_at' => null,
                'purchased_extra_stores' => 0,
            ]);
        }
    }
}
