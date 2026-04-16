<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserHasPermission;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultitenancyApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_scoped_route_returns_403_when_user_has_no_tenant(): void
    {
        $user = User::query()->create([
            'tenant_id' => null,
            'name' => 'No Tenant',
            'email' => 'no-tenant-'.uniqid('', true).'@example.test',
            'password' => Hash::make('secret'),
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/tenant/company-profile');

        $response->assertForbidden();
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', 'Your account is not assigned to a tenant.');
    }

    public function test_product_belongs_to_another_tenant_returns_404(): void
    {
        $tenantA = Tenant::query()->create([
            'name' => 'Tenant A',
            'slug' => 'ta-'.uniqid(),
        ]);
        $tenantB = Tenant::query()->create([
            'name' => 'Tenant B',
            'slug' => 'tb-'.uniqid(),
        ]);

        $userB = User::query()->create([
            'tenant_id' => $tenantB->id,
            'name' => 'User B',
            'email' => 'ub-'.uniqid('', true).'@example.test',
            'password' => Hash::make('secret'),
        ]);

        $productA = Product::query()->create([
            'tenant_id' => $tenantA->id,
            'name' => 'Product A',
            'sku' => 'SKU-A-'.uniqid(),
            'qty' => 0,
        ]);

        Sanctum::actingAs($userB);

        // Permission middleware is orthogonal to tenant isolation; disable it so this test does not depend on role seed shape.
        $this->withoutMiddleware(EnsureUserHasPermission::class);

        $response = $this->getJson('/api/v1/products/'.$productA->id);

        $response->assertNotFound();
    }
}
