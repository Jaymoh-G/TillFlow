<?php

namespace App\Console\Commands;

use App\Models\BackupEvent;
use App\Models\Tenant;
use App\Services\TenantBackup\TenantBackupExporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class TenantBackupEmailCommand extends Command
{
    protected $signature = 'tenant:backup-email';

    protected $description = 'Send scheduled tenant export zips to opted-in tenants (see ui_settings backup_email)';

    public function handle(TenantBackupExporter $exporter): int
    {
        if (! config('tenant_backup.email.enabled', false)) {
            $this->warn('TENANT_BACKUP_EMAIL_ENABLED is not true. Skipping.');

            return self::SUCCESS;
        }

        $fromAddress = config('tenant_backup.email.from_address');
        $fromName = config('tenant_backup.email.from_name');

        $count = 0;
        Tenant::query()->where('status', Tenant::STATUS_ACTIVE)->chunkById(50, function ($tenants) use ($exporter, $fromAddress, $fromName, &$count): void {
            foreach ($tenants as $tenant) {
                $settings = $tenant->ui_settings ?? [];
                if (! data_get($settings, 'backup_email.enabled')) {
                    continue;
                }
                $to = data_get($settings, 'backup_email.to');
                if (! is_string($to) || $to === '') {
                    continue;
                }

                try {
                    $result = $exporter->exportToZip((int) $tenant->id);
                    $path = $result['zip_path'];

                    Mail::send([], [], function ($message) use ($to, $path, $fromAddress, $fromName): void {
                        $message->to($to)
                            ->subject('Your '.config('app.name').' data backup')
                            ->from((string) $fromAddress, (string) $fromName)
                            ->html('<p>Your scheduled backup is attached.</p>')
                            ->attach($path);
                    });

                    BackupEvent::query()->create([
                        'kind' => 'tenant_export_email',
                        'status' => 'success',
                        'path' => $path,
                        'tenant_id' => $tenant->id,
                        'size_bytes' => file_exists($path) ? filesize($path) : null,
                    ]);
                    $count++;
                } catch (\Throwable $e) {
                    BackupEvent::query()->create([
                        'kind' => 'tenant_export_email',
                        'status' => 'failed',
                        'message' => $e->getMessage(),
                        'tenant_id' => $tenant->id,
                    ]);
                    $this->error('Tenant '.$tenant->id.': '.$e->getMessage());
                }
            }
        });

        $this->info('Sent '.$count.' backup email(s).');

        return self::SUCCESS;
    }
}
