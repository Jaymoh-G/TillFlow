<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_note_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('credit_note_id')->constrained('credit_notes')->cascadeOnDelete();
            $table->foreignId('invoice_item_id')->nullable()->constrained('invoice_items')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('uom', 64)->nullable();
            $table->decimal('qty', 12, 3)->default(0);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['credit_note_id', 'invoice_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_note_items');
    }
};
