<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
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

        foreach ($tenantIds as $tenantId) {
            if ($tenantId === null) {
                continue;
            }
            $this->seedRolesForTenant((int) $tenantId);
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

    /**
     * @param  list<string>  $permissionSlugs
     */
    private function syncRolePermissions(Role $role, array $permissionSlugs): void
    {
        $ids = [];
        foreach ($permissionSlugs as $slug) {
            $p = Permission::query()->where('slug', $slug)->first();
            if ($p) {
                $ids[] = $p->id;
            }
        }
        $role->permissions()->sync($ids);
    }

    /**
     * @return list<string>
     */
    private function allManageSlugs(): array
    {
        /** @var list<string> $slugs */
        $slugs = config('permissions.slugs');

        return array_values(array_filter($slugs, static function (string $s): bool {
            return str_ends_with($s, '.manage')
                || in_array($s, ['tenant.manage', 'users.manage', 'reports.view', 'system.activity_logs.view'], true);
        }));
    }

    private function seedRolesForTenant(int $tenantId): void
    {
        $allManage = $this->allManageSlugs();

        $managerSlugs = array_values(array_filter($allManage, static function (string $s): bool {
            return $s !== 'tenant.manage';
        }));

        $definitions = [
            'owner' => $allManage,
            'admin' => $allManage,
            'manager' => $managerSlugs,
            'cashier' => [
                'sales.orders.manage',
                'sales.customers.manage',
                'catalog.items.view',
                'stores.view',
            ],
        ];

        foreach ($definitions as $slug => $permissionSlugs) {
            $role = Role::query()->firstOrCreate(
                ['tenant_id' => $tenantId, 'slug' => $slug],
                ['name' => ucfirst(str_replace('_', ' ', $slug))]
            );
            $this->syncRolePermissions($role, $permissionSlugs);
        }
    }
}
