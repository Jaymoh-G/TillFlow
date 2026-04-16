<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('company_email')->nullable()->after('status');
            $table->string('company_phone', 64)->nullable()->after('company_email');
            $table->string('company_fax', 64)->nullable()->after('company_phone');
            $table->string('company_website', 512)->nullable()->after('company_fax');
            $table->text('company_address_line')->nullable()->after('company_website');
            $table->string('company_country', 32)->nullable()->after('company_address_line');
            $table->string('company_state', 64)->nullable()->after('company_country');
            $table->string('company_city', 64)->nullable()->after('company_state');
            $table->string('company_postal_code', 32)->nullable()->after('company_city');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropColumn([
                'company_email',
                'company_phone',
                'company_fax',
                'company_website',
                'company_address_line',
                'company_country',
                'company_state',
                'company_city',
                'company_postal_code',
            ]);
        });
    }
};
