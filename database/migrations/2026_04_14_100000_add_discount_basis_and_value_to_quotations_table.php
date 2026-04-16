<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->string('discount_basis', 16)->default('percent')->after('discount_type');
            $table->decimal('discount_value', 12, 2)->nullable()->after('discount_basis');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn(['discount_basis', 'discount_value']);
        });
    }
};
