<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Removes data created by {@see MultitenancyTestSeeder} (identifiable emails, SKUs, tenant slugs).
 *
 * Laravel does not support rolling back seeders in core — this is an explicit undo for the demo only.
 *
 *   php artisan db:seed --class=MultitenancyTestSeederRollback
 *
 * To wipe the whole database and rebuild: `php artisan migrate:fresh` (destructive).
 */
class MultitenancyTestSeederRollback extends Seeder
{
    /** @var list<string> */
    private const DEMO_EMAILS = [
        'mt-a@multitenancy.test',
        'mt-b@multitenancy.test',
        'mt-none@multitenancy.test',
    ];

    /** @var list<string> */
    private const DEMO_TENANT_SLUGS = ['mt-demo-a', 'mt-demo-b'];

    /** @var list<string> */
    private const DEMO_SKUS = ['MT-DEMO-A-SKU', 'MT-DEMO-B-SKU'];

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->removeDemoProducts();
            $this->removeDemoUsers();

            $tenantIds = Tenant::query()
                ->whereIn('slug', self::DEMO_TENANT_SLUGS)
                ->pluck('id');

            if ($tenantIds->isEmpty()) {
                $this->log('No demo tenants found (slugs: '.implode(', ', self::DEMO_TENANT_SLUGS).').');

                return;
            }

            $this->removeRolesForDemoTenants($tenantIds);
            $this->removeDemoTenants($tenantIds);
        });

        $this->log('Multitenancy demo rollback finished (demo users, demo SKUs, demo tenants when safe).');
    }

    private function removeDemoProducts(): void
    {
        Product::query()
            ->withTrashed()
            ->whereIn('sku', self::DEMO_SKUS)
            ->get()
            ->each(function (Product $product): void {
                $product->forceDelete();
            });
    }

    private function removeDemoUsers(): void
    {
        $users = User::query()->whereIn('email', self::DEMO_EMAILS)->get();
        foreach ($users as $user) {
            $user->tokens()->delete();
            $user->roles()->detach();
            $user->delete();
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, int|string>  $tenantIds
     */
    private function removeRolesForDemoTenants($tenantIds): void
    {
        foreach ($tenantIds as $tenantId) {
            $tid = (int) $tenantId;
            if (User::query()->where('tenant_id', $tid)->exists()) {
                $this->log("Skipping role removal for tenant_id {$tid}: other users still reference this tenant.");

                continue;
            }

            Role::query()->where('tenant_id', $tid)->delete();
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, int|string>  $tenantIds
     */
    private function removeDemoTenants($tenantIds): void
    {
        foreach ($tenantIds as $tenantId) {
            $tid = (int) $tenantId;
            if (User::query()->where('tenant_id', $tid)->exists()) {
                $this->log("Skipping tenant id {$tid}: users still reference it.");

                continue;
            }

            try {
                Tenant::query()->whereKey($tid)->delete();
            } catch (\Throwable $e) {
                $this->log('Could not delete demo tenant '.$tid.': '.$e->getMessage());
            }
        }
    }

    private function log(string $message): void
    {
        if ($this->command) {
            $this->command->info($message);
        }
    }
}
