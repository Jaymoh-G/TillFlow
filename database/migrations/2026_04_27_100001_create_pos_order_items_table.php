<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pos_order_id')->constrained('pos_orders')->cascadeOnDelete();

            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('sku')->nullable();
            $table->string('product_name');
            $table->text('description')->nullable();

            $table->decimal('quantity', 12, 3)->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('tax_percent', 6, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);
            $table->unsignedInteger('position')->default(0);

            $table->timestamps();

            $table->index(['tenant_id', 'pos_order_id']);
            $table->index(['tenant_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_order_items');
    }
};
