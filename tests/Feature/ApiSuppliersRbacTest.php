<?php

namespace Tests\Feature;

use App\Models\Supplier;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiSuppliersRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_admin_can_list_suppliers(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $response = $this->getJson('/api/v1/suppliers', $this->authHeaders($token));

        $response->assertOk();
        $this->assertIsArray($response->json('data.suppliers'));
    }

    public function test_cashier_cannot_list_suppliers(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/suppliers', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_cashier_can_still_list_customers(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/customers', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
    }

    public function test_admin_can_create_supplier_without_email_or_location(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $create = $this->postJson('/api/v1/suppliers', [
            'name' => 'Walk-in Vendor',
            'phone' => '+1 555-0300',
            'status' => 'Active',
        ], $this->authHeaders($token));

        $create->assertCreated();
        $create->assertJsonPath('data.supplier.email', null);
        $create->assertJsonPath('data.supplier.location', null);
    }

    public function test_next_supplier_code_skips_soft_deleted_codes(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $this->postJson('/api/v1/suppliers', [
            'name' => 'Keep Supplier',
            'phone' => '+10000000021',
            'status' => 'Active',
        ], $headers)->assertCreated();

        $b = $this->postJson('/api/v1/suppliers', [
            'name' => 'Trash Supplier',
            'phone' => '+10000000022',
            'status' => 'Active',
        ], $headers);
        $b->assertCreated();
        $this->assertSame('SU002', $b->json('data.supplier.code'));
        $bId = $b->json('data.supplier.id');

        $this->deleteJson("/api/v1/suppliers/{$bId}", [], $headers)->assertOk();

        $c = $this->postJson('/api/v1/suppliers', [
            'name' => 'After trash',
            'phone' => '+10000000023',
            'status' => 'Active',
        ], $headers);
        $c->assertCreated();
        $this->assertSame('SU003', $c->json('data.supplier.code'));
    }

    public function test_admin_can_crud_supplier_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/suppliers', $this->authHeaders($token));
        $list->assertOk();
        $this->assertSame([], $list->json('data.suppliers'));

        $create = $this->postJson('/api/v1/suppliers', [
            'name' => 'Jamie Vendor',
            'email' => 'jamie-vendor@example.com',
            'phone' => '+1 555-0301',
            'location' => 'Austin',
            'status' => 'Active',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $create->assertJsonPath('data.supplier.code', 'SU001');
        $id = $create->json('data.supplier.id');

        $patch = $this->patchJson("/api/v1/suppliers/{$id}", [
            'name' => 'Jamie Vendor LLC',
            'location' => 'Dallas',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.supplier.name', 'Jamie Vendor LLC');

        $destroy = $this->deleteJson("/api/v1/suppliers/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/suppliers/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();
    }

    public function test_supplier_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-supplier-tenant',
            'status' => 'active',
        ]);
        $foreign = Supplier::query()->create([
            'tenant_id' => $other->id,
            'code' => 'SU099',
            'name' => 'Hidden',
            'email' => 'hidden@example.com',
            'phone' => '3',
            'location' => 'X',
            'status' => 'Active',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/suppliers/{$foreign->id}", $this->authHeaders($token));
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
