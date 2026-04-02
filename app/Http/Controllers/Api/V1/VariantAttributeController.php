<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\VariantAttribute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VariantAttributeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = VariantAttribute::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'values', 'is_active', 'created_at', 'updated_at']);

        return response()->json([
            'message' => 'Variant attributes retrieved.',
            'attributes' => $rows,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = VariantAttribute::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('deleted_at')
            ->get(['id', 'name', 'values', 'is_active', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed variant attributes retrieved.',
            'attributes' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'values' => ['required'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $values = $this->normalizeValues($validated['values']);

        if ($values === []) {
            return response()->json([
                'message' => 'Validation error.',
                'errors' => ['values' => ['Values must contain at least one entry.']],
            ], 422);
        }

        $model = VariantAttribute::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'values' => $values,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Variant attribute created.',
            'attribute' => $model->only(['id', 'name', 'values', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ], 201);
    }

    public function show(Request $request, string $attribute): JsonResponse
    {
        $model = $this->resolveAttribute($request, $attribute);

        return response()->json([
            'message' => 'Variant attribute retrieved.',
            'attribute' => $model->only(['id', 'name', 'values', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, string $attribute): JsonResponse
    {
        $model = $this->resolveAttribute($request, $attribute);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'values' => ['sometimes', 'required'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('values', $validated)) {
            $values = $this->normalizeValues($validated['values']);
            if ($values === []) {
                return response()->json([
                    'message' => 'Validation error.',
                    'errors' => ['values' => ['Values must contain at least one entry.']],
                ], 422);
            }
            $validated['values'] = $values;
        }

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Variant attribute updated.',
            'attribute' => $model->only(['id', 'name', 'values', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function destroy(Request $request, string $attribute): JsonResponse
    {
        $model = $this->resolveAttribute($request, $attribute);
        $model->delete();

        return response()->json([
            'message' => 'Variant attribute moved to trash.',
        ]);
    }

    public function restore(Request $request, string $attribute): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = VariantAttribute::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereKey($attribute)
            ->firstOrFail();

        $model->restore();

        return response()->json([
            'message' => 'Variant attribute restored.',
            'attribute' => $model->only(['id', 'name', 'values', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    private function resolveAttribute(Request $request, string $attributeId): VariantAttribute
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return VariantAttribute::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($attributeId)
            ->firstOrFail();
    }

    /**
     * Accept either:
     * - array of strings, or
     * - comma-separated string: "Red, Blue, Green"
     *
     * @return array<int, string>
     */
    private function normalizeValues(mixed $raw): array
    {
        $values = [];

        if (is_array($raw)) {
            $values = array_map(static fn ($v): string => trim((string) $v), $raw);
        } else {
            $values = array_map('trim', explode(',', (string) $raw));
        }

        $values = array_values(array_filter($values, static fn (string $v): bool => $v !== ''));
        $unique = [];
        foreach ($values as $v) {
            $key = mb_strtolower($v);
            if (! array_key_exists($key, $unique)) {
                $unique[$key] = $v;
            }
        }

        return array_values($unique);
    }
}

