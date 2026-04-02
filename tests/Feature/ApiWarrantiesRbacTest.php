<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Warranty;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiWarrantiesRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_list_warranties(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/warranties', $this->authHeaders($token));
        $response->assertForbidden();
    }

    public function test_owner_can_crud_warranty_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/warranties', $this->authHeaders($token));
        $list->assertOk();
        $this->assertGreaterThanOrEqual(2, count($list->json('data.warranties')));

        $create = $this->postJson('/api/v1/warranties', [
            'name' => 'Demo Warranty',
            'description' => 'Demo',
            'duration_value' => 3,
            'duration_unit' => 'month',
            'is_active' => true,
        ], $this->authHeaders($token));
        $create->assertCreated();
        $id = $create->json('data.warranty.id');

        $patch = $this->patchJson("/api/v1/warranties/{$id}", [
            'duration_value' => 6,
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.warranty.duration_value', 6);

        $destroy = $this->deleteJson("/api/v1/warranties/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/warranties/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();

        $trashed = $this->getJson('/api/v1/warranties/trashed', $this->authHeaders($token));
        $trashed->assertOk();
        $ids = collect($trashed->json('data.warranties'))->pluck('id')->all();
        $this->assertContains($id, $ids);

        $restore = $this->postJson("/api/v1/warranties/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();

        $show = $this->getJson("/api/v1/warranties/{$id}", $this->authHeaders($token));
        $show->assertOk();
    }

    public function test_warranty_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-warranty-tenant',
            'status' => 'active',
        ]);
        $foreign = Warranty::query()->create([
            'tenant_id' => $other->id,
            'name' => 'Hidden',
            'description' => null,
            'duration_value' => 1,
            'duration_unit' => 'year',
            'is_active' => true,
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/warranties/{$foreign->id}", $this->authHeaders($token));
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

