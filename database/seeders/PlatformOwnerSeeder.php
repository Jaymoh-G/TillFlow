<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Platform owner login + home tenant (TillFlow admin + /platform APIs).
 *
 * Defaults match project request; override via .env (recommended for production):
 *   PLATFORM_OWNER_EMAIL=james.mbatia@breezetech.co.ke
 *   PLATFORM_OWNER_PASSWORD=your-secret
 *
 * Run:
 *   php artisan migrate
 *   php artisan db:seed --class=PlatformOwnerSeeder
 *
 * Idempotent: safe to run multiple times.
 */
class PlatformOwnerSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) env('PLATFORM_OWNER_EMAIL', 'james.mbatia@breezetech.co.ke');
        $password = (string) env('PLATFORM_OWNER_PASSWORD', 'GichaneP1/');

        $tenant = Tenant::query()->updateOrCreate(
            ['slug' => 'breezetech-platform'],
            [
                'name' => 'BreezeTech Platform',
                'status' => Tenant::STATUS_ACTIVE,
            ]
        );

        // Roles/permissions for this tenant (same as RolesAndPermissionsSeeder).
        $this->call(RolesAndPermissionsSeeder::class);

        $user = User::query()->firstOrNew(['email' => $email]);
        $user->tenant_id = $tenant->id;
        $user->is_platform_owner = true;
        $user->name = $user->exists && $user->name
            ? $user->name
            : 'James Mbatia';
        // Plain password: User model casts to hashed.
        $user->password = $password;
        $user->save();

        $owner = Role::query()
            ->where('tenant_id', $tenant->id)
            ->where('slug', 'owner')
            ->first();

        if ($owner) {
            $user->roles()->sync([$owner->id]);
        }

        if ($this->command) {
            $this->command->info("Platform owner: {$email} (tenant: {$tenant->slug}, id {$tenant->id})");
            $this->command->warn('Rotate PLATFORM_OWNER_PASSWORD in .env after first login if this machine is shared.');
        }
    }
}
