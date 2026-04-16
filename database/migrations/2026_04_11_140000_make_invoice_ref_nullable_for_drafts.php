<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE invoices MODIFY invoice_ref VARCHAR(32) NULL');
        } else {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->string('invoice_ref', 32)->nullable()->change();
            });
        }

        DB::table('invoices')
            ->where('status', 'Draft')
            ->where('invoice_ref', 'like', 'INV-%')
            ->update(['invoice_ref' => null]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::table('invoices')->whereNull('invoice_ref')->update(['invoice_ref' => DB::raw("'DRAFT-' || id")]);
        } elseif ($driver === 'pgsql') {
            DB::table('invoices')->whereNull('invoice_ref')->update(['invoice_ref' => DB::raw("CONCAT('DRAFT-', id::text)")]);
        } else {
            DB::table('invoices')->whereNull('invoice_ref')->update(['invoice_ref' => DB::raw("CONCAT('DRAFT-', id)")]);
        }

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE invoices MODIFY invoice_ref VARCHAR(32) NOT NULL');
        } else {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->string('invoice_ref', 32)->nullable(false)->change();
            });
        }
    }
};
