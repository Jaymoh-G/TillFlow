<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('quote_ref', 32);
            $table->date('quoted_at');
            $table->string('product_name');
            $table->string('customer_name');
            $table->string('status', 16);
            $table->decimal('total_amount', 12, 2);
            $table->string('product_image_url', 2048)->nullable();
            $table->string('customer_image_url', 2048)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'quote_ref']);
            $table->index(['tenant_id', 'quoted_at']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotations');
    }
};
