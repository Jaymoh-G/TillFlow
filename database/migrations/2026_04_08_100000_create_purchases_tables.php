<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference', 120);
            $table->date('purchase_date');
            $table->string('status', 32);
            $table->decimal('order_tax', 15, 2)->default(0);
            $table->decimal('order_discount', 15, 2)->default(0);
            $table->decimal('shipping', 15, 2)->default(0);
            $table->text('description')->nullable();
            $table->decimal('grand_total', 15, 2);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('due_amount', 15, 2);
            $table->string('payment_status', 24)->default('Unpaid');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'purchase_date']);
        });

        Schema::create('purchase_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('product_name', 255);
            $table->decimal('qty', 15, 3);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_percent', 8, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_lines');
        Schema::dropIfExists('purchases');
    }
};
