<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        if (! Schema::hasColumn('roles', 'tenant_id')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->unsignedBigInteger('tenant_id')->nullable()->after('id')->index();
            });

            $tenantId = null;
            if (Schema::hasTable('users') && Schema::hasColumn('users', 'tenant_id')) {
                $tenantId = DB::table('users')->whereNotNull('tenant_id')->value('tenant_id');
            }
            if ($tenantId === null && Schema::hasTable('tenants')) {
                $tenantId = DB::table('tenants')->orderBy('id')->value('id');
            }
            if ($tenantId === null) {
                $tenantId = 1;
            }

            DB::table('roles')->whereNull('tenant_id')->update(['tenant_id' => $tenantId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('roles') && Schema::hasColumn('roles', 'tenant_id')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->dropColumn('tenant_id');
            });
        }
    }
};
