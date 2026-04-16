<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiTenantCompanyProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_any_authenticated_user_can_read_company_profile(): void
    {
        $cashier = User::query()->where('email', 'cashier@tillflow.local')->firstOrFail();
        Sanctum::actingAs($cashier);

        $response = $this->getJson('/api/v1/tenant/company-profile');

        $response->assertOk();
        $this->assertArrayHasKey('message', $response->json('data'));
        $this->assertArrayHasKey('profile', $response->json('data'));
    }

    public function test_cashier_cannot_update_company_profile(): void
    {
        $cashier = User::query()->where('email', 'cashier@tillflow.local')->firstOrFail();
        Sanctum::actingAs($cashier);

        $this->patchJson('/api/v1/tenant/company-profile', [
            'name' => 'Test Co',
            'company_email' => 'a@b.co',
            'company_phone' => '+100',
            'company_address_line' => 'Line',
        ])->assertForbidden();
    }

    public function test_admin_can_update_company_profile(): void
    {
        /** @var User $admin */
        $admin = User::query()->where('email', 'admin@tillflow.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $tenant = Tenant::query()->whereKey($admin->tenant_id)->firstOrFail();
        $this->assertNull($tenant->company_email);

        $response = $this->patchJson('/api/v1/tenant/company-profile', [
            'name' => 'Acme Retail Ltd',
            'company_email' => 'hello@acme.test',
            'company_phone' => '+254712345678',
            'company_website' => 'https://acme.test',
            'company_address_line' => '123 Wood Ave, Nairobi, KE',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.profile.name', 'Acme Retail Ltd');
        $response->assertJsonPath('data.profile.company_email', 'hello@acme.test');
        $response->assertJsonPath('data.profile.company_address_line', '123 Wood Ave, Nairobi, KE');

        $tenant->refresh();
        $this->assertSame('hello@acme.test', $tenant->company_email);
        $this->assertSame('123 Wood Ave, Nairobi, KE', $tenant->company_address_line);
        $this->assertNull($tenant->company_fax);
        $this->assertNull($tenant->company_country);
        $this->assertNull($tenant->company_state);
        $this->assertNull($tenant->company_city);
        $this->assertNull($tenant->company_postal_code);
    }
}
