<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $brands = Brand::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'logo_url', 'created_at', 'updated_at']);

        return response()->json([
            'message' => 'Brands retrieved.',
            'brands' => $brands,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $brands = Brand::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('deleted_at')
            ->get(['id', 'name', 'slug', 'logo_url', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed brands retrieved.',
            'brands' => $brands,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:100'],
            'logo' => ['nullable', 'file', 'image', 'max:2048'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $logoUrl = $validated['logo_url'] ?? null;
        if ($request->hasFile('logo')) {
            /** @var \Illuminate\Http\UploadedFile $file */
            $file = $request->file('logo');
            $path = $file->store('brands/logos', 'public');
            $logoUrl = $path ? Storage::disk('public')->url($path) : null;
        }

        $slug = $this->finalizeUniqueSlug(
            $tenant,
            $validated['slug'] ?? null,
            $validated['name'],
            null
        );

        $brand = Brand::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'logo_url' => $logoUrl,
        ]);

        return response()->json([
            'message' => 'Brand created.',
            'brand' => $brand->only(['id', 'name', 'slug', 'logo_url', 'tenant_id', 'created_at', 'updated_at']),
        ], 201);
    }

    public function show(Request $request, string $brand): JsonResponse
    {
        $model = $this->resolveBrand($request, $brand);

        return response()->json([
            'message' => 'Brand retrieved.',
            'brand' => $model->only(['id', 'name', 'slug', 'logo_url', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, string $brand): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveBrand($request, $brand);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:100'],
            'logo' => ['sometimes', 'nullable', 'file', 'image', 'max:2048'],
            'logo_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ]);

        // If a file is uploaded, overwrite stored logo_url with the new uploaded URL.
        if ($request->hasFile('logo')) {
            /** @var \Illuminate\Http\UploadedFile $file */
            $file = $request->file('logo');
            $path = $file->store('brands/logos', 'public');
            $validated['logo_url'] = $path ? Storage::disk('public')->url($path) : null;
        }

        if (array_key_exists('slug', $validated)) {
            $model->slug = $this->finalizeUniqueSlug(
                $tenant,
                $validated['slug'],
                $validated['name'] ?? $model->name,
                $model->id
            );
            unset($validated['slug']);
        }

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Brand updated.',
            'brand' => $model->only(['id', 'name', 'slug', 'logo_url', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function destroy(Request $request, string $brand): JsonResponse
    {
        $model = $this->resolveBrand($request, $brand);
        $model->delete();

        return response()->json([
            'message' => 'Brand moved to trash.',
        ]);
    }

    public function restore(Request $request, string $brand): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Brand::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereKey($brand)
            ->firstOrFail();

        $model->restore();

        return response()->json([
            'message' => 'Brand restored.',
            'brand' => $model->only(['id', 'name', 'slug', 'logo_url', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    private function resolveBrand(Request $request, string $brandId): Brand
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Brand::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($brandId)
            ->firstOrFail();
    }

    private function finalizeUniqueSlug(
        Tenant $tenant,
        ?string $preferredSlug,
        string $nameFallback,
        ?int $ignoreBrandId
    ): string {
        $raw = ($preferredSlug !== null && trim($preferredSlug) !== '')
            ? trim($preferredSlug)
            : $nameFallback;

        $base = Str::slug($raw);
        if ($base === '') {
            $base = 'brand';
        }

        $slug = $base;
        $suffix = 1;

        while ($this->brandSlugTaken($tenant->id, $slug, $ignoreBrandId)) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function brandSlugTaken(int $tenantId, string $slug, ?int $ignoreBrandId): bool
    {
        return Brand::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->when($ignoreBrandId !== null, fn ($q) => $q->where('id', '!=', $ignoreBrandId))
            ->where('slug', $slug)
            ->exists();
    }
}
