<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Unit;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiUnitsRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_list_units(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/units', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_owner_can_crud_unit_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/units', $this->authHeaders($token));
        $list->assertOk();
        $this->assertGreaterThanOrEqual(2, count($list->json('data.units')));

        $create = $this->postJson('/api/v1/units', [
            'name' => 'Carton',
            'short_name' => 'ctn',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $id = $create->json('data.unit.id');
        $create->assertJsonPath('data.unit.short_name', 'ctn');

        $patch = $this->patchJson("/api/v1/units/{$id}", [
            'name' => 'Carton Pro',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.unit.name', 'Carton Pro');

        $destroy = $this->deleteJson("/api/v1/units/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/units/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();

        $trashed = $this->getJson('/api/v1/units/trashed', $this->authHeaders($token));
        $trashed->assertOk();
        $ids = collect($trashed->json('data.units'))->pluck('id')->all();
        $this->assertContains($id, $ids);

        $restore = $this->postJson("/api/v1/units/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();

        $show = $this->getJson("/api/v1/units/{$id}", $this->authHeaders($token));
        $show->assertOk();
    }

    public function test_unit_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-unit-tenant',
            'status' => 'active',
        ]);
        $foreign = Unit::query()->create([
            'tenant_id' => $other->id,
            'name' => 'Hidden',
            'short_name' => 'hid',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/units/{$foreign->id}", $this->authHeaders($token));
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

