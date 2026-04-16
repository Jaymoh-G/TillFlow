<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        /** @var list<string> $slugs */
        $slugs = config('permissions.slugs');

        foreach ($slugs as $slug) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => ucfirst(str_replace(['.', '_', '-'], [' ', ' ', ' '], $slug))],
            );
        }

        $catalogish = array_values(array_filter($slugs, static function (string $s): bool {
            return str_starts_with($s, 'catalog.')
                || str_starts_with($s, 'inventory.')
                || str_starts_with($s, 'procurement.')
                || str_starts_with($s, 'finance.expenses');
        }));

        $salesish = array_values(array_filter($slugs, static fn (string $s): bool => str_starts_with($s, 'sales.')));

        $oldCatalog = Permission::query()->where('slug', 'catalog.manage')->first();
        if ($oldCatalog) {
            $newIds = Permission::query()->whereIn('slug', $catalogish)->pluck('id')->all();
            foreach (Role::query()->cursor() as $role) {
                if ($role->permissions()->whereKey($oldCatalog->id)->exists()) {
                    $role->permissions()->syncWithoutDetaching($newIds);
                    $role->permissions()->detach($oldCatalog->id);
                }
            }
            DB::table('permissions')->where('id', $oldCatalog->id)->delete();
        }

        $oldSales = Permission::query()->where('slug', 'sales.manage')->first();
        if ($oldSales) {
            $newIds = Permission::query()->whereIn('slug', $salesish)->pluck('id')->all();
            foreach (Role::query()->cursor() as $role) {
                if ($role->permissions()->whereKey($oldSales->id)->exists()) {
                    $role->permissions()->syncWithoutDetaching($newIds);
                    $role->permissions()->detach($oldSales->id);
                }
            }
            DB::table('permissions')->where('id', $oldSales->id)->delete();
        }

        $usersManage = Permission::query()->where('slug', 'users.manage')->first();
        $storesManage = Permission::query()->where('slug', 'stores.manage')->first();
        if ($usersManage && $storesManage) {
            foreach (Role::query()->cursor() as $role) {
                if ($role->permissions()->whereKey($usersManage->id)->exists()) {
                    $role->permissions()->syncWithoutDetaching([$storesManage->id]);
                }
            }
        }
    }

    public function down(): void
    {
        // Non-reversible: granular permissions remain.
    }
};
