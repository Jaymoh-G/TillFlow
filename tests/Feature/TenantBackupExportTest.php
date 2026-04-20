<?php

namespace Tests\Feature;

use App\Models\BackupEvent;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class TenantBackupExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_backup_export_creates_zip_and_records_event(): void
    {
        $tenant = Tenant::query()->create([
            'name' => 'T',
            'slug' => 't-'.uniqid(),
        ]);

        $this->artisan('tenant:backup-export', ['tenant' => (string) $tenant->id])
            ->assertExitCode(0);

        $this->assertDatabaseHas('backup_events', [
            'tenant_id' => $tenant->id,
            'kind' => 'tenant_export',
            'status' => 'success',
        ]);

        $event = BackupEvent::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->assertNotNull($event->path);
        $this->assertFileExists($event->path);
        File::delete($event->path);
    }
}
