<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'is_platform_owner')) {
                $table->boolean('is_platform_owner')->default(false)->after('tenant_id');
            }
        });

        if (Schema::hasColumn('users', 'tenant_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->unsignedBigInteger('tenant_id')->nullable()->change();
            });
        }

        Schema::table('tenants', function (Blueprint $table): void {
            if (! Schema::hasColumn('tenants', 'status')) {
                $table->string('status', 32)->default('active')->after('slug');
            }
            if (! Schema::hasColumn('tenants', 'suspended_reason')) {
                $table->text('suspended_reason')->nullable()->after('status');
            }
            if (! Schema::hasColumn('tenants', 'last_active_at')) {
                $table->timestamp('last_active_at')->nullable()->after('suspended_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            if (Schema::hasColumn('tenants', 'last_active_at')) {
                $table->dropColumn('last_active_at');
            }
            if (Schema::hasColumn('tenants', 'suspended_reason')) {
                $table->dropColumn('suspended_reason');
            }
            if (Schema::hasColumn('tenants', 'status')) {
                $table->dropColumn('status');
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'is_platform_owner')) {
                $table->dropColumn('is_platform_owner');
            }
        });
    }
};
