<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tenants')) {
            return;
        }

        if (Schema::hasColumn('tenants', 'quotation_footer_payment_line')) {
            return;
        }

        // Runs before `2026_04_15_120000_add_ui_settings_to_tenants_table` — `ui_settings` does not exist yet.
        $anchor = Schema::hasColumn('tenants', 'company_postal_code') ? 'company_postal_code' : 'status';

        Schema::table('tenants', function (Blueprint $table) use ($anchor) {
            $table->text('quotation_footer_payment_line')->nullable()->after($anchor);
            $table->text('quotation_footer_bank_line')->nullable()->after('quotation_footer_payment_line');
            $table->text('quotation_footer_closing_line')->nullable()->after('quotation_footer_bank_line');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tenants')) {
            return;
        }

        if (! Schema::hasColumn('tenants', 'quotation_footer_payment_line')) {
            return;
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'quotation_footer_payment_line',
                'quotation_footer_bank_line',
                'quotation_footer_closing_line',
            ]);
        });
    }
};
