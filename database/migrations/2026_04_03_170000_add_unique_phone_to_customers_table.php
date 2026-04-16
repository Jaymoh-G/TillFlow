<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tenant-scoped unique phone (MySQL/MariaDB). SQLite gets the same index from 2026_04_03_120000_create_customers_table.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        if ($this->tenantPhoneUniqueIndexExists()) {
            return;
        }

        $this->dedupeTenantPhones();

        DB::statement('CREATE UNIQUE INDEX customers_tenant_id_phone_unique ON customers (tenant_id, phone)');
    }

    public function down(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        if ($this->tenantPhoneUniqueIndexExists()) {
            DB::statement('ALTER TABLE customers DROP INDEX `customers_tenant_id_phone_unique`');
        }
    }

    private function tenantPhoneUniqueIndexExists(): bool
    {
        $database = DB::connection()->getDatabaseName();
        $row = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
             LIMIT 1',
            [$database, 'customers', 'customers_tenant_id_phone_unique']
        );

        return $row !== null;
    }

    /**
     * Make (tenant_id, phone) pairs unique by appending "-{id}" to duplicates (keeps lowest id per group).
     */
    private function dedupeTenantPhones(): void
    {
        DB::statement(
            'UPDATE customers AS c
             INNER JOIN (
               SELECT tenant_id, phone, MIN(id) AS keep_id
               FROM customers
               GROUP BY tenant_id, phone
               HAVING COUNT(*) > 1
             ) AS d
               ON c.tenant_id = d.tenant_id AND c.phone = d.phone AND c.id != d.keep_id
             SET c.phone = LEFT(CONCAT(c.phone, "-", c.id), 64)'
        );
    }
};
