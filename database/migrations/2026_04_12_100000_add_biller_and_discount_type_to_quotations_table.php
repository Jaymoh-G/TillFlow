<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->foreignId('biller_id')
                ->nullable()
                ->after('customer_id')
                ->constrained('billers')
                ->nullOnDelete();
            $table->string('biller_name', 255)->nullable()->after('biller_id');
            $table->string('discount_type', 24)->default('none')->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropForeign(['biller_id']);
            $table->dropColumn(['biller_id', 'biller_name', 'discount_type']);
        });
    }
};
