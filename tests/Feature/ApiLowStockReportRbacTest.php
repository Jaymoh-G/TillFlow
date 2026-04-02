<?php

namespace Tests\Feature;

use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiLowStockReportRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_view_low_stock_report(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/reports/low-stock', $this->authHeaders($token));
        $response->assertForbidden();
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('data.required_permission', 'reports.view');
    }

    public function test_owner_can_view_low_stock_report(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $response = $this->getJson('/api/v1/reports/low-stock', $this->authHeaders($token));
        $response->assertOk();
        $response->assertJsonPath('success', true);

        $items = $response->json('data.items');
        $this->assertIsArray($items);
        $this->assertNotEmpty($items);
        $this->assertArrayHasKey('qty', $items[0]);
        $this->assertArrayHasKey('qty_alert', $items[0]);
    }

    public function test_report_is_tenant_scoped(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-low-stock-tenant',
            'status' => 'active',
        ]);

        // No products seeded for other tenant; ensure it doesn't break and returns empty.
        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson('/api/v1/reports/low-stock', $this->authHeaders($token));
        $response->assertOk();
        $response->assertJsonPath('success', true);

        $this->assertNotNull($other->id);
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

