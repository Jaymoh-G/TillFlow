<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiBrandsRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_list_brands(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/brands', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_owner_can_crud_brand_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/brands', $this->authHeaders($token));
        $list->assertOk();
        $this->assertGreaterThanOrEqual(4, count($list->json('data.brands')));

        $create = $this->postJson('/api/v1/brands', [
            'name' => 'Demo Brand',
            'slug' => 'demo-brand',
            'logo_url' => 'https://example.com/logo.png',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $id = $create->json('data.brand.id');
        $create->assertJsonPath('data.brand.logo_url', 'https://example.com/logo.png');

        $patch = $this->patchJson("/api/v1/brands/{$id}", [
            'name' => 'Demo Brand Pro',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.brand.name', 'Demo Brand Pro');

        $destroy = $this->deleteJson("/api/v1/brands/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/brands/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();

        $trashed = $this->getJson('/api/v1/brands/trashed', $this->authHeaders($token));
        $trashed->assertOk();
        $ids = collect($trashed->json('data.brands'))->pluck('id')->all();
        $this->assertContains($id, $ids);

        $restore = $this->postJson("/api/v1/brands/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();

        $show = $this->getJson("/api/v1/brands/{$id}", $this->authHeaders($token));
        $show->assertOk();
    }

    public function test_brand_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-brand-tenant',
            'status' => 'active',
        ]);
        $foreign = Brand::query()->create([
            'tenant_id' => $other->id,
            'name' => 'Hidden',
            'slug' => 'hidden',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/brands/{$foreign->id}", $this->authHeaders($token));
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
