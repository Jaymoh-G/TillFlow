<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\Tenant;
use App\Services\Inventory\ProductStoreStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StockAdjustmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $query = StockAdjustment::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'product:id,name,sku,qty,brand_id,image_path',
                'product.brand:id,name,logo_url',
                'store:id,store_name',
                'createdBy:id,name,email',
            ]);

        if ($request->filled('product_id')) {
            $query->where('product_id', (int) $request->query('product_id'));
        }

        $limit = $request->filled('product_id')
            ? 30
            : min(500, max(1, (int) $request->query('limit', 500)));

        $rows = $query
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'message' => 'Stock adjustments retrieved.',
            'adjustments' => $rows->map(fn (StockAdjustment $a): array => $this->serialize($a)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'type' => ['required', 'string', Rule::in(['add', 'remove'])],
            'quantity' => ['required', 'integer', 'min:1'],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $service = app(ProductStoreStockService::class);

        /** @var StockAdjustment $adjustment */
        $adjustment = DB::transaction(function () use ($tenant, $validated, $user, $service): StockAdjustment {
            $product = Product::query()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->whereKey($validated['product_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $storeId = (int) $validated['store_id'];
            $qty = (int) $validated['quantity'];
            $delta = $validated['type'] === 'add' ? $qty : -$qty;

            $bucket = $service->getBucket($product, $storeId);
            $bucketBefore = $bucket ? (int) $bucket->qty : 0;

            if ($validated['type'] === 'remove' && $bucketBefore < $qty) {
                throw ValidationException::withMessages([
                    'quantity' => ['Insufficient quantity at the selected store.'],
                ]);
            }

            $service->adjustBucket($product, $storeId, $delta);
            $product->refresh();
            $bucketAfter = (int) ($service->getBucket($product, $storeId)?->qty ?? 0);

            $service->syncProductTotalFromBuckets($product);

            return StockAdjustment::query()->create([
                'tenant_id' => $tenant->id,
                'product_id' => $product->id,
                'store_id' => $storeId,
                'type' => $validated['type'],
                'quantity' => $qty,
                'qty_before' => $bucketBefore,
                'qty_after' => $bucketAfter,
                'reference' => $validated['reference'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'created_by_user_id' => $user?->id,
            ]);
        });

        $adjustment->load([
            'product:id,name,sku,qty,brand_id,image_path',
            'product.brand:id,name,logo_url',
            'store:id,store_name',
            'createdBy:id,name,email',
        ]);

        return response()->json([
            'message' => 'Stock adjustment recorded.',
            'adjustment' => $this->serialize($adjustment),
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(StockAdjustment $a): array
    {
        $p = $a->product;

        return [
            'id' => $a->id,
            'tenant_id' => $a->tenant_id,
            'product_id' => $a->product_id,
            'store_id' => $a->store_id,
            'type' => $a->type,
            'quantity' => $a->quantity,
            'qty_before' => $a->qty_before,
            'qty_after' => $a->qty_after,
            'reference' => $a->reference,
            'notes' => $a->notes,
            'created_at' => $a->created_at?->toIso8601String(),
            'updated_at' => $a->updated_at?->toIso8601String(),
            'product' => $p
                ? $p->only(['id', 'name', 'sku', 'qty'])
                    + [
                        'image_url' => $p->image_path ? Storage::disk('public')->url($p->image_path) : null,
                        'brand' => $p->brand
                            ? $p->brand->only(['id', 'name', 'logo_url'])
                            : null,
                    ]
                : null,
            'store' => $a->store
                ? $a->store->only(['id', 'store_name'])
                : null,
            'created_by' => $a->createdBy
                ? $a->createdBy->only(['id', 'name', 'email'])
                : null,
        ];
    }
}
