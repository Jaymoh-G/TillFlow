<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'tenant.manage' => 'Manage tenant settings',
            'users.manage' => 'Manage users and memberships',
            'catalog.manage' => 'Manage products and inventory catalog',
            'sales.manage' => 'Manage sales operations',
            'reports.view' => 'View reports and dashboards',
        ];

        foreach ($permissions as $slug => $description) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => str($slug)->replace('.', ' ')->title()->toString(),
                    'description' => $description,
                ]
            );
        }

        $owner = Role::query()->updateOrCreate(
            ['slug' => 'owner'],
            ['name' => 'Owner', 'description' => 'Full tenant ownership privileges']
        );

        $admin = Role::query()->updateOrCreate(
            ['slug' => 'admin'],
            ['name' => 'Admin', 'description' => 'Administrative privileges']
        );

        $cashier = Role::query()->updateOrCreate(
            ['slug' => 'cashier'],
            ['name' => 'Cashier', 'description' => 'Checkout and day-to-day sales access']
        );

        $owner->permissions()->sync(Permission::query()->pluck('id')->all());

        $admin->permissions()->sync(
            Permission::query()
                ->whereIn('slug', ['tenant.manage', 'users.manage', 'catalog.manage', 'sales.manage', 'reports.view'])
                ->pluck('id')
                ->all()
        );

        $cashier->permissions()->sync(
            Permission::query()
                ->whereIn('slug', ['sales.manage'])
                ->pluck('id')
                ->all()
        );
    }
}
