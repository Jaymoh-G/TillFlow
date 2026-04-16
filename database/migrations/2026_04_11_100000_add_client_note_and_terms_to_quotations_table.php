<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->text('client_note')->nullable()->after('customer_image_url');
            $table->text('terms_and_conditions')->nullable()->after('client_note');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropColumn(['client_note', 'terms_and_conditions']);
        });
    }
};
