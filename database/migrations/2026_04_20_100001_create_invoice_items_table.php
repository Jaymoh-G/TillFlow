<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();

            $table->string('product_name');
            $table->string('product_image_url', 2048)->nullable();
            $table->text('description')->nullable();

            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);

            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['invoice_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
