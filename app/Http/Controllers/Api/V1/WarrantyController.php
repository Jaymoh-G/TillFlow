<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\Warranty;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WarrantyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = Warranty::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'created_at', 'updated_at']);

        return response()->json([
            'message' => 'Warranties retrieved.',
            'warranties' => $rows,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = Warranty::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('deleted_at')
            ->get(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed warranties retrieved.',
            'warranties' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'duration_value' => ['required', 'integer', 'min:1', 'max:1200'],
            'duration_unit' => ['required', 'string', Rule::in(['month', 'year'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $model = Warranty::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'duration_value' => $validated['duration_value'],
            'duration_unit' => $validated['duration_unit'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Warranty created.',
            'warranty' => $model->only(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ], 201);
    }

    public function show(Request $request, string $warranty): JsonResponse
    {
        $model = $this->resolveWarranty($request, $warranty);

        return response()->json([
            'message' => 'Warranty retrieved.',
            'warranty' => $model->only(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, string $warranty): JsonResponse
    {
        $model = $this->resolveWarranty($request, $warranty);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'duration_value' => ['sometimes', 'required', 'integer', 'min:1', 'max:1200'],
            'duration_unit' => ['sometimes', 'required', 'string', Rule::in(['month', 'year'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Warranty updated.',
            'warranty' => $model->only(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function destroy(Request $request, string $warranty): JsonResponse
    {
        $model = $this->resolveWarranty($request, $warranty);
        $model->delete();

        return response()->json([
            'message' => 'Warranty moved to trash.',
        ]);
    }

    public function restore(Request $request, string $warranty): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Warranty::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->whereKey($warranty)
            ->firstOrFail();

        $model->restore();

        return response()->json([
            'message' => 'Warranty restored.',
            'warranty' => $model->only(['id', 'name', 'description', 'duration_value', 'duration_unit', 'is_active', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    private function resolveWarranty(Request $request, string $warrantyId): Warranty
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Warranty::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($warrantyId)
            ->firstOrFail();
    }
}

