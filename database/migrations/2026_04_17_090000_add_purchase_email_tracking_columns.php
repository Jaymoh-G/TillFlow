<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchases')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table): void {
            if (! Schema::hasColumn('purchases', 'last_sent_to')) {
                $table->string('last_sent_to')->nullable()->after('payment_status');
            }
            if (! Schema::hasColumn('purchases', 'last_sent_cc')) {
                $table->text('last_sent_cc')->nullable()->after('last_sent_to');
            }
            if (! Schema::hasColumn('purchases', 'last_sent_at')) {
                $table->dateTime('last_sent_at')->nullable()->after('last_sent_cc');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('purchases')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table): void {
            $drops = [];
            if (Schema::hasColumn('purchases', 'last_sent_at')) {
                $drops[] = 'last_sent_at';
            }
            if (Schema::hasColumn('purchases', 'last_sent_cc')) {
                $drops[] = 'last_sent_cc';
            }
            if (Schema::hasColumn('purchases', 'last_sent_to')) {
                $drops[] = 'last_sent_to';
            }
            if (! empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};
