<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->date('manufactured_at')->nullable()->after('qty_alert');
            $table->date('expires_at')->nullable()->after('manufactured_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['manufactured_at', 'expires_at']);
        });
    }
};
