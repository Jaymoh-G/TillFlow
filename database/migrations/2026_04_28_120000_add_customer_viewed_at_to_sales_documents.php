<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('invoices') && ! Schema::hasColumn('invoices', 'customer_viewed_at')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->timestamp('customer_viewed_at')->nullable()->after('sent_to_customer_at');
            });
        }
        if (Schema::hasTable('quotations') && ! Schema::hasColumn('quotations', 'customer_viewed_at')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->timestamp('customer_viewed_at')->nullable()->after('terms_and_conditions');
            });
        }
        if (Schema::hasTable('proposals') && ! Schema::hasColumn('proposals', 'customer_viewed_at')) {
            Schema::table('proposals', function (Blueprint $table) {
                $table->timestamp('customer_viewed_at')->nullable()->after('terms_and_conditions');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'customer_viewed_at')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropColumn('customer_viewed_at');
            });
        }
        if (Schema::hasColumn('quotations', 'customer_viewed_at')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->dropColumn('customer_viewed_at');
            });
        }
        if (Schema::hasColumn('proposals', 'customer_viewed_at')) {
            Schema::table('proposals', function (Blueprint $table) {
                $table->dropColumn('customer_viewed_at');
            });
        }
    }
};
