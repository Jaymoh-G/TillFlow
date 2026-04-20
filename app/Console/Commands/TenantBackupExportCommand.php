<?php

namespace App\Console\Commands;

use App\Models\BackupEvent;
use App\Services\TenantBackup\TenantBackupExporter;
use Illuminate\Console\Command;

class TenantBackupExportCommand extends Command
{
    protected $signature = 'tenant:backup-export {tenant : Tenant ID}';

    protected $description = 'Export one tenant to a zip (data.sql + files + manifest)';

    public function handle(TenantBackupExporter $exporter): int
    {
        $tenantId = (int) $this->argument('tenant');

        $this->info('Exporting tenant '.$tenantId.'...');

        $result = $exporter->exportToZip($tenantId);
        $path = $result['zip_path'];

        $this->info('Created: '.$path);

        BackupEvent::query()->create([
            'kind' => 'tenant_export',
            'status' => 'success',
            'disk_name' => 'local',
            'path' => $path,
            'size_bytes' => file_exists($path) ? filesize($path) : null,
            'tenant_id' => $tenantId,
        ]);

        return self::SUCCESS;
    }
}
