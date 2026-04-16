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
        if (Schema::hasTable('sales_return_lines')) {
            return;
        }

        Schema::create('sales_return_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_return_id')->constrained('sales_returns')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('store_id')->constrained('store_managers')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 15, 2);
            $table->decimal('line_total', 15, 2);
            $table->string('product_name', 255)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'sales_return_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_return_lines');
    }
};
