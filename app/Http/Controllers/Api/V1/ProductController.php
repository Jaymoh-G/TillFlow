<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\VariantAttribute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'category:id,name',
                'brand:id,name,logo_url',
                'unit:id,name,short_name',
                'warranty:id,name,duration_value,duration_unit,is_active',
            ])
            ->orderBy('name')
            ->get([
                'id', 'tenant_id', 'category_id', 'brand_id', 'unit_id', 'warranty_id', 'name', 'sku', 'qty', 'qty_alert',
                'manufactured_at', 'expires_at', 'buying_price', 'selling_price', 'created_at', 'updated_at',
            ]);

        return response()->json([
            'message' => 'Products retrieved.',
            'products' => $products,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $products = Product::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->with([
                'category:id,name',
                'brand:id,name,logo_url',
                'unit:id,name,short_name',
                'warranty:id,name,duration_value,duration_unit,is_active',
            ])
            ->orderByDesc('deleted_at')
            ->get(['id', 'tenant_id', 'category_id', 'brand_id', 'unit_id', 'warranty_id', 'name', 'sku', 'qty', 'qty_alert', 'manufactured_at', 'expires_at', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed products retrieved.',
            'products' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('products', 'sku')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'brand_id' => [
                'nullable',
                'integer',
                Rule::exists('brands', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'unit_id' => [
                'nullable',
                'integer',
                Rule::exists('units', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'warranty_id' => [
                'nullable',
                'integer',
                Rule::exists('warranties', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'qty' => ['sometimes', 'integer', 'min:0'],
            'qty_alert' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'manufactured_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'buying_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants' => ['sometimes', 'array'],
            'variants.*.variant_attribute_id' => [
                'required',
                'integer',
                Rule::exists('variant_attributes', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'variants.*.value' => ['required', 'string', 'max:255'],
            'variants.*.sku' => ['nullable', 'string', 'max:100'],
            'variants.*.qty' => ['sometimes', 'integer', 'min:0'],
            'variants.*.price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants.*.buying_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants.*.selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        if (! empty($validated['variants'] ?? [])) {
            $this->validateVariantDefinitions($tenant, $validated['variants']);
        }

        $product = Product::query()->create([
            'tenant_id' => $tenant->id,
            'category_id' => $validated['category_id'] ?? null,
            'brand_id' => $validated['brand_id'] ?? null,
            'unit_id' => $validated['unit_id'] ?? null,
            'warranty_id' => $validated['warranty_id'] ?? null,
            'name' => $validated['name'],
            'sku' => $validated['sku'] ?? null,
            'qty' => $validated['qty'] ?? 0,
            'qty_alert' => array_key_exists('qty_alert', $validated) ? $validated['qty_alert'] : null,
            'manufactured_at' => $validated['manufactured_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'buying_price' => array_key_exists('buying_price', $validated) ? $validated['buying_price'] : null,
            'selling_price' => array_key_exists('selling_price', $validated) ? $validated['selling_price'] : null,
        ]);

        if (! empty($validated['variants'] ?? [])) {
            $this->syncProductVariants($tenant, $product, $validated['variants']);
        }

        return response()->json([
            'message' => 'Product created.',
            'product' => $this->productPayload($product->fresh()),
        ], 201);
    }

    public function show(Request $request, string $product): JsonResponse
    {
        $model = $this->resolveProduct($request, $product);

        return response()->json([
            'message' => 'Product retrieved.',
            'product' => $this->productPayload($model),
        ]);
    }

    public function update(Request $request, string $product): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveProduct($request, $product);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'sku' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('products', 'sku')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->ignore($model->id),
            ],
            'category_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('categories', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'brand_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('brands', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'unit_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('units', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'warranty_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('warranties', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'qty' => ['sometimes', 'integer', 'min:0'],
            'qty_alert' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'manufactured_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'buying_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants' => ['sometimes', 'array'],
            'variants.*.variant_attribute_id' => [
                'required',
                'integer',
                Rule::exists('variant_attributes', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'variants.*.value' => ['required', 'string', 'max:255'],
            'variants.*.sku' => ['nullable', 'string', 'max:100'],
            'variants.*.qty' => ['sometimes', 'integer', 'min:0'],
            'variants.*.price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants.*.buying_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'variants.*.selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        $variantsPayload = null;
        if (array_key_exists('variants', $validated)) {
            $variantsPayload = $validated['variants'];
            unset($validated['variants']);
        }

        $model->fill($validated);
        $model->save();

        if ($variantsPayload !== null) {
            if ($variantsPayload === []) {
                $this->deleteAllProductVariants($model);
            } else {
                $this->validateVariantDefinitions($tenant, $variantsPayload);
                $this->syncProductVariants($tenant, $model->fresh(), $variantsPayload);
            }
        }

        return response()->json([
            'message' => 'Product updated.',
            'product' => $this->productPayload($model->fresh()),
        ]);
    }

    public function uploadVariantImage(Request $request, string $product, string $variant): JsonResponse
    {
        $productModel = $this->resolveProduct($request, $product);
        $variantModel = ProductVariant::query()
            ->where('product_id', $productModel->id)
            ->whereKey($variant)
            ->firstOrFail();

        $request->validate([
            'image' => ['required', 'file', 'image', 'max:4096'],
        ]);

        if ($variantModel->image_path) {
            Storage::disk('public')->delete($variantModel->image_path);
        }

        $path = $request->file('image')->store('products/variants', 'public');
        $variantModel->image_path = $path;
        $variantModel->save();

        return response()->json([
            'message' => 'Variant image uploaded.',
            'variant' => $this->serializeVariant($variantModel),
        ]);
    }

    public function destroy(Request $request, string $product): JsonResponse
    {
        $model = $this->resolveProduct($request, $product);
        $model->delete();

        return response()->json([
            'message' => 'Product moved to trash.',
        ]);
    }

    public function restore(Request $request, string $product): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Product::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereKey($product)
            ->firstOrFail();

        $model->restore();

        return response()->json([
            'message' => 'Product restored.',
            'product' => $this->productPayload($model->fresh()),
        ]);
    }

    private function productPayload(Product $product): array
    {
        $product->load([
            'category:id,name',
            'brand:id,name,logo_url',
            'unit:id,name,short_name',
            'warranty:id,name,duration_value,duration_unit,is_active',
            'variants',
        ]);

        return $product->only([
            'id', 'name', 'sku', 'tenant_id', 'category_id', 'brand_id', 'unit_id', 'warranty_id',
            'qty', 'qty_alert', 'manufactured_at', 'expires_at', 'buying_price', 'selling_price', 'created_at', 'updated_at',
        ]) + [
            'category' => $product->category ? $product->category->only(['id', 'name']) : null,
            'brand' => $product->brand ? $product->brand->only(['id', 'name', 'logo_url']) : null,
            'unit' => $product->unit ? $product->unit->only(['id', 'name', 'short_name']) : null,
            'warranty' => $product->warranty
                ? $product->warranty->only(['id', 'name', 'duration_value', 'duration_unit', 'is_active'])
                : null,
            'variants' => $product->variants->map(fn (ProductVariant $v) => $this->serializeVariant($v))->values(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $variants
     */
    private function validateVariantDefinitions(Tenant $tenant, array $variants): void
    {
        $seen = [];
        foreach ($variants as $i => $row) {
            $attributeId = (int) $row['variant_attribute_id'];
            $value = trim((string) $row['value']);
            $pairKey = $attributeId.':'.$value;
            if (isset($seen[$pairKey])) {
                throw ValidationException::withMessages([
                    "variants.$i.value" => ['Each attribute and value pair may only appear once.'],
                ]);
            }
            $seen[$pairKey] = true;

            $attribute = VariantAttribute::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey($attributeId)
                ->whereNull('deleted_at')
                ->first();

            if ($attribute === null) {
                throw ValidationException::withMessages([
                    "variants.$i.variant_attribute_id" => ['Invalid variant attribute.'],
                ]);
            }

            $allowed = $this->normalizedAttributeValues($attribute->values ?? []);
            if (! in_array($value, $allowed, true)) {
                throw ValidationException::withMessages([
                    "variants.$i.value" => ['Value is not allowed for this attribute.'],
                ]);
            }
        }
    }

    /**
     * @param  array<int, mixed>  $raw
     * @return list<string>
     */
    private function normalizedAttributeValues(array $raw): array
    {
        $out = [];
        foreach ($raw as $v) {
            if ($v === null) {
                continue;
            }
            $s = trim(is_string($v) ? $v : (string) $v);
            if ($s !== '') {
                $out[] = $s;
            }
        }

        return $out;
    }

    private function serializeVariant(ProductVariant $variant): array
    {
        return [
            'id' => $variant->id,
            'product_id' => $variant->product_id,
            'variant_attribute_id' => $variant->variant_attribute_id,
            'value' => $variant->value,
            'sku' => $variant->sku,
            'qty' => $variant->qty,
            'buying_price' => $variant->buying_price !== null ? (string) $variant->buying_price : null,
            'selling_price' => $variant->price !== null ? (string) $variant->price : null,
            'image_url' => $variant->image_path ? Storage::disk('public')->url($variant->image_path) : null,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $variants
     */
    private function syncProductVariants(Tenant $tenant, Product $product, array $variants): void
    {
        $product->loadMissing('variants');
        $wantedKeys = [];
        foreach ($variants as $row) {
            $wantedKeys[(int) $row['variant_attribute_id'].':'.trim((string) $row['value'])] = true;
        }
        foreach ($product->variants as $v) {
            $key = $v->variant_attribute_id.':'.$v->value;
            if (! isset($wantedKeys[$key])) {
                if ($v->image_path) {
                    Storage::disk('public')->delete($v->image_path);
                }
                $v->delete();
            }
        }
        foreach ($variants as $row) {
            $attrId = (int) $row['variant_attribute_id'];
            $value = trim((string) $row['value']);
            $selling = $this->variantSellingFromRow($row);
            $buying = $this->variantBuyingFromRow($row);
            ProductVariant::query()->updateOrCreate(
                [
                    'product_id' => $product->id,
                    'variant_attribute_id' => $attrId,
                    'value' => $value,
                ],
                [
                    'sku' => isset($row['sku']) && $row['sku'] !== '' ? $row['sku'] : null,
                    'qty' => (int) ($row['qty'] ?? 0),
                    'price' => $selling,
                    'buying_price' => $buying,
                ]
            );
        }
    }

    private function deleteAllProductVariants(Product $product): void
    {
        $product->loadMissing('variants');
        foreach ($product->variants as $v) {
            if ($v->image_path) {
                Storage::disk('public')->delete($v->image_path);
            }
            $v->delete();
        }
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function variantSellingFromRow(array $row): mixed
    {
        if (array_key_exists('selling_price', $row) && $row['selling_price'] !== null && $row['selling_price'] !== '') {
            return $row['selling_price'];
        }
        if (array_key_exists('price', $row) && $row['price'] !== null && $row['price'] !== '') {
            return $row['price'];
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function variantBuyingFromRow(array $row): mixed
    {
        if (array_key_exists('buying_price', $row) && $row['buying_price'] !== null && $row['buying_price'] !== '') {
            return $row['buying_price'];
        }

        return null;
    }

    private function resolveProduct(Request $request, string $productId): Product
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($productId)
            ->firstOrFail();
    }
}
