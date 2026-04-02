<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            $this->command?->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');

            return;
        }

        Unit::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereIn('short_name', ['pc', 'kg', 'ltr', 'box'])
            ->forceDelete();

        $now = now();
        $rows = [
            ['name' => 'Piece', 'short_name' => 'pc'],
            ['name' => 'Kilogram', 'short_name' => 'kg'],
            ['name' => 'Liter', 'short_name' => 'ltr'],
            ['name' => 'Box', 'short_name' => 'box'],
        ];

        foreach ($rows as $row) {
            Unit::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $row['name'],
                'short_name' => $row['short_name'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Seeded 4 units for tenant tillflow-demo.');
    }
}

