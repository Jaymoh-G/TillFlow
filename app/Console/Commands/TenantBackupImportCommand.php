<?php

namespace App\Console\Commands;

use App\Services\TenantBackup\TenantBackupImporter;
use Illuminate\Console\Command;

class TenantBackupImportCommand extends Command
{
    protected $signature = 'tenant:backup-import {path : Absolute path to tenant export zip}';

    protected $description = 'Import tenant export (SQL + files) — use on staging or empty DB only';

    public function handle(TenantBackupImporter $importer): int
    {
        $path = $this->argument('path');
        if (! is_string($path) || ! is_file($path)) {
            $this->error('File not found: '.(string) $path);

            return self::FAILURE;
        }

        if (! $this->confirm('This will run SQL against the current database connection. Continue?')) {
            return self::SUCCESS;
        }

        $this->info('Importing...');
        $importer->importFromZip($path);
        $this->info('Done.');

        return self::SUCCESS;
    }
}
