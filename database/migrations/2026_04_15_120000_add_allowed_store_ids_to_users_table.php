<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'allowed_store_ids')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->json('allowed_store_ids')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'allowed_store_ids')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('allowed_store_ids');
            });
        }
    }
};
