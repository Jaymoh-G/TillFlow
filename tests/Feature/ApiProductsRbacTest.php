<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\VariantAttribute;
use Illuminate\Http\UploadedFile;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiProductsRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_login_validation_uses_api_envelope(): void
    {
        $response = $this->postJson('/api/v1/auth/login', []);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => ['errors'],
            'meta' => ['timestamp'],
        ]);
        $this->assertFalse($response->json('success'));
        $this->assertArrayHasKey('email', $response->json('data.errors'));
    }

    public function test_cashier_cannot_list_products(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);

        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/products', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
        $response->assertJson([
            'success' => false,
            'data' => ['required_permission' => 'catalog.manage'],
        ]);
    }

    public function test_owner_can_list_and_create_products(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@tillflow.local',
            'password' => 'password',
        ]);

        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $list = $this->getJson('/api/v1/products', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $list->assertOk();
        $list->assertJsonPath('success', true);
        $products = $list->json('data.products');
        $this->assertGreaterThanOrEqual(110, count($products));
        $this->assertTrue(
            collect($products)->contains(fn (array $p): bool => ($p['sku'] ?? null) === 'SEED-001')
        );

        $create = $this->postJson('/api/v1/products', [
            'name' => 'Demo SKU',
            'sku' => 'DEMO-1',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $create->assertCreated();
        $create->assertJsonPath('data.product.name', 'Demo SKU');
        $create->assertJsonPath('data.product.sku', 'DEMO-1');
        $create->assertJsonPath('data.product.variants', []);
    }

    public function test_owner_can_create_product_with_variants_and_upload_image(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $attr = VariantAttribute::query()->where('name', 'Color')->first();
        $this->assertNotNull($attr);

        $create = $this->postJson('/api/v1/products', [
            'name' => 'Color tee',
            'sku' => 'CTE-1',
            'variants' => [
                [
                    'variant_attribute_id' => $attr->id,
                    'value' => 'Red',
                    'sku' => 'CTE-1-RED',
                    'qty' => 3,
                    'buying_price' => 8,
                    'selling_price' => 12.5,
                ],
            ],
        ], $this->authHeaders($token));

        $create->assertCreated();
        $variantId = $create->json('data.product.variants.0.id');
        $productId = $create->json('data.product.id');
        $this->assertNotNull($variantId);
        $create->assertJsonPath('data.product.variants.0.value', 'Red');
        $create->assertJsonPath('data.product.variants.0.selling_price', '12.50');
        $create->assertJsonPath('data.product.variants.0.buying_price', '8.00');

        $file = UploadedFile::fake()->image('variant.jpg', 60, 60);
        $upload = $this->post(
            "/api/v1/products/{$productId}/variants/{$variantId}/image",
            ['image' => $file],
            $this->authHeaders($token)
        );
        $upload->assertOk();
        $upload->assertJsonPath('success', true);
        $upload->assertJsonStructure(['data' => ['variant' => ['image_url']]]);
        $this->assertNotNull($upload->json('data.variant.image_url'));
    }

    public function test_owner_can_show_update_and_destroy_product(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $create = $this->postJson('/api/v1/products', [
            'name' => 'Widget',
            'sku' => 'W-1',
        ], $this->authHeaders($token));

        $create->assertCreated();
        $id = $create->json('data.product.id');
        $tenantId = $create->json('data.product.tenant_id');

        $show = $this->getJson("/api/v1/products/{$id}", $this->authHeaders($token));
        $show->assertOk();
        $show->assertJsonPath('data.product.sku', 'W-1');

        $categoryId = Category::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('id')
            ->value('id');

        $update = $this->patchJson("/api/v1/products/{$id}", [
            'name' => 'Widget Pro',
            'sku' => 'W-1',
            'category_id' => $categoryId,
            'unit_id' => null,
        ], $this->authHeaders($token));
        $update->assertOk();
        $update->assertJsonPath('data.product.name', 'Widget Pro');
        $update->assertJsonPath('data.product.category_id', $categoryId);
        $update->assertJsonPath('data.product.category.id', $categoryId);

        $destroy = $this->deleteJson("/api/v1/products/{$id}", [], $this->authHeaders($token));
        $destroy->assertOk();
        $destroy->assertJsonPath('success', true);

        $gone = $this->getJson("/api/v1/products/{$id}", $this->authHeaders($token));
        $gone->assertNotFound();
        $gone->assertJsonStructure(['success', 'message', 'meta']);

        $trashedList = $this->getJson('/api/v1/products/trashed', $this->authHeaders($token));
        $trashedList->assertOk();
        $trashedIds = collect($trashedList->json('data.products'))->pluck('id')->all();
        $this->assertContains($id, $trashedIds);

        $restore = $this->postJson("/api/v1/products/{$id}/restore", [], $this->authHeaders($token));
        $restore->assertOk();
        $restore->assertJsonPath('data.product.name', 'Widget Pro');

        $showAgain = $this->getJson("/api/v1/products/{$id}", $this->authHeaders($token));
        $showAgain->assertOk();
        $showAgain->assertJsonPath('data.product.sku', 'W-1');
    }

    public function test_product_belonging_to_another_tenant_returns_404(): void
    {
        $otherTenant = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-tenant',
            'status' => 'active',
        ]);

        $foreignProduct = Product::query()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Foreign',
            'sku' => 'F-1',
        ]);

        $token = $this->loginAsAdmin()['token'];

        $response = $this->getJson("/api/v1/products/{$foreignProduct->id}", $this->authHeaders($token));

        $response->assertNotFound();
        $this->assertFalse($response->json('success'));
    }

    /**
     * @return array{token: string}
     */
    private function loginAsAdmin(): array
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();

        return ['token' => $tokenResponse->json('data.token')];
    }

    /**
     * @return array<string, string>
     */
    private function authHeaders(string $token): array
    {
        return ['Authorization' => 'Bearer '.$token];
    }
}
