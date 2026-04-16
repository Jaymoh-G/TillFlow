<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchase_returns') || ! Schema::hasColumn('purchase_returns', 'status')) {
            return;
        }

        Schema::table('purchase_returns', function (Blueprint $table): void {
            $table->string('status', 30)->default('Returned')->change();
        });

        DB::table('purchase_returns')
            ->whereNull('status')
            ->orWhere('status', '')
            ->update(['status' => 'Returned']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('purchase_returns') || ! Schema::hasColumn('purchase_returns', 'status')) {
            return;
        }

        Schema::table('purchase_returns', function (Blueprint $table): void {
            $table->string('status', 30)->default('Pending')->change();
        });
    }
};
