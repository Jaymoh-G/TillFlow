<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const SLUGS = ['stock', 'store_manager', 'analyst'];

    public function up(): void
    {
        Role::query()
            ->whereIn('slug', self::SLUGS)
            ->get()
            ->each(function (Role $role): void {
                $role->users()->detach();
                $role->permissions()->detach();
                $role->delete();
            });
    }

    public function down(): void
    {
        // Irreversible: re-run RolesAndPermissionsSeeder if these roles are needed again.
    }
};
