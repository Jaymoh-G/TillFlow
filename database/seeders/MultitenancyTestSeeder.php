<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Idempotent demo data for manual multitenancy QA (two tenants, two users, one no-tenant user).
 *
 * Run after base permissions seed:
 *   php artisan db:seed
 *   php artisan db:seed --class=MultitenancyTestSeeder
 *
 * Undo demo data only:
 *   php artisan db:seed --class=MultitenancyTestSeederRollback
 *
 * Demo logins (POST /api/v1/auth/login JSON: email + password):
 *   mt-a@multitenancy.test / Password1!
 *   mt-b@multitenancy.test / Password1!
 *   mt-none@multitenancy.test / Password1!   (no tenant: no roles, minimal sidebar — for API 403 tests)
 *
 * Password is stored plain here; User casts `password` to hashed (do not use Hash::make in this seeder).
 */
class MultitenancyTestSeeder extends Seeder
{
    private const PASSWORD = 'Password1!';

    public function run(): void
    {
        $tenantA = Tenant::query()->updateOrCreate(
            ['slug' => 'mt-demo-a'],
            ['name' => 'Multitenancy Demo A']
        );

        $tenantB = Tenant::query()->updateOrCreate(
            ['slug' => 'mt-demo-b'],
            ['name' => 'Multitenancy Demo B']
        );

        $this->upsertDemoUser('mt-a@multitenancy.test', $tenantA->id, 'MT Demo User A');
        $this->upsertDemoUser('mt-b@multitenancy.test', $tenantB->id, 'MT Demo User B');
        $this->upsertDemoUser('mt-none@multitenancy.test', null, 'MT No Tenant');

        $this->call(RolesAndPermissionsSeeder::class);

        $this->assignAdminRole('mt-a@multitenancy.test', $tenantA->id);
        $this->assignAdminRole('mt-b@multitenancy.test', $tenantB->id);

        $productA = Product::query()->updateOrCreate(
            [
                'tenant_id' => $tenantA->id,
                'sku' => 'MT-DEMO-A-SKU',
            ],
            [
                'name' => 'MT Demo Product (Tenant A)',
                'qty' => 0,
            ]
        );

        Product::query()->updateOrCreate(
            [
                'tenant_id' => $tenantB->id,
                'sku' => 'MT-DEMO-B-SKU',
            ],
            [
                'name' => 'MT Demo Product (Tenant B)',
                'qty' => 0,
            ]
        );

        if ($this->command) {
            $this->command->info('Multitenancy demo: mt-a@ / mt-b@ / mt-none@ multitenancy.test — password: '.self::PASSWORD);
            $this->command->info('Tenant A demo product id (use with IDOR test): '.$productA->id);
        }
    }

    /**
     * Plain password only — User model casts `password` to `hashed` (never pass Hash::make here).
     */
    private function upsertDemoUser(string $email, ?int $tenantId, string $name): void
    {
        $user = User::query()->firstOrNew(['email' => $email]);
        $user->tenant_id = $tenantId;
        $user->name = $name;
        $user->password = self::PASSWORD;
        $user->save();
    }

    private function assignAdminRole(string $email, int $tenantId): void
    {
        $user = User::query()->where('email', $email)->first();
        $admin = Role::query()->where('tenant_id', $tenantId)->where('slug', 'admin')->first();
        if ($user && $admin) {
            $user->roles()->sync([$admin->id]);
        }
    }
}
