<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class BrandSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            $this->command?->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');

            return;
        }

        Brand::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereIn('slug', ['lenovo', 'nike', 'apple', 'amazon', 'house-brand'])
            ->forceDelete();

        $now = now();
        $rows = [
            ['name' => 'Lenovo', 'slug' => 'lenovo'],
            ['name' => 'Nike', 'slug' => 'nike'],
            ['name' => 'Apple', 'slug' => 'apple'],
            ['name' => 'Amazon', 'slug' => 'amazon'],
            ['name' => 'House Brand', 'slug' => 'house-brand'],
        ];

        foreach ($rows as $row) {
            Brand::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $row['name'],
                'slug' => $row['slug'],
                'logo_url' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Seeded 5 brands for tenant tillflow-demo.');
    }
}
