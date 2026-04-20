<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tenants') && ! Schema::hasColumn('tenants', 'ui_settings')) {
            Schema::table('tenants', function (Blueprint $table): void {
                $table->json('ui_settings')->nullable()->after('slug');
            });
        }

        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table): void {
                if (! Schema::hasColumn('invoices', 'due_reminder_email_sent_at')) {
                    $table->timestamp('due_reminder_email_sent_at')->nullable();
                }
                if (! Schema::hasColumn('invoices', 'due_reminder_sms_sent_at')) {
                    $table->timestamp('due_reminder_sms_sent_at')->nullable();
                }
                if (! Schema::hasColumn('invoices', 'overdue_notice_email_sent_at')) {
                    $table->timestamp('overdue_notice_email_sent_at')->nullable();
                }
                if (! Schema::hasColumn('invoices', 'overdue_notice_sms_sent_at')) {
                    $table->timestamp('overdue_notice_sms_sent_at')->nullable();
                }
                if (! Schema::hasColumn('invoices', 'overdue_last_resent_email_at')) {
                    $table->timestamp('overdue_last_resent_email_at')->nullable();
                }
                if (! Schema::hasColumn('invoices', 'overdue_last_resent_sms_at')) {
                    $table->timestamp('overdue_last_resent_sms_at')->nullable();
                }
            });
        }

        if (Schema::hasTable('quotations')) {
            Schema::table('quotations', function (Blueprint $table): void {
                if (! Schema::hasColumn('quotations', 'expiry_reminder_email_sent_at')) {
                    $table->timestamp('expiry_reminder_email_sent_at')->nullable();
                }
                if (! Schema::hasColumn('quotations', 'expiry_reminder_sms_sent_at')) {
                    $table->timestamp('expiry_reminder_sms_sent_at')->nullable();
                }
            });
        }

        if (Schema::hasTable('proposals')) {
            Schema::table('proposals', function (Blueprint $table): void {
                if (! Schema::hasColumn('proposals', 'expiry_reminder_email_sent_at')) {
                    $table->timestamp('expiry_reminder_email_sent_at')->nullable();
                }
                if (! Schema::hasColumn('proposals', 'expiry_reminder_sms_sent_at')) {
                    $table->timestamp('expiry_reminder_sms_sent_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table): void {
                foreach ([
                    'due_reminder_email_sent_at',
                    'due_reminder_sms_sent_at',
                    'overdue_notice_email_sent_at',
                    'overdue_notice_sms_sent_at',
                    'overdue_last_resent_email_at',
                    'overdue_last_resent_sms_at',
                ] as $col) {
                    if (Schema::hasColumn('invoices', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('quotations')) {
            Schema::table('quotations', function (Blueprint $table): void {
                foreach (['expiry_reminder_email_sent_at', 'expiry_reminder_sms_sent_at'] as $col) {
                    if (Schema::hasColumn('quotations', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('proposals')) {
            Schema::table('proposals', function (Blueprint $table): void {
                foreach (['expiry_reminder_email_sent_at', 'expiry_reminder_sms_sent_at'] as $col) {
                    if (Schema::hasColumn('proposals', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('tenants') && Schema::hasColumn('tenants', 'ui_settings')) {
            Schema::table('tenants', function (Blueprint $table): void {
                $table->dropColumn('ui_settings');
            });
        }
    }
};
