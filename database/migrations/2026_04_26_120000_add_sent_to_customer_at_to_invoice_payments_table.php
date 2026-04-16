<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('invoice_payments', 'sent_to_customer_at')) {
                $table->timestamp('sent_to_customer_at')->nullable()->after('transaction_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table): void {
            if (Schema::hasColumn('invoice_payments', 'sent_to_customer_at')) {
                $table->dropColumn('sent_to_customer_at');
            }
        });
    }
};
