<?php

namespace App\Services\TenantBackup;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantTableScanner
{
    /**
     * @return list<string>
     */
    public function tablesWithTenantIdColumn(): array
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $database = $connection->getDatabaseName();
            $rows = DB::select(
                'SELECT TABLE_NAME AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = ?',
                [$database, 'tenant_id']
            );

            return collect($rows)->pluck('t')->map(fn ($t) => (string) $t)->unique()->values()->all();
        }

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        $out = [];
        foreach ($tables as $row) {
            $name = $row->name;
            if (in_array('tenant_id', Schema::getColumnListing($name), true)) {
                $out[] = $name;
            }
        }

        return $out;
    }

    public function hasColumn(string $table, string $column): bool
    {
        return in_array($column, Schema::getColumnListing($table), true);
    }

    public function hasTable(string $table): bool
    {
        return Schema::hasTable($table);
    }
}
