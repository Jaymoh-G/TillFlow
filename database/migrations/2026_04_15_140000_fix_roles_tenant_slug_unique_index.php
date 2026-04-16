<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Older installs used `roles.slug` UNIQUE alone. Multitenant seeding needs the same slug per tenant
 * (e.g. owner, admin), matching {@see \Database\Seeders\RolesAndPermissionsSeeder} firstOrCreate keys.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasColumn('roles', 'tenant_id')) {
            return;
        }

        try {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropUnique(['slug']);
            });
        } catch (\Throwable) {
            // No single-column unique on slug (e.g. already fixed or SQLite test DB).
        }

        try {
            Schema::table('roles', function (Blueprint $table) {
                $table->unique(['tenant_id', 'slug'], 'roles_tenant_id_slug_unique');
            });
        } catch (\Throwable $e) {
            if (! $this->isDuplicateIndexMessage($e)) {
                throw $e;
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        try {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropUnique('roles_tenant_id_slug_unique');
            });
        } catch (\Throwable) {
            //
        }

        try {
            Schema::table('roles', function (Blueprint $table) {
                $table->unique('slug');
            });
        } catch (\Throwable) {
            //
        }
    }

    private function isDuplicateIndexMessage(\Throwable $e): bool
    {
        $m = $e->getMessage();

        return str_contains($m, 'Duplicate key name')
            || str_contains($m, 'already exists')
            || str_contains($m, 'UNIQUE constraint failed');
    }
};
