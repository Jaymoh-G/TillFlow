<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_transfers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_store_id')->constrained('store_managers')->restrictOnDelete();
            $table->foreignId('to_store_id')->constrained('store_managers')->restrictOnDelete();
            $table->string('ref_number', 120);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('stock_transfer_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedInteger('qty');
            $table->timestamps();

            $table->index(['stock_transfer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_lines');
        Schema::dropIfExists('stock_transfers');
    }
};
