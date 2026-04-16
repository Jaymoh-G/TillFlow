<?php

namespace Tests\Feature;

use App\Models\Biller;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiBillersRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_can_list_billers(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/billers', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $this->assertIsArray($response->json('data.billers'));
    }

    public function test_admin_can_create_biller_without_email_or_location(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $create = $this->postJson('/api/v1/billers', [
            'name' => 'Pat Demo',
            'company' => 'Demo Co',
            'phone' => '+1 555-0200',
            'status' => 'Active',
        ], $this->authHeaders($token));

        $create->assertCreated();
        $create->assertJsonPath('data.biller.email', null);
        $create->assertJsonPath('data.biller.location', null);
    }

    public function test_next_biller_code_skips_soft_deleted_codes(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $this->postJson('/api/v1/billers', [
            'name' => 'Keep Biller',
            'company' => 'A',
            'phone' => '+10000000011',
            'status' => 'Active',
        ], $headers)->assertCreated();

        $b = $this->postJson('/api/v1/billers', [
            'name' => 'Trash Biller',
            'company' => 'B',
            'phone' => '+10000000012',
            'status' => 'Active',
        ], $headers);
        $b->assertCreated();
        $this->assertSame('BI002', $b->json('data.biller.code'));
        $bId = $b->json('data.biller.id');

        $this->deleteJson("/api/v1/billers/{$bId}", [], $headers)->assertOk();

        $c = $this->postJson('/api/v1/billers', [
            'name' => 'After trash',
            'company' => 'C',
            'phone' => '+10000000013',
            'status' => 'Active',
        ], $headers);
        $c->assertCreated();
        $this->assertSame('BI003', $c->json('data.biller.code'));
    }

    public function test_duplicate_phone_on_create_is_rejected(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $this->postJson('/api/v1/billers', [
            'name' => 'First',
            'company' => 'Co1',
            'phone' => '+254700000011',
            'status' => 'Active',
        ], $headers)->assertCreated();

        $dup = $this->postJson('/api/v1/billers', [
            'name' => 'Second',
            'company' => 'Co2',
            'phone' => '+254700000011',
            'status' => 'Active',
        ], $headers);

        $dup->assertUnprocessable();
    }

    public function test_admin_can_crud_biller_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/billers', $this->authHeaders($token));
        $list->assertOk();
        $this->assertSame([], $list->json('data.billers'));

        $create = $this->postJson('/api/v1/billers', [
            'name' => 'Alex Test',
            'company' => 'Northwind',
            'email' => 'alex-test@example.com',
            'phone' => '+1 555-0201',
            'location' => 'Seattle',
            'status' => 'Active',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $create->assertJsonPath('data.biller.code', 'BI001');
        $id = $create->json('data.biller.id');

        $patch = $this->patchJson("/api/v1/billers/{$id}", [
            'name' => 'Alex Test Jr',
            'company' => 'Northwind LLC',
            'location' => 'Portland',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.biller.name', 'Alex Test Jr');

        $destroy = $this->deleteJson("/api/v1/billers/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/billers/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();
    }

    public function test_biller_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-biller-tenant',
            'status' => 'active',
        ]);
        $foreign = Biller::query()->create([
            'tenant_id' => $other->id,
            'code' => 'BI099',
            'name' => 'Hidden',
            'company' => 'X',
            'email' => 'hidden@example.com',
            'phone' => '2',
            'location' => 'Y',
            'status' => 'Active',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/billers/{$foreign->id}", $this->authHeaders($token));
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
