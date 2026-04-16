<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            $table->decimal('tax_percent', 5, 2)->default(0)->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            $table->dropColumn('tax_percent');
        });
    }
};
