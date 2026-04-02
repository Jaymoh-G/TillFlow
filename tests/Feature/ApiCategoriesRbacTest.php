<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiCategoriesRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_cannot_list_categories(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/categories', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }

    public function test_owner_can_crud_category_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $list = $this->getJson('/api/v1/categories', $this->authHeaders($token));
        $list->assertOk();
        $this->assertGreaterThanOrEqual(4, count($list->json('data.categories')));

        $create = $this->postJson('/api/v1/categories', [
            'name' => 'Demo Cat',
            'slug' => 'demo-cat',
        ], $this->authHeaders($token));
        $create->assertCreated();
        $id = $create->json('data.category.id');

        $patch = $this->patchJson("/api/v1/categories/{$id}", [
            'name' => 'Demo Cat Pro',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $patch->assertJsonPath('data.category.name', 'Demo Cat Pro');

        $destroy = $this->deleteJson("/api/v1/categories/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();

        $gone = $this->getJson("/api/v1/categories/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();

        $trashed = $this->getJson('/api/v1/categories/trashed', $this->authHeaders($token));
        $trashed->assertOk();
        $ids = collect($trashed->json('data.categories'))->pluck('id')->all();
        $this->assertContains($id, $ids);

        $restore = $this->postJson("/api/v1/categories/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();

        $show = $this->getJson("/api/v1/categories/{$id}", $this->authHeaders($token));
        $show->assertOk();
    }

    public function test_store_without_slug_assigns_unique_slug_from_name(): void
    {
        $token = $this->loginAsAdmin()['token'];

        $first = $this->postJson('/api/v1/categories', [
            'name' => 'Widget Line',
        ], $this->authHeaders($token));
        $first->assertCreated();
        $first->assertJsonPath('data.category.slug', 'widget-line');

        $second = $this->postJson('/api/v1/categories', [
            'name' => 'Widget Line',
        ], $this->authHeaders($token));
        $second->assertCreated();
        $second->assertJsonPath('data.category.slug', 'widget-line-1');

        $id = $second->json('data.category.id');

        $patch = $this->patchJson("/api/v1/categories/{$id}", [
            'slug' => 'widget-line',
        ], $this->authHeaders($token));
        $patch->assertOk();
        $this->assertNotSame('widget-line', $patch->json('data.category.slug'));
        $this->assertTrue(Str::startsWith($patch->json('data.category.slug'), 'widget-line'));
    }

    public function test_category_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-co',
            'status' => 'active',
        ]);
        $foreign = Category::query()->create([
            'tenant_id' => $other->id,
            'name' => 'Hidden',
            'slug' => 'hidden',
        ]);

        $token = $this->loginAsAdmin()['token'];
        $response = $this->getJson("/api/v1/categories/{$foreign->id}", $this->authHeaders($token));
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
