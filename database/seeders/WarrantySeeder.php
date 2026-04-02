<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\Warranty;
use Illuminate\Database\Seeder;

class WarrantySeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            $this->command?->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');

            return;
        }

        Warranty::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereIn('name', ['Express Warranty', 'Special warranty', 'Implied Warranty'])
            ->forceDelete();

        $now = now();
        $rows = [
            [
                'name' => 'Express Warranty',
                'description' => 'Repairs or a replacement for a faulty product within a specified time period after it was purchased.',
                'duration_value' => 3,
                'duration_unit' => 'month',
                'is_active' => true,
            ],
            [
                'name' => 'Special warranty',
                'description' => 'Seller warrants only against anything that occurred during their physical ownership.',
                'duration_value' => 6,
                'duration_unit' => 'month',
                'is_active' => true,
            ],
            [
                'name' => 'Implied Warranty',
                'description' => 'Assurances that a product is fit for purpose and merchantable.',
                'duration_value' => 1,
                'duration_unit' => 'year',
                'is_active' => true,
            ],
        ];

        foreach ($rows as $row) {
            Warranty::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $row['name'],
                'description' => $row['description'],
                'duration_value' => $row['duration_value'],
                'duration_unit' => $row['duration_unit'],
                'is_active' => $row['is_active'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Seeded '.count($rows).' warranties for tenant tillflow-demo.');
    }
}

