<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductQuantity;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class LowStockDemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();
        if (! $tenant) {
            if ($this->command) {
                $this->command->warn('TillFlow demo tenant (tillflow-demo) not found. Skipping LowStockDemoSeeder.');
            }

            return;
        }

        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->where(function ($q): void {
                $q->where('sku', 'like', 'SEED-%')
                    ->orWhere('sku', 'like', 'ITEM-%');
            })
            ->orderBy('id')
            ->limit(8)
            ->get();

        $updated = 0;
        foreach ($products as $idx => $product) {
            $targetQty = $idx % 4;       // 0..3
            $targetAlert = 8 + $idx;     // 8..15

            $bucketRows = ProductQuantity::query()
                ->where('tenant_id', $tenant->id)
                ->where('product_id', $product->id)
                ->orderBy('store_id')
                ->get();

            if ($bucketRows->isNotEmpty()) {
                foreach ($bucketRows as $bIdx => $bucket) {
                    $bucket->qty = $bIdx === 0 ? $targetQty : 0;
                    $bucket->save();
                }
            }

            $product->qty = $targetQty;
            $product->qty_alert = $targetAlert;
            $product->save();
            $updated++;
        }

        if ($this->command) {
            $this->command->info("Adjusted {$updated} products into low-stock/out-of-stock state for tillflow-demo.");
        }
    }
}
