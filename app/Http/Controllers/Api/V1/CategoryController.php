<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $categories = Category::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'created_at', 'updated_at']);

        return response()->json([
            'message' => 'Categories retrieved.',
            'categories' => $categories,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $categories = Category::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('deleted_at')
            ->get(['id', 'name', 'slug', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed categories retrieved.',
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:100'],
        ]);

        $slug = $this->finalizeUniqueSlug(
            $tenant,
            $validated['slug'] ?? null,
            $validated['name'],
            null
        );

        $category = Category::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'slug' => $slug,
        ]);

        return response()->json([
            'message' => 'Category created.',
            'category' => $category->only(['id', 'name', 'slug', 'tenant_id', 'created_at', 'updated_at']),
        ], 201);
    }

    public function show(Request $request, string $category): JsonResponse
    {
        $model = $this->resolveCategory($request, $category);

        return response()->json([
            'message' => 'Category retrieved.',
            'category' => $model->only(['id', 'name', 'slug', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveCategory($request, $category);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

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
            'message' => 'Category updated.',
            'category' => $model->only(['id', 'name', 'slug', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function destroy(Request $request, string $category): JsonResponse
    {
        $model = $this->resolveCategory($request, $category);
        $model->delete();

        return response()->json([
            'message' => 'Category moved to trash.',
        ]);
    }

    public function restore(Request $request, string $category): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Category::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereKey($category)
            ->firstOrFail();

        $model->restore();

        return response()->json([
            'message' => 'Category restored.',
            'category' => $model->only(['id', 'name', 'slug', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    private function resolveCategory(Request $request, string $categoryId): Category
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Category::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($categoryId)
            ->firstOrFail();
    }

    /**
     * Resolve a unique slug for this tenant among non-deleted categories.
     */
    private function finalizeUniqueSlug(
        Tenant $tenant,
        ?string $preferredSlug,
        string $nameFallback,
        ?int $ignoreCategoryId
    ): string {
        $raw = ($preferredSlug !== null && trim($preferredSlug) !== '')
            ? trim($preferredSlug)
            : $nameFallback;

        $base = Str::slug($raw);
        if ($base === '') {
            $base = 'category';
        }

        $slug = $base;
        $suffix = 1;

        while ($this->categorySlugTaken($tenant->id, $slug, $ignoreCategoryId)) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function categorySlugTaken(int $tenantId, string $slug, ?int $ignoreCategoryId): bool
    {
        return Category::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->when($ignoreCategoryId !== null, fn ($q) => $q->where('id', '!=', $ignoreCategoryId))
            ->where('slug', $slug)
            ->exists();
    }
}
