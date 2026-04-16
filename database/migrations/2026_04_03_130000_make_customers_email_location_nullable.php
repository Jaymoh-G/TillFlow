<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * MySQL utf8mb4: a UNIQUE on (tenant_id, email) with VARCHAR(255) email exceeds the default 1000-byte index limit.
 * We drop that index, allow NULL on email/location, then recreate uniqueness using a prefix on email: email(191).
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

        $needsNullable = ! $this->columnIsNullable('customers', 'email')
            || ! $this->columnIsNullable('customers', 'location');

        if ($needsNullable) {
            $this->dropTenantEmailUniqueIndex();
            DB::statement('ALTER TABLE customers MODIFY email VARCHAR(255) NULL, MODIFY location VARCHAR(255) NULL');
        }

        if (! $this->tenantEmailUniqueIndexExists()) {
            DB::statement('CREATE UNIQUE INDEX customers_tenant_id_email_unique ON customers (tenant_id, email(191))');
        }
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

        $this->dropTenantEmailUniqueIndex();

        DB::statement('UPDATE customers SET email = \'missing@invalid.local\' WHERE email IS NULL');
        DB::statement('UPDATE customers SET location = \'\' WHERE location IS NULL');
        DB::statement('ALTER TABLE customers MODIFY email VARCHAR(255) NOT NULL, MODIFY location VARCHAR(255) NOT NULL');

        DB::statement('CREATE UNIQUE INDEX customers_tenant_id_email_unique ON customers (tenant_id, email(191))');
    }

    private function columnIsNullable(string $table, string $column): bool
    {
        $database = DB::connection()->getDatabaseName();
        $row = DB::selectOne(
            'SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$database, $table, $column]
        );

        return $row && strtoupper((string) $row->nullable) === 'YES';
    }

    private function dropTenantEmailUniqueIndex(): void
    {
        $indexName = $this->findTenantEmailUniqueIndexName();
        if ($indexName === null) {
            return;
        }

        DB::statement('ALTER TABLE customers DROP INDEX `'.str_replace('`', '``', $indexName).'`');
    }

    private function findTenantEmailUniqueIndexName(): ?string
    {
        $database = DB::connection()->getDatabaseName();
        $candidates = DB::select(
            'SELECT INDEX_NAME AS name FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME <> ? AND NON_UNIQUE = 0
             GROUP BY INDEX_NAME',
            [$database, 'customers', 'PRIMARY']
        );

        foreach ($candidates as $c) {
            $name = $c->name;
            $cols = DB::select(
                'SELECT COLUMN_NAME FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
                 ORDER BY SEQ_IN_INDEX',
                [$database, 'customers', $name]
            );
            $ordered = array_map(fn ($r) => $r->COLUMN_NAME, $cols);
            if ($ordered === ['tenant_id', 'email']) {
                return $name;
            }
        }

        return null;
    }

    private function tenantEmailUniqueIndexExists(): bool
    {
        return $this->findTenantEmailUniqueIndexName() !== null;
    }
};
