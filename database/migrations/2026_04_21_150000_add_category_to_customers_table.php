<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            if (! Schema::hasColumn('customers', 'category')) {
                if (Schema::hasColumn('customers', 'tax_id')) {
                    $table->string('category', 255)->nullable()->after('tax_id');
                } else {
                    $table->string('category', 255)->nullable();
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            if (Schema::hasColumn('customers', 'category')) {
                $table->dropColumn('category');
            }
        });
    }
};
