<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('buying_price', 12, 2)->nullable()->after('expires_at');
            $table->decimal('selling_price', 12, 2)->nullable()->after('buying_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['buying_price', 'selling_price']);
        });
    }
};
