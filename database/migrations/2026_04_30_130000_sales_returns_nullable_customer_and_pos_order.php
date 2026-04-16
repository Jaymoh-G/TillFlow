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
            if (Schema::hasColumn('sales_returns', 'customer_id')) {
                $table->dropForeign(['customer_id']);
            }
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->unsignedBigInteger('customer_id')->nullable()->change();
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
        });

        if (Schema::hasTable('pos_orders') && ! Schema::hasColumn('sales_returns', 'pos_order_id')) {
            Schema::table('sales_returns', function (Blueprint $table): void {
                $table->foreignId('pos_order_id')->nullable()->after('invoice_id')->constrained('pos_orders')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('sales_returns')) {
            return;
        }

        if (Schema::hasColumn('sales_returns', 'pos_order_id')) {
            Schema::table('sales_returns', function (Blueprint $table): void {
                $table->dropForeign(['pos_order_id']);
                $table->dropColumn('pos_order_id');
            });
        }

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->dropForeign(['customer_id']);
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->unsignedBigInteger('customer_id')->nullable(false)->change();
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });
    }
};
