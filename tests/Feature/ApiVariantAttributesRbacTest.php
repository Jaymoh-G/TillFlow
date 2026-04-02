<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\VariantAttribute;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiVariantAttributesRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_list_variant_attributes(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/variant-attributes', $this->authHeaders($token));
        $response->assertForbidden();
    }

    public function test_owner_can_crud_variant_attribute_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/variant-attributes', $this->authHeaders($token));
        $list->assertOk();
        $this->assertGreaterThanOrEqual(3, count($list->json('data.attributes')));

        $create = $this->postJson('/api/v1/variant-attributes', [
            'name' => 'Material',
            'values' => 'Cotton, Polyester, Wool',
            'is_active' => true,
        ], $this->authHeaders($token));
        $create->assertCreated();
        $id = $create->json('data.attribute.id');
        $create->assertJsonPath('data.attribute.name', 'Material');

        $patch = $this->patchJson("/api/v1/variant-attributes/{$id}", [
            'values' => ['Cotton', 'Wool'],
            'is_active' => false,
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.attribute.is_active', false);

        $destroy = $this->deleteJson("/api/v1/variant-attributes/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/variant-attributes/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();

        $trashed = $this->getJson('/api/v1/variant-attributes/trashed', $this->authHeaders($token));
        $trashed->assertOk();
        $ids = collect($trashed->json('data.attributes'))->pluck('id')->all();
        $this->assertContains($id, $ids);

        $restore = $this->postJson("/api/v1/variant-attributes/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();

        $show = $this->getJson("/api/v1/variant-attributes/{$id}", $this->authHeaders($token));
        $show->assertOk();
    }

    public function test_variant_attribute_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-variant-tenant',
            'status' => 'active',
        ]);
        $foreign = VariantAttribute::query()->create([
            'tenant_id' => $other->id,
            'name' => 'Hidden',
            'values' => ['x'],
            'is_active' => true,
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/variant-attributes/{$foreign->id}", $this->authHeaders($token));
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

