<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\TenantContact;
use Illuminate\Console\Command;

class BackfillTenantContactsFromLegacyCommand extends Command
{
    protected $signature = 'tenant:backfill-contacts-from-legacy {--dry-run : Print actions without saving}';

    protected $description = 'Create a primary tenant_contact from tenants.company_email / phone when missing';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $created = 0;
        Tenant::query()->orderBy('id')->chunkById(50, function ($tenants) use ($dry, &$created): void {
            foreach ($tenants as $tenant) {
                if (TenantContact::query()->where('tenant_id', $tenant->id)->exists()) {
                    continue;
                }
                $email = $tenant->company_email ? strtolower(trim((string) $tenant->company_email)) : null;
                if ($email === '') {
                    $email = null;
                }
                if ($email === null) {
                    continue;
                }

                $name = trim((string) $tenant->name);
                $parts = preg_split('/\s+/', $name, 2);
                $first = $parts[0] ?? 'Primary';
                $last = $parts[1] ?? 'Contact';

                $this->line("Tenant {$tenant->id} ({$tenant->name}): create primary contact {$email}");

                if (! $dry) {
                    TenantContact::query()->create([
                        'tenant_id' => $tenant->id,
                        'first_name' => $first,
                        'last_name' => $last,
                        'position' => null,
                        'email' => $email,
                        'phone' => $tenant->company_phone ? trim((string) $tenant->company_phone) : null,
                        'avatar_path' => null,
                        'is_primary' => true,
                        'user_id' => null,
                    ]);
                }
                $created++;
            }
        });

        $this->info($dry ? "Would create {$created} primary contact(s)." : "Created {$created} primary contact(s).");

        return self::SUCCESS;
    }
}
