<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            if (! Schema::hasColumn('products', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        $tenantIndexExists = collect(DB::select("SHOW INDEX FROM `products` WHERE `Key_name` = 'products_tenant_id_index'"))
            ->isNotEmpty();
        if (! $tenantIndexExists) {
            Schema::table('products', function (Blueprint $table): void {
                $table->index('tenant_id');
            });
        }

        $tenantSkuUniqueExists = collect(DB::select("SHOW INDEX FROM `products` WHERE `Key_name` = 'products_tenant_id_sku_unique'"))
            ->isNotEmpty();
        if ($tenantSkuUniqueExists) {
            Schema::table('products', function (Blueprint $table): void {
                $table->dropUnique('products_tenant_id_sku_unique');
            });
        }

        $tenantSkuIndexExists = collect(DB::select("SHOW INDEX FROM `products` WHERE `Key_name` = 'products_tenant_id_sku_index'"))
            ->isNotEmpty();
        if (! $tenantSkuIndexExists) {
            Schema::table('products', function (Blueprint $table): void {
                $table->index(['tenant_id', 'sku']);
            });
        }
    }

    public function down(): void
    {
        $tenantSkuIndexExists = collect(DB::select("SHOW INDEX FROM `products` WHERE `Key_name` = 'products_tenant_id_sku_index'"))
            ->isNotEmpty();
        if ($tenantSkuIndexExists) {
            Schema::table('products', function (Blueprint $table): void {
                $table->dropIndex('products_tenant_id_sku_index');
            });
        }

        $tenantSkuUniqueExists = collect(DB::select("SHOW INDEX FROM `products` WHERE `Key_name` = 'products_tenant_id_sku_unique'"))
            ->isNotEmpty();
        if (! $tenantSkuUniqueExists) {
            Schema::table('products', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'sku']);
            });
        }

        Schema::table('products', function (Blueprint $table): void {
            if (Schema::hasColumn('products', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
