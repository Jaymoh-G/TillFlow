<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sales_returns')) {
            return;
        }

        Schema::table('sales_returns', function (Blueprint $table): void {
            if (! Schema::hasColumn('sales_returns', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('invoice_id')->constrained('products')->nullOnDelete();
            }
            if (! Schema::hasColumn('sales_returns', 'store_id')) {
                $table->foreignId('store_id')->nullable()->after('product_id')->constrained('store_managers')->nullOnDelete();
            }
            if (! Schema::hasColumn('sales_returns', 'quantity')) {
                $table->unsignedInteger('quantity')->nullable()->after('product_name');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('sales_returns')) {
            return;
        }

        Schema::table('sales_returns', function (Blueprint $table): void {
            if (Schema::hasColumn('sales_returns', 'quantity')) {
                $table->dropColumn('quantity');
            }
            if (Schema::hasColumn('sales_returns', 'store_id')) {
                $table->dropForeign(['store_id']);
                $table->dropColumn('store_id');
            }
            if (Schema::hasColumn('sales_returns', 'product_id')) {
                $table->dropForeign(['product_id']);
                $table->dropColumn('product_id');
            }
        });
    }
};
