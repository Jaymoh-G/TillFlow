<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_note_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('delivery_note_id')->constrained('delivery_notes')->cascadeOnDelete();
            $table->foreignId('invoice_item_id')->constrained('invoice_items')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name');
            $table->text('description')->nullable();
            $table->string('uom', 64)->nullable();
            $table->decimal('qty', 12, 3);
            $table->timestamps();

            $table->index(['delivery_note_id']);
            $table->index(['invoice_item_id']);
            $table->index(['product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_note_items');
    }
};
