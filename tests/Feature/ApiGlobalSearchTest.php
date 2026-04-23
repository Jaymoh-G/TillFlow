<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Tenants\TenantRoleProvisioningService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiGlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_requires_search_global_permission(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->firstOrFail();
        $user = User::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'No Roles',
            'email' => 'no-roles-'.uniqid('', true).'@example.test',
            'password' => Hash::make('secret'),
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/search/global?q=ab');

        $response->assertForbidden();
        $response->assertJsonPath('data.required_permission', 'search.global');
    }

    public function test_demo_admin_can_search_invoices_and_products(): void
    {
        $token = $this->loginDemo()['token'];
        $headers = ['Authorization' => 'Bearer '.$token];

        $inv = $this->getJson('/api/v1/search/global?q=DINV&entities[]=invoices&limit=3', $headers);
        $inv->assertOk();
        $inv->assertJsonPath('success', true);
        $groups = $inv->json('data.groups');
        $this->assertIsArray($groups);
        $this->assertNotEmpty($groups);
        $this->assertSame('invoices', $groups[0]['type']);
        $this->assertArrayHasKey('items', $groups[0]);
        $this->assertNotEmpty($groups[0]['items']);
        $this->assertArrayHasKey('href', $groups[0]['items'][0]);
        $this->assertStringContainsString('/admin/invoices/', $groups[0]['items'][0]['href']);

        $prod = $this->getJson('/api/v1/search/global?q=SEED-00&entities[]=products&limit=5', $headers);
        $prod->assertOk();
        $pg = $prod->json('data.groups');
        $this->assertNotEmpty($pg);
        $this->assertSame('products', $pg[0]['type']);
    }

    public function test_query_shorter_than_two_chars_is_unprocessable(): void
    {
        $token = $this->loginDemo()['token'];
        $response = $this->getJson('/api/v1/search/global?q=a', ['Authorization' => 'Bearer '.$token]);
        $response->assertUnprocessable();
    }

    public function test_tenant_isolation_for_customers(): void
    {
        $tenantA = Tenant::query()->create([
            'name' => 'Search Iso A',
            'slug' => 'search-iso-a-'.uniqid(),
            'status' => Tenant::STATUS_ACTIVE,
        ]);
        $tenantB = Tenant::query()->create([
            'name' => 'Search Iso B',
            'slug' => 'search-iso-b-'.uniqid(),
            'status' => Tenant::STATUS_ACTIVE,
        ]);

        app(TenantRoleProvisioningService::class)->ensureForTenantId((int) $tenantA->id);
        app(TenantRoleProvisioningService::class)->ensureForTenantId((int) $tenantB->id);

        $needle = 'GlobalSearchIsoMarker'.uniqid();
        Customer::query()->create([
            'tenant_id' => $tenantA->id,
            'code' => 'CUS-A-'.substr(uniqid(), -6),
            'name' => $needle.' A',
            'email' => 'a-'.uniqid('', true).'@example.test',
            'phone' => '+1555000'.random_int(1000, 9999),
            'status' => 'Active',
        ]);
        Customer::query()->create([
            'tenant_id' => $tenantB->id,
            'code' => 'CUS-B-'.substr(uniqid(), -6),
            'name' => $needle.' B',
            'email' => 'b-'.uniqid('', true).'@example.test',
            'phone' => '+1555001'.random_int(1000, 9999),
            'status' => 'Active',
        ]);

        $userB = User::query()->create([
            'tenant_id' => $tenantB->id,
            'name' => 'User B',
            'email' => 'user-b-'.uniqid('', true).'@example.test',
            'password' => Hash::make('password'),
        ]);

        $adminB = Role::query()->where('tenant_id', $tenantB->id)->where('slug', 'admin')->firstOrFail();
        $userB->roles()->sync([$adminB->id]);

        Sanctum::actingAs($userB);

        $response = $this->getJson('/api/v1/search/global?q='.urlencode($needle).'&entities[]=customers');
        $response->assertOk();
        $groups = $response->json('data.groups');
        $this->assertCount(1, $groups);
        $items = $groups[0]['items'];
        $this->assertCount(1, $items);
        $this->assertStringContainsString($needle.' B', $items[0]['title']);
        $this->assertStringNotContainsString($needle.' A', $items[0]['title']);
    }

    /** @return array{token: string} */
    private function loginDemo(): array
    {
        $email = (string) env('TILLFLOW_DEMO_EMAIL', 'demo@tillflowpos.com');
        $password = (string) env('TILLFLOW_DEMO_PASSWORD', 'Demo1234');

        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ]);
        $tokenResponse->assertOk();

        return ['token' => $tokenResponse->json('data.token')];
    }
}
