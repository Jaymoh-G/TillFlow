<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('price_amount', 12, 2)->default(0);
            $table->string('currency', 8)->default('KES');
            $table->string('billing_interval', 16)->default('month');
            $table->json('allowed_permission_slugs')->nullable();
            $table->json('features')->nullable();
            $table->unsignedInteger('included_stores')->default(1);
            $table->unsignedInteger('max_stores')->nullable();
            $table->decimal('extra_store_price_amount', 12, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
