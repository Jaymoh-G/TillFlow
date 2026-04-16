<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices') || Schema::hasColumn('invoices', 'sent_to_customer_at')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->timestamp('sent_to_customer_at')->nullable()->after('status');
        });

        if (Schema::hasColumn('invoices', 'sent_to_customer_at')) {
            DB::table('invoices')
                ->whereNull('deleted_at')
                ->where('status', '!=', 'Draft')
                ->whereNull('sent_to_customer_at')
                ->update(['sent_to_customer_at' => DB::raw('updated_at')]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices') || ! Schema::hasColumn('invoices', 'sent_to_customer_at')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropColumn('sent_to_customer_at');
        });
    }
};
