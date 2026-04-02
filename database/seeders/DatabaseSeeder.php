<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RbacSeeder::class);

        $tenant = Tenant::query()->updateOrCreate([
            'slug' => 'tillflow-demo',
        ], [
            'name' => 'TillFlow Demo Tenant',
            'status' => 'active',
        ]);

        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@tillflow.local'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'TillFlow Admin',
                'password' => 'password',
            ]
        );

        $ownerRole = Role::query()->where('slug', 'owner')->first();

        if ($ownerRole) {
            $admin->roles()->syncWithoutDetaching([$ownerRole->id]);
        }

        $cashierRole = Role::query()->where('slug', 'cashier')->first();

        User::query()->updateOrCreate(
            ['email' => 'cashier@tillflow.local'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'TillFlow Cashier',
                'password' => 'password',
            ]
        )->roles()->sync($cashierRole ? [$cashierRole->id] : []);

        $this->call(CategorySeeder::class);
        $this->call(BrandSeeder::class);
        $this->call(UnitSeeder::class);
        $this->call(VariantAttributeSeeder::class);
        $this->call(WarrantySeeder::class);
        $this->call(ProductSeeder::class);
    }
}
