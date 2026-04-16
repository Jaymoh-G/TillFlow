<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('quotations')) {
            return;
        }
        DB::table('quotations')->where('status', 'Pending')->update(['status' => 'Draft']);
        DB::table('quotations')->where('status', 'Ordered')->update(['status' => 'Accepted']);
    }

    public function down(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('quotations')) {
            return;
        }
        DB::table('quotations')->where('status', 'Draft')->update(['status' => 'Pending']);
        DB::table('quotations')->where('status', 'Accepted')->update(['status' => 'Ordered']);
    }
};
