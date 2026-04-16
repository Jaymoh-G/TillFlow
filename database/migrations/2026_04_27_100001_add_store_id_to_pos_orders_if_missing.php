<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pos_orders') || Schema::hasColumn('pos_orders', 'store_id')) {
            return;
        }

        Schema::table('pos_orders', function (Blueprint $table): void {
            $table->foreignId('store_id')->nullable()->after('tenant_id')->constrained('store_managers')->nullOnDelete();
            $table->index(['tenant_id', 'store_id']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('pos_orders') || ! Schema::hasColumn('pos_orders', 'store_id')) {
            return;
        }

        Schema::table('pos_orders', function (Blueprint $table): void {
            $table->dropForeign(['store_id']);
        });
    }
};
