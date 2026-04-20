<?php

namespace App\Services\TenantBackup;

use App\Models\Tenant;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ZipArchive;

class TenantBackupExporter
{
    public function __construct(
        protected TenantTableScanner $scanner,
        protected TenantSqlWriter $writer,
        protected TenantFilePathCollector $filePathCollector,
    ) {}

    /**
     * @return array{zip_path: string, manifest: array<string, mixed>}
     */
    public function exportToZip(int $tenantId): array
    {
        Tenant::query()->findOrFail($tenantId);

        $temp = storage_path('app/tenant-backup-temp/'.Str::uuid()->toString());
        File::ensureDirectoryExists($temp);
        File::ensureDirectoryExists($temp.'/files');

        $sql = $this->buildSql($tenantId);
        File::put($temp.'/data.sql', $sql);

        $fileCount = $this->filePathCollector->copyInto($temp.'/files', $tenantId);

        $manifest = [
            'tenant_id' => $tenantId,
            'exported_at' => now()->toIso8601String(),
            'app_version' => (string) config('app.version', 'unknown'),
            'file_count' => $fileCount,
            'laravel_version' => app()->version(),
            'sql_bytes' => strlen($sql),
        ];
        File::put($temp.'/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        File::ensureDirectoryExists(storage_path('app/tenant-exports'));

        $zipPath = storage_path('app/tenant-exports/tenant-'.$tenantId.'-'.now()->format('Y-m-d-His').'.zip');
        $this->zipDirectory($temp, $zipPath);

        File::deleteDirectory($temp);

        return ['zip_path' => $zipPath, 'manifest' => $manifest];
    }

    public function buildSql(int $tenantId): string
    {
        $conn = DB::connection();
        $driver = $conn->getDriverName();
        $sql = '';

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $sql .= "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n";
        } elseif ($driver === 'sqlite') {
            $sql .= "PRAGMA foreign_keys=OFF;\n";
        }

        $sql .= $this->dumpQuery('tenants', $conn->table('tenants')->where('id', $tenantId));

        if (Schema::hasTable('tenant_subscriptions')) {
            $planIds = $conn->table('tenant_subscriptions')->where('tenant_id', $tenantId)->pluck('plan_id')->unique()->filter();
            if ($planIds->isNotEmpty() && Schema::hasTable('plans')) {
                $sql .= $this->dumpQuery('plans', $conn->table('plans')->whereIn('id', $planIds));
            }
        }

        foreach (config('tenant_backup.global_full_tables', []) as $table) {
            if (! $this->scanner->hasTable($table)) {
                continue;
            }
            $sql .= $this->dumpQuery($table, $conn->table($table));
        }

        $exclude = array_merge(config('tenant_backup.exclude_tenant_tables', []), ['tenants']);
        $indirectNames = collect(config('tenant_backup.indirect_tables'))->pluck('table')->all();

        foreach ($this->scanner->tablesWithTenantIdColumn() as $table) {
            if (in_array($table, $exclude, true)) {
                continue;
            }
            if (in_array($table, $indirectNames, true)) {
                continue;
            }
            $sql .= $this->dumpQuery($table, $conn->table($table)->where('tenant_id', $tenantId));
        }

        foreach (config('tenant_backup.indirect_tables', []) as $def) {
            $table = $def['table'];
            if (! $this->scanner->hasTable($table)) {
                continue;
            }
            if ($this->scanner->hasColumn($table, 'tenant_id')) {
                $sql .= $this->dumpQuery($table, $conn->table($table)->where('tenant_id', $tenantId));

                continue;
            }
            $parent = $def['parent'];
            $fk = $def['foreign_key'];
            if (! $this->scanner->hasTable($parent)) {
                continue;
            }
            $ids = $conn->table($parent)->where('tenant_id', $tenantId)->pluck('id');
            if ($ids->isEmpty()) {
                continue;
            }
            $sql .= $this->dumpQuery($table, $conn->table($table)->whereIn($fk, $ids));
        }

        if ($this->scanner->hasTable('permission_role')) {
            $roleIds = $conn->table('roles')->where('tenant_id', $tenantId)->pluck('id');
            if ($roleIds->isNotEmpty()) {
                $sql .= $this->dumpQuery('permission_role', $conn->table('permission_role')->whereIn('role_id', $roleIds));
            }
        }

        if ($this->scanner->hasTable('role_user')) {
            $userIds = $conn->table('users')->where('tenant_id', $tenantId)->pluck('id');
            $roleIds = $conn->table('roles')->where('tenant_id', $tenantId)->pluck('id');
            if ($userIds->isNotEmpty() || $roleIds->isNotEmpty()) {
                $sql .= $this->dumpQuery(
                    'role_user',
                    $conn->table('role_user')->where(function ($q) use ($userIds, $roleIds): void {
                        if ($userIds->isNotEmpty() && $roleIds->isNotEmpty()) {
                            $q->whereIn('user_id', $userIds)->orWhereIn('role_id', $roleIds);
                        } elseif ($userIds->isNotEmpty()) {
                            $q->whereIn('user_id', $userIds);
                        } else {
                            $q->whereIn('role_id', $roleIds);
                        }
                    })
                );
            }
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
        } elseif ($driver === 'sqlite') {
            $sql .= "PRAGMA foreign_keys=ON;\n";
        }

        return $sql;
    }

    /**
     * @param  Builder  $query
     */
    protected function dumpQuery(string $table, $query): string
    {
        if (! Schema::hasTable($table)) {
            return '';
        }

        $columns = Schema::getColumnListing($table);
        $out = '';
        foreach ($query->cursor() as $row) {
            $out .= $this->writer->insertRowsSql($table, $columns, [$row]);
        }

        return $out;
    }

    private function zipDirectory(string $source, string $zipPath): void
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Unable to create zip: '.$zipPath);
        }

        $real = realpath($source);
        if ($real === false) {
            throw new \RuntimeException('Invalid export path: '.$source);
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($real, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $path = $file->getRealPath();
            $relative = substr($path, strlen($real) + 1);
            $zip->addFile($path, str_replace('\\', '/', $relative));
        }

        $zip->close();
    }
}
