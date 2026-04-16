<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices')) {
            return;
        }

        DB::table('invoices')->where('status', 'Sent')->update(['status' => 'Unpaid']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices')) {
            return;
        }

        DB::table('invoices')
            ->where('status', 'Unpaid')
            ->whereNotNull('sent_to_customer_at')
            ->update(['status' => 'Sent']);
    }
};
