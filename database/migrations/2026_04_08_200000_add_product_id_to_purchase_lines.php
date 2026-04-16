<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_lines', function (Blueprint $table): void {
            $table->foreignId('product_id')
                ->nullable()
                ->after('purchase_id')
                ->constrained('products')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_lines', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('product_id');
        });
    }
};
