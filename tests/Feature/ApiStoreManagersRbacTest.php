<?php

namespace Tests\Feature;

use App\Models\StoreManager;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ApiStoreManagersRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_admin_can_list_store_managers(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $response = $this->getJson('/api/v1/store-managers', $this->authHeaders($token));

        $response->assertOk();
        $this->assertIsArray($response->json('data.store_managers'));
    }

    public function test_cashier_cannot_list_store_managers(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/store-managers', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_admin_can_crud_store_manager_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $list = $this->getJson('/api/v1/store-managers', $headers);
        $list->assertOk();
        $this->assertSame([], $list->json('data.store_managers'));

        $create = $this->postJson('/api/v1/store-managers', [
            'store_name' => 'Main Street',
            'username' => 'mainmgr',
            'password' => 'secret-pass-1',
            'email' => 'main@example.com',
            'phone' => '+1 555-0400',
            'location' => 'Denver',
            'status' => 'Active',
        ], $headers);
        $create->assertCreated();
        $create->assertJsonPath('data.store_manager.code', 'SM001');
        $create->assertJsonMissingPath('data.store_manager.password');
        $id = $create->json('data.store_manager.id');

        $patch = $this->patchJson("/api/v1/store-managers/{$id}", [
            'store_name' => 'Main Street Pro',
            'location' => 'Boulder',
        ], $headers);
        $patch->assertOk();
        $patch->assertJsonPath('data.store_manager.store_name', 'Main Street Pro');

        $destroy = $this->deleteJson("/api/v1/store-managers/{$id}", [], $headers);
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/store-managers/{$id}", $headers);
        $gone->assertNotFound();
    }

    public function test_store_manager_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-sm-tenant',
            'status' => 'active',
        ]);
        $foreign = StoreManager::query()->create([
            'tenant_id' => $other->id,
            'code' => 'SM099',
            'store_name' => 'Hidden',
            'username' => 'hidden',
            'password' => Hash::make('password'),
            'email' => 'h@example.com',
            'phone' => '9',
            'location' => 'Y',
            'status' => 'Active',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/store-managers/{$foreign->id}", $this->authHeaders($token));
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
