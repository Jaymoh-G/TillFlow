<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->softDeletes();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropUnique(['tenant_id', 'sku']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->index(['tenant_id', 'sku']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'sku']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->unique(['tenant_id', 'sku']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });
    }
};
