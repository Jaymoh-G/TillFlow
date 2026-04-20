<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\Automation\AutomationRunner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AutomationRunCommand extends Command
{
    protected $signature = 'automation:run';

    protected $description = 'Run tenant automation (invoice / quotation / proposal reminders) for the configured local hour.';

    public function handle(AutomationRunner $runner): int
    {
        Tenant::query()->orderBy('id')->chunkById(50, function ($tenants) use ($runner): void {
            foreach ($tenants as $tenant) {
                try {
                    $runner->runForTenant($tenant);
                } catch (\Throwable $e) {
                    Log::warning('automation:run tenant failed', [
                        'tenant_id' => $tenant->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        return self::SUCCESS;
    }
}
