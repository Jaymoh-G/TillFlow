<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->foreignId('product_id')
                ->nullable()
                ->after('quoted_at')
                ->constrained('products')
                ->nullOnDelete();
            $table->foreignId('customer_id')
                ->nullable()
                ->after('product_id')
                ->constrained('customers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['customer_id']);
        });
    }
};
