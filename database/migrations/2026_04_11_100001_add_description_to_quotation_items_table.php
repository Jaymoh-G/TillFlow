<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            $table->text('description')->nullable()->after('product_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            $table->dropColumn('description');
        });
    }
};
