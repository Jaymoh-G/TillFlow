<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\VariantAttribute;
use Illuminate\Database\Seeder;

class VariantAttributeSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            $this->command?->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');

            return;
        }

        VariantAttribute::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereIn('name', ['Size (T-shirts)', 'Size (Shoes)', 'Color', 'Memory', 'Storage'])
            ->forceDelete();

        $now = now();
        $rows = [
            ['name' => 'Size (T-shirts)', 'values' => ['S', 'M', 'L', 'XL'], 'is_active' => true],
            ['name' => 'Size (Shoes)', 'values' => ['5', '6', '7', '8', '9'], 'is_active' => true],
            ['name' => 'Color', 'values' => ['Red', 'Blue', 'Green'], 'is_active' => true],
            ['name' => 'Memory', 'values' => ['64 GB', '128 GB', '512 GB'], 'is_active' => true],
            ['name' => 'Storage', 'values' => ['250GB', '1TB'], 'is_active' => true],
        ];

        foreach ($rows as $row) {
            VariantAttribute::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $row['name'],
                'values' => $row['values'],
                'is_active' => $row['is_active'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Seeded '.count($rows).' variant attributes for tenant tillflow-demo.');
    }
}

