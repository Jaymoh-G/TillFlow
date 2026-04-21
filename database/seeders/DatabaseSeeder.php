<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            RbacSeeder::class,
            PlanSeeder::class,
            UnitSeeder::class,
            BrandSeeder::class,
            CategorySeeder::class,
            VariantAttributeSeeder::class,
            WarrantySeeder::class,
            ItemsSeeder::class,
            ProductSeeder::class,
            PlatformOwnerSeeder::class,
            MultitenancyTestSeeder::class,
        ]);
    }
}
