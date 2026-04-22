<?php

namespace App\Services\Tenants;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;

class TenantRoleProvisioningService
{
    /**
     * Ensure default roles (owner, admin, manager, cashier, tenant) exist for this tenant
     * and have the expected permission sets.
     */
    public function ensureForTenant(Tenant $tenant): void
    {
        $this->ensureForTenantId((int) $tenant->id);
    }

    public function ensureForTenantId(int $tenantId): void
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
            'tenant' => [
                'tenant.manage',
                'users.manage',
                'reports.view',
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
}
