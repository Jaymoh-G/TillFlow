<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $rows = ExpenseCategory::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get();

        return response()->json([
            'message' => 'Expense categories retrieved.',
            'categories' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('expense_categories', 'name')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = ExpenseCategory::query()->create([
            'tenant_id' => $tenant->id,
            'name' => trim((string) $validated['name']),
            'description' => isset($validated['description']) ? trim((string) $validated['description']) : null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Expense category created.', 'category' => $row], 201);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        $row = $this->resolveCategory($request, $category);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:120',
                Rule::unique('expense_categories', 'name')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($row->id),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('name', $validated)) {
            $row->name = trim((string) $validated['name']);
        }
        if (array_key_exists('description', $validated)) {
            $d = $validated['description'];
            $row->description = $d === null ? null : trim((string) $d);
        }
        if (array_key_exists('is_active', $validated)) {
            $row->is_active = (bool) $validated['is_active'];
        }
        $row->save();

        return response()->json(['message' => 'Expense category updated.', 'category' => $row]);
    }

    public function destroy(Request $request, string $category): JsonResponse
    {
        $row = $this->resolveCategory($request, $category);
        $row->delete();

        return response()->json(['message' => 'Expense category deleted.']);
    }

    private function resolveCategory(Request $request, string $id): ExpenseCategory
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return ExpenseCategory::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();
    }
}
