<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();

        if (! $tenant) {
            $this->command?->warn('TillFlow demo tenant (tillflow-demo) not found — run DatabaseSeeder first.');

            return;
        }

        $names = ['Electronics', 'Clothing', 'Groceries', 'Home & Garden'];

        $newSlugs = array_map(static fn (string $name): string => Str::slug($name), $names);
        $legacySlugs = ['electronics', 'apparel', 'home', 'grocery', 'general', 'clothing', 'groceries', 'home-garden'];

        Category::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereIn('slug', array_values(array_unique([...$newSlugs, ...$legacySlugs])))
            ->forceDelete();

        $now = now();
        foreach ($names as $name) {
            Category::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $name,
                'slug' => Str::slug($name),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Seeded '.count($names).' categories for tenant tillflow-demo.');
    }
}
