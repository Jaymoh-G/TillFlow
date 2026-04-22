<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Tenants\TenantRoleProvisioningService;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        /** @var list<string> $slugs */
        $slugs = config('permissions.slugs');

        foreach ($slugs as $slug) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => ucfirst(str_replace(['.', '-'], [' ', ' '], $slug))]
            );
        }

        $tenantIds = User::query()
            ->whereNotNull('tenant_id')
            ->distinct()
            ->pluck('tenant_id')
            ->merge(Tenant::query()->pluck('id'))
            ->unique()
            ->sort()
            ->values();

        $roleProvisioning = app(TenantRoleProvisioningService::class);
        foreach ($tenantIds as $tenantId) {
            if ($tenantId === null) {
                continue;
            }
            $roleProvisioning->ensureForTenantId((int) $tenantId);
        }

        User::query()->whereNotNull('tenant_id')->chunkById(100, function ($users): void {
            foreach ($users as $user) {
                if ($user->roles()->exists()) {
                    continue;
                }
                $admin = Role::query()
                    ->where('tenant_id', $user->tenant_id)
                    ->where('slug', 'admin')
                    ->first();
                if ($admin) {
                    $user->roles()->syncWithoutDetaching([$admin->id]);
                }
            }
        });
    }

}
