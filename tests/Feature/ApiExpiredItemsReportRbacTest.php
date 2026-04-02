<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiExpiredItemsReportRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_view_expired_items_report(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/reports/expired-items', $this->authHeaders($token));
        $response->assertForbidden();
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('data.required_permission', 'reports.view');
    }

    public function test_owner_can_view_expired_and_expiring_reports(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $expired = $this->getJson('/api/v1/reports/expired-items?scope=expired', $this->authHeaders($token));
        $expired->assertOk();
        $expired->assertJsonPath('success', true);
        $expiredItems = $expired->json('data.items');
        $this->assertIsArray($expiredItems);
        $this->assertNotEmpty($expiredItems);
        $this->assertArrayHasKey('expires_at', $expiredItems[0]);

        $expiring = $this->getJson('/api/v1/reports/expired-items?scope=expiring&days=30', $this->authHeaders($token));
        $expiring->assertOk();
        $expiring->assertJsonPath('success', true);
        $expiringItems = $expiring->json('data.items');
        $this->assertIsArray($expiringItems);
        $this->assertNotEmpty($expiringItems);
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
