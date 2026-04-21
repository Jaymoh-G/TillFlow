<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class ItemsSeeder extends Seeder
{
    /**
     * Seed generic item records in products table.
     */
    public function run(): void
    {
        $tenant = Tenant::query()
            ->where('slug', 'tillflow-demo')
            ->first() ?? Tenant::query()->orderBy('id')->first();

        if (! $tenant) {
            if ($this->command) {
                $this->command->warn('No tenant found. Skipping ItemsSeeder.');
            }

            return;
        }

        Product::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('sku', 'like', 'ITEM-%')
            ->forceDelete();

        $rows = [];
        for ($i = 1; $i <= 25; $i++) {
            $rows[] = [
                'tenant_id' => $tenant->id,
                'name' => 'Item '.$i,
                'sku' => sprintf('ITEM-%03d', $i),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        Product::query()->insert($rows);

        if ($this->command) {
            $this->command->info('Seeded 25 items (ITEM-001-ITEM-025).');
        }
    }
}
