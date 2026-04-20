<?php

namespace App\Services\TenantBackup;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use ZipArchive;

class TenantBackupImporter
{
    /**
     * Import a tenant export zip produced by {@see TenantBackupExporter}.
     * Intended for empty/staging databases or controlled maintenance windows.
     */
    public function importFromZip(string $zipPath): void
    {
        if (! File::exists($zipPath)) {
            throw new \InvalidArgumentException('Zip not found: '.$zipPath);
        }

        $temp = storage_path('app/tenant-backup-temp/import-'.uniqid('', true));
        File::ensureDirectoryExists($temp);

        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new \InvalidArgumentException('Cannot open zip: '.$zipPath);
        }
        $zip->extractTo($temp);
        $zip->close();

        $sqlPath = $temp.'/data.sql';
        if (! File::exists($sqlPath)) {
            File::deleteDirectory($temp);

            throw new \InvalidArgumentException('Missing data.sql in archive.');
        }

        $sql = File::get($sqlPath);
        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::connection()->getPdo()->exec($sql);
        } else {
            foreach (preg_split('/;\s*\R/', $sql) as $statement) {
                $statement = trim($statement);
                if ($statement === '' || str_starts_with($statement, '--')) {
                    continue;
                }
                DB::unprepared($statement);
            }
        }

        $filesRoot = $temp.'/files';
        if (File::isDirectory($filesRoot)) {
            File::copyDirectory($filesRoot, storage_path('app/public'));
        }

        File::deleteDirectory($temp);
    }
}
