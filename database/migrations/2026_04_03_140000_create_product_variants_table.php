<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('variant_attribute_id')->constrained()->cascadeOnDelete();
            $table->string('value');
            $table->string('sku')->nullable()->index();
            $table->unsignedInteger('qty')->default(0);
            $table->decimal('price', 12, 2)->nullable();
            $table->string('image_path', 2048)->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'variant_attribute_id', 'value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
