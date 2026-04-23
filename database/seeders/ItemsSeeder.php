<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warranty;
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

        $categoryIds = Category::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $brandIds = Brand::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $unitIds = Unit::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $warrantyIds = Warranty::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $rows = [];
        for ($i = 1; $i <= 15; $i++) {
            $cid = $categoryIds === [] ? null : $categoryIds[($i - 1) % count($categoryIds)];
            $bid = $brandIds === [] ? null : $brandIds[($i - 1) % count($brandIds)];
            $uid = $unitIds === [] ? null : $unitIds[($i - 1) % count($unitIds)];
            $wid = $warrantyIds === [] ? null : $warrantyIds[($i - 1) % count($warrantyIds)];
            $buying = 80 + ($i * 3);
            $selling = round($buying * 1.35, 2);
            $rows[] = [
                'tenant_id' => $tenant->id,
                'category_id' => $cid,
                'brand_id' => $bid,
                'unit_id' => $uid,
                'warranty_id' => $wid,
                'name' => 'Item '.$i,
                'sku' => sprintf('ITEM-%03d', $i),
                'buying_price' => $buying,
                'selling_price' => $selling,
                'qty' => 12 + ($i % 9),
                'qty_alert' => 5 + ($i % 6),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        Product::query()->insert($rows);

        if ($this->command) {
            $this->command->info('Seeded 15 items (ITEM-001-ITEM-015).');
        }
    }
}
