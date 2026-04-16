<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiTenantUiSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_authenticated_user_can_read_ui_settings(): void
    {
        $cashier = User::query()->where('email', 'cashier@tillflow.local')->firstOrFail();
        Sanctum::actingAs($cashier);

        $response = $this->getJson('/api/v1/tenant/ui-settings');

        $response->assertOk();
        $response->assertJsonPath('data.message', 'UI settings retrieved.');
        $this->assertNotNull($response->json('data.settings'));
    }

    public function test_cashier_cannot_merge_ui_settings(): void
    {
        $cashier = User::query()->where('email', 'cashier@tillflow.local')->firstOrFail();
        Sanctum::actingAs($cashier);

        $this->patchJson('/api/v1/tenant/ui-settings', [
            'merge' => [
                'website' => [
                    'storePreferences' => ['sms' => true],
                ],
            ],
        ])->assertForbidden();
    }

    public function test_admin_can_merge_ui_settings(): void
    {
        /** @var User $admin */
        $admin = User::query()->where('email', 'admin@tillflow.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $tenant = Tenant::query()->whereKey($admin->tenant_id)->firstOrFail();
        $this->assertNull($tenant->ui_settings);

        $response = $this->patchJson('/api/v1/tenant/ui-settings', [
            'merge' => [
                'website' => [
                    'systemIntegrations' => ['maps' => true],
                    'storePreferences' => ['sms' => true],
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.settings.website.storePreferences.sms', true);
        $response->assertJsonPath('data.settings.website.systemIntegrations.maps', true);

        $tenant->refresh();
        $this->assertTrue((bool) ($tenant->ui_settings['website']['storePreferences']['sms'] ?? false));

        $patch2 = $this->patchJson('/api/v1/tenant/ui-settings', [
            'merge' => [
                'system' => ['testRecipient' => 'x@y.test'],
            ],
        ]);
        $patch2->assertOk();
        $this->assertSame('x@y.test', $patch2->json('data.settings.system.testRecipient'));
    }
}
