<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_adjustments')) {
            Schema::create('stock_adjustments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->foreignId('store_id')->nullable()->constrained('store_managers')->restrictOnDelete();
                $table->string('type', 16);
                $table->unsignedInteger('quantity');
                $table->integer('qty_before');
                $table->integer('qty_after');
                $table->string('reference', 120)->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['tenant_id', 'created_at']);
            });
        } elseif (! Schema::hasColumn('stock_adjustments', 'store_id')) {
            Schema::table('stock_adjustments', function (Blueprint $table): void {
                $table->foreignId('store_id')->nullable()->after('product_id')->constrained('store_managers')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_adjustments') && Schema::hasColumn('stock_adjustments', 'store_id')) {
            Schema::table('stock_adjustments', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('store_id');
            });
        }
    }
};
