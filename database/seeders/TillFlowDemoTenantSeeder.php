<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class TillFlowDemoTenantSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) env('TILLFLOW_DEMO_EMAIL', 'demo@tillflowpos.com');
        $password = (string) env('TILLFLOW_DEMO_PASSWORD', 'Demo1234');

        $tenant = Tenant::query()->updateOrCreate(
            ['slug' => 'tillflow-demo'],
            [
                'name' => 'TillFlow Demo',
                'status' => Tenant::STATUS_ACTIVE,
            ]
        );

        $user = User::query()->firstOrNew(['email' => $email]);
        $user->tenant_id = $tenant->id;
        $user->is_platform_owner = false;
        $user->name = $user->exists && $user->name ? $user->name : 'TillFlow Demo User';
        // Plain password only; User model casts password to hashed.
        $user->password = $password;
        $user->save();

        if ($this->command) {
            $this->command->info("TillFlow demo tenant: {$tenant->slug} (id {$tenant->id})");
            $this->command->info("Demo login: {$email} / {$password}");
            $this->command->warn('Use TILLFLOW_DEMO_EMAIL / TILLFLOW_DEMO_PASSWORD in .env to override defaults.');
        }
    }
}
