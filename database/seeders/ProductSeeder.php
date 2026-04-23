<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warranty;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Seed 15 catalog items for the TillFlow demo tenant (SKUs SEED-001 … SEED-015).
     */
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            if ($this->command) {
                $this->command->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');
            }

            return;
        }

        Product::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('sku', 'like', 'SEED-%')
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
            $qtyAlert = 5 + (($i - 1) % 16); // 5..20
            $qty = ($i % 7 === 0) ? 0 : (($i * 3) % 26); // mix of zeros and 0..25
            $buying = 95 + ($i * 4.5);
            $selling = round($buying * 1.4, 2);

            $manufacturedAt = null;
            $expiresAt = null;
            if ($i <= 14) {
                $expiresAt = Carbon::today()->subDays(1 + ($i % 8))->toDateString();
                $manufacturedAt = Carbon::parse($expiresAt)->subMonthsNoOverflow(6)->toDateString();
            } elseif ($i <= 28) {
                $expiresAt = Carbon::today()->addDays($i - 14)->toDateString();
                $manufacturedAt = Carbon::today()->subYear()->toDateString();
            }

            $rows[] = [
                'tenant_id' => $tenant->id,
                'category_id' => $cid,
                'brand_id' => $bid,
                'unit_id' => $uid,
                'warranty_id' => $wid,
                'name' => 'Seeded item '.$i,
                'sku' => sprintf('SEED-%03d', $i),
                'qty' => $qty,
                'qty_alert' => $qtyAlert,
                'buying_price' => round($buying, 2),
                'selling_price' => $selling,
                'manufactured_at' => $manufacturedAt,
                'expires_at' => $expiresAt,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach (array_chunk($rows, 50) as $chunk) {
            Product::query()->insert($chunk);
        }

        if ($this->command) {
            $this->command->info('Seeded 15 products (SEED-001–SEED-015) for tenant tillflow-demo.');
        }
    }
}
