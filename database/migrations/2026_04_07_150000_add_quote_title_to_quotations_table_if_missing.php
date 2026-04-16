<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds quote_title after quotations table exists (see 2026_04_06_120000 which may no-op when
 * quotations is created later).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('quotations') || Schema::hasColumn('quotations', 'quote_title')) {
            return;
        }

        Schema::table('quotations', function (Blueprint $table): void {
            $table->string('quote_title', 500)->nullable()->after('quote_ref');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('quotations') || ! Schema::hasColumn('quotations', 'quote_title')) {
            return;
        }

        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropColumn('quote_title');
        });
    }
};
