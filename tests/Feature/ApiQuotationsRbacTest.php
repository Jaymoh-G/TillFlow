<?php

namespace Tests\Feature;

use App\Models\Biller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiQuotationsRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_cashier_can_list_quotations(): void
    {
        $tokenResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ]);
        $tokenResponse->assertOk();
        $token = $tokenResponse->json('data.token');

        $response = $this->getJson('/api/v1/quotations', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $this->assertIsArray($response->json('data.quotations'));
    }

    public function test_cashier_cannot_list_brands(): void
    {
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ])->json('data.token');

        $this->getJson('/api/v1/brands', ['Authorization' => 'Bearer '.$token])->assertForbidden();
    }

    public function test_cashier_can_list_sales_catalog_products(): void
    {
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@tillflow.local',
            'password' => 'password',
        ])->json('data.token');

        $response = $this->getJson('/api/v1/sales/catalog-products', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $response->assertOk();
        $this->assertIsArray($response->json('data.products'));
    }

    public function test_admin_can_crud_quotation_cycle(): void
    {
        $token = $this->loginAsAdmin()['token'];
        $headers = $this->authHeaders($token);

        $this->getJson('/api/v1/quotations', $headers)->assertOk();

        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->firstOrFail();
        $product = Product::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $customer = Customer::query()->create([
            'tenant_id' => $tenant->id,
            'code' => 'CU-QT-TEST',
            'name' => 'Jamie Buyer',
            'email' => null,
            'phone' => '+19995550206',
            'location' => null,
            'status' => 'Active',
            'avatar_url' => null,
        ]);

        $productB = Product::query()->where('tenant_id', $tenant->id)->orderBy('id')->skip(1)->first()
            ?? $product;

        $biller = Biller::query()->create([
            'tenant_id' => $tenant->id,
            'code' => 'BI-QT',
            'name' => 'Alex Agent',
            'company' => 'Acme',
            'email' => null,
            'phone' => '+19995550999',
            'location' => null,
            'status' => 'Active',
            'avatar_url' => null,
        ]);

        $create = $this->postJson('/api/v1/quotations', [
            'quoted_at' => '2026-04-07',
            'customer_id' => $customer->id,
            'status' => 'Draft',
            'biller_id' => $biller->id,
            'discount_type' => 'after_tax',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 10],
                ['product_id' => $productB->id, 'quantity' => 1, 'unit_price' => 5.5],
            ],
        ], $headers);
        $create->assertCreated();
        $create->assertJsonPath('data.quotation.quote_ref', 'QT-001');
        $create->assertJsonPath('data.quotation.customer_name', 'Jamie Buyer');
        $create->assertJsonPath('data.quotation.biller_id', $biller->id);
        $create->assertJsonPath('data.quotation.biller_name', 'Alex Agent');
        $create->assertJsonPath('data.quotation.discount_type', 'after_tax');
        $create->assertJsonPath('data.quotation.discount_basis', 'percent');
        $this->assertSame('25.50', $create->json('data.quotation.total_amount'));
        $this->assertCount(2, $create->json('data.quotation.items'));
        $id = $create->json('data.quotation.id');

        $patch = $this->patchJson("/api/v1/quotations/{$id}", [
            'status' => 'Sent',
            'discount_type' => 'before_tax',
            'discount_basis' => 'fixed',
            'discount_value' => 3.25,
            'biller_id' => null,
        ], $headers);
        $patch->assertOk();
        $patch->assertJsonPath('data.quotation.status', 'Sent');
        $patch->assertJsonPath('data.quotation.discount_type', 'before_tax');
        $patch->assertJsonPath('data.quotation.discount_basis', 'fixed');
        $this->assertEqualsWithDelta(3.25, (float) $patch->json('data.quotation.discount_value'), 0.001);
        $patch->assertJsonPath('data.quotation.biller_id', null);
        $patch->assertJsonPath('data.quotation.biller_name', null);
        $this->assertCount(2, $patch->json('data.quotation.items'));

        $this->deleteJson("/api/v1/quotations/{$id}", [], $headers)->assertOk();
        $this->getJson("/api/v1/quotations/{$id}", $headers)->assertNotFound();
    }

    public function test_quotation_from_other_tenant_returns_404(): void
    {
        $other = Tenant::query()->create([
            'name' => 'Other',
            'slug' => 'other-quote-tenant',
            'status' => 'active',
        ]);
        $foreign = Quotation::query()->create([
            'tenant_id' => $other->id,
            'quote_ref' => 'QT-099',
            'quoted_at' => '2026-01-01',
            'customer_name' => 'Y',
            'customer_id' => null,
            'status' => 'Draft',
            'total_amount' => 1,
            'customer_image_url' => null,
        ]);
        QuotationItem::query()->create([
            'quotation_id' => $foreign->id,
            'product_id' => null,
            'product_name' => 'X',
            'product_image_url' => null,
            'quantity' => 1,
            'unit_price' => 1,
            'tax_percent' => 0,
            'line_total' => 1,
            'position' => 0,
        ]);

        $token = $this->loginAsAdmin()['token'];
        $this->getJson("/api/v1/quotations/{$foreign->id}", $this->authHeaders($token))->assertNotFound();
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
