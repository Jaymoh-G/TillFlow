<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiCustomersRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_can_list_customers(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/customers', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $this->assertIsArray($response->json('data.customers'));
    }

    public function test_cashier_still_cannot_list_brands(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/brands', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_admin_can_create_customer_without_email_or_location(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $create = $this->postJson('/api/v1/customers', [
            'name' => 'Walk-in Only',
            'phone' => '+1 555-0199',
            'status' => 'Active',
        ], $this->authHeaders($token));

        $create->assertCreated();
        $create->assertJsonPath('data.customer.email', null);
        $create->assertJsonPath('data.customer.location', null);
    }

    public function test_next_customer_code_skips_soft_deleted_codes(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $a = $this->postJson('/api/v1/customers', [
            'name' => 'Keep',
            'phone' => '+10000000001',
            'status' => 'Active',
        ], $headers);
        $a->assertCreated();

        $b = $this->postJson('/api/v1/customers', [
            'name' => 'Trashed',
            'phone' => '+10000000002',
            'status' => 'Active',
        ], $headers);
        $b->assertCreated();
        $bId = $b->json('data.customer.id');
        $this->assertSame('CU002', $b->json('data.customer.code'));

        $this->deleteJson("/api/v1/customers/{$bId}", [], $headers)->assertOk();

        $c = $this->postJson('/api/v1/customers', [
            'name' => 'After trash',
            'phone' => '+10000000003',
            'status' => 'Active',
        ], $headers);
        $c->assertCreated();
        $this->assertSame('CU003', $c->json('data.customer.code'));
    }

    public function test_duplicate_phone_on_create_is_rejected(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $this->postJson('/api/v1/customers', [
            'name' => 'First User',
            'phone' => '+254700000001',
            'status' => 'Active',
        ], $headers)->assertCreated();

        $dup = $this->postJson('/api/v1/customers', [
            'name' => 'Second User',
            'phone' => '+254700000001',
            'status' => 'Active',
        ], $headers);

        $dup->assertUnprocessable();
    }

    public function test_admin_can_crud_customer_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/customers', $this->authHeaders($token));
        $list->assertOk();
        $this->assertSame([], $list->json('data.customers'));

        $create = $this->postJson('/api/v1/customers', [
            'name' => 'Jamie Test',
            'email' => 'jamie-test@example.com',
            'phone' => '+1 555-0100',
            'location' => 'Austin',
            'status' => 'Active',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $create->assertJsonPath('data.customer.code', 'CU001');
        $id = $create->json('data.customer.id');

        $patch = $this->patchJson("/api/v1/customers/{$id}", [
            'name' => 'Jamie Test Jr',
            'location' => 'Dallas',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.customer.name', 'Jamie Test Jr');

        $destroy = $this->deleteJson("/api/v1/customers/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/customers/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();
    }

    public function test_customer_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-customer-tenant',
            'status' => 'active',
        ]);
        $foreign = Customer::query()->create([
            'tenant_id' => $other->id,
            'code' => 'CU099',
            'name' => 'Hidden',
            'email' => 'hidden@example.com',
            'phone' => '1',
            'location' => 'X',
            'status' => 'Active',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/customers/{$foreign->id}", $this->authHeaders($token));
        $response->assertNotFound();
    }

    /** @return array{token: string} */
    private function loginAsAdmin(): array
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();

        return ['token' => $tokenResponse->json('data.token')];
    }

    /** @return array<string, string> */
    private function authHeaders(string $token): array
    {
        return ['Authorization' => 'Bearer '.$token];
    }
}
