<?php

namespace App\Providers;

use App\Models\BackupEvent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Spatie\Backup\Events\BackupHasFailed;
use Spatie\Backup\Events\BackupWasSuccessful;
use Spatie\Backup\Events\CleanupHasFailed;
use Spatie\Backup\Events\CleanupWasSuccessful;
use Spatie\Backup\Events\UnhealthyBackupWasFound;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Avoid "Specified key was too long" on MySQL/MariaDB with utf8mb4 + unique indexes.
        Schema::defaultStringLength(191);

        $this->registerBackupEventLogging();
    }

    private function registerBackupEventLogging(): void
    {
        Event::listen(BackupWasSuccessful::class, function (BackupWasSuccessful $e): void {
            if (! Schema::hasTable('backup_events')) {
                return;
            }
            BackupEvent::query()->create([
                'kind' => 'full_backup_success',
                'status' => 'success',
                'disk_name' => $e->backupDestination->diskName(),
            ]);
        });

        Event::listen(BackupHasFailed::class, function (BackupHasFailed $e): void {
            if (! Schema::hasTable('backup_events')) {
                return;
            }
            BackupEvent::query()->create([
                'kind' => 'full_backup_failed',
                'status' => 'failed',
                'disk_name' => $e->backupDestination?->diskName(),
                'message' => $e->exception->getMessage(),
            ]);
        });

        Event::listen(CleanupWasSuccessful::class, function (CleanupWasSuccessful $e): void {
            if (! Schema::hasTable('backup_events')) {
                return;
            }
            BackupEvent::query()->create([
                'kind' => 'backup_cleanup_success',
                'status' => 'success',
                'disk_name' => $e->backupDestination->diskName(),
            ]);
        });

        Event::listen(CleanupHasFailed::class, function (CleanupHasFailed $e): void {
            if (! Schema::hasTable('backup_events')) {
                return;
            }
            BackupEvent::query()->create([
                'kind' => 'backup_cleanup_failed',
                'status' => 'failed',
                'disk_name' => $e->backupDestination?->diskName(),
                'message' => $e->exception->getMessage(),
            ]);
        });

        Event::listen(UnhealthyBackupWasFound::class, function (UnhealthyBackupWasFound $e): void {
            if (! Schema::hasTable('backup_events')) {
                return;
            }
            $dest = $e->backupDestinationStatus->backupDestination();
            $failure = $e->backupDestinationStatus->getHealthCheckFailure();
            BackupEvent::query()->create([
                'kind' => 'backup_unhealthy',
                'status' => 'failed',
                'disk_name' => $dest->diskName(),
                'message' => $failure ? $failure->exception()->getMessage() : null,
            ]);
        });
    }
}
