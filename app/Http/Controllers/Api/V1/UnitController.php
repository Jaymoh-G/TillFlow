<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $units = Unit::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'short_name', 'created_at', 'updated_at']);

        return response()->json([
            'message' => 'Units retrieved.',
            'units' => $units,
        ]);
    }

    public function trashed(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $units = Unit::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('deleted_at')
            ->get(['id', 'name', 'short_name', 'created_at', 'updated_at', 'deleted_at']);

        return response()->json([
            'message' => 'Trashed units retrieved.',
            'units' => $units,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['required', 'string', 'max:20'],
        ]);

        $unit = Unit::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'short_name' => $validated['short_name'],
        ]);

        return response()->json([
            'message' => 'Unit created.',
            'unit' => $unit->only(['id', 'name', 'short_name', 'tenant_id', 'created_at', 'updated_at']),
        ], 201);
    }

    public function show(Request $request, string $unit): JsonResponse
    {
        $model = $this->resolveUnit($request, $unit);

        return response()->json([
            'message' => 'Unit retrieved.',
            'unit' => $model->only(['id', 'name', 'short_name', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, string $unit): JsonResponse
    {
        $model = $this->resolveUnit($request, $unit);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'short_name' => ['sometimes', 'required', 'string', 'max:20'],
        ]);

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Unit updated.',
            'unit' => $model->only(['id', 'name', 'short_name', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    public function destroy(Request $request, string $unit): JsonResponse
    {
        $model = $this->resolveUnit($request, $unit);
        $model->delete();

        return response()->json([
            'message' => 'Unit deleted.',
        ]);
    }

    public function restore(Request $request, string $unit): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Unit::onlyTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('id', $unit)
            ->first();

        if (! $model) {
            return response()->json([
                'message' => 'Unit not found.',
            ], 404);
        }

        $model->restore();

        return response()->json([
            'message' => 'Unit restored.',
            'unit' => $model->only(['id', 'name', 'short_name', 'tenant_id', 'created_at', 'updated_at']),
        ]);
    }

    private function resolveUnit(Request $request, string $unit): Unit
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $model = Unit::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $unit)
            ->first();

        if (! $model) {
            abort(404, 'Unit not found.');
        }

        return $model;
    }
}

