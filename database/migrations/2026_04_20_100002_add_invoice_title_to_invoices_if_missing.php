<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds invoice_title after invoices table exists (see 2026_04_09_120000 which may no-op early).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices') || Schema::hasColumn('invoices', 'invoice_title')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->string('invoice_title', 255)->nullable()->after('invoice_ref');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices') || ! Schema::hasColumn('invoices', 'invoice_title')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropColumn('invoice_title');
        });
    }
};
