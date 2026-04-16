<?php

use App\Models\Product;
use App\Models\StoreManager;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_store_stocks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained('store_managers')->restrictOnDelete();
            $table->unsignedInteger('qty')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'store_id']);
            $table->index(['tenant_id', 'store_id']);
        });

        if (! Schema::hasTable('products')) {
            return;
        }

        $products = Product::query()
            ->whereNull('deleted_at')
            ->get(['id', 'tenant_id', 'store_id', 'qty']);

        foreach ($products as $product) {
            $qty = max(0, (int) $product->qty);
            if ($qty === 0) {
                continue;
            }
            $storeId = $product->store_id;
            if ($storeId === null) {
                $storeId = StoreManager::query()
                    ->where('tenant_id', $product->tenant_id)
                    ->whereNull('deleted_at')
                    ->orderBy('id')
                    ->value('id');
            }
            if ($storeId === null) {
                continue;
            }
            DB::table('product_store_stocks')->insert([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'store_id' => $storeId,
                'qty' => $qty,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_store_stocks');
    }
};
