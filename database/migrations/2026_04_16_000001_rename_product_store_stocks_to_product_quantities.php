<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_store_stocks') && ! Schema::hasTable('product_quantities')) {
            Schema::rename('product_store_stocks', 'product_quantities');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_quantities') && ! Schema::hasTable('product_store_stocks')) {
            Schema::rename('product_quantities', 'product_store_stocks');
        }
    }
};
