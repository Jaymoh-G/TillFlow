<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $suppliers = Supplier::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('code')
            ->get([
                'id',
                'code',
                'name',
                'email',
                'phone',
                'location',
                'status',
                'avatar_url',
                'created_at',
                'updated_at',
            ]);

        return response()->json([
            'message' => 'Suppliers retrieved.',
            'suppliers' => $suppliers,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'phone' => [
                'required',
                'string',
                'max:64',
                Rule::unique('suppliers', 'phone')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'string', Rule::in(['Active', 'Inactive'])],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $email = $this->normalizeOptionalString($validated['email'] ?? null);
        $location = $this->normalizeOptionalString($validated['location'] ?? null);

        $avatarUrl = $validated['avatar_url'] ?? null;
        if ($request->hasFile('avatar')) {
            /** @var UploadedFile $file */
            $file = $request->file('avatar');
            $path = $file->store('suppliers/avatars', 'public');
            $avatarUrl = $path ? Storage::disk('public')->url($path) : $avatarUrl;
        }

        $code = $this->nextSupplierCode($tenant->id);

        $supplier = Supplier::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => $validated['name'],
            'email' => $email,
            'phone' => $validated['phone'],
            'location' => $location,
            'status' => $validated['status'],
            'avatar_url' => $avatarUrl,
        ]);

        return response()->json([
            'message' => 'Supplier created.',
            'supplier' => $supplier->only([
                'id',
                'code',
                'name',
                'email',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ], 201);
    }

    public function show(Request $request, string $supplier): JsonResponse
    {
        $model = $this->resolveSupplier($request, $supplier);

        return response()->json([
            'message' => 'Supplier retrieved.',
            'supplier' => $model->only([
                'id',
                'code',
                'name',
                'email',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function update(Request $request, string $supplier): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveSupplier($request, $supplier);

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'phone' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('suppliers', 'phone')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['Active', 'Inactive'])],
            'avatar' => ['sometimes', 'nullable', 'file', 'image', 'max:2048'],
            'avatar_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ]);

        if (array_key_exists('email', $validated)) {
            $validated['email'] = $this->normalizeOptionalString($validated['email']);
        }
        if (array_key_exists('location', $validated)) {
            $validated['location'] = $this->normalizeOptionalString($validated['location']);
        }

        if ($request->hasFile('avatar')) {
            /** @var UploadedFile $file */
            $file = $request->file('avatar');
            $path = $file->store('suppliers/avatars', 'public');
            if ($path) {
                $validated['avatar_url'] = Storage::disk('public')->url($path);
            }
        }

        unset($validated['avatar']);

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Supplier updated.',
            'supplier' => $model->only([
                'id',
                'code',
                'name',
                'email',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function destroy(Request $request, string $supplier): JsonResponse
    {
        $model = $this->resolveSupplier($request, $supplier);
        $model->delete();

        return response()->json([
            'message' => 'Supplier deleted.',
        ]);
    }

    private function resolveSupplier(Request $request, string $supplierId): Supplier
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Supplier::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($supplierId)
            ->firstOrFail();
    }

    private function nextSupplierCode(int $tenantId): string
    {
        $codes = Supplier::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('code');

        $max = 0;
        foreach ($codes as $code) {
            if (preg_match('/^SU(\d+)$/i', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'SU'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    private function normalizeOptionalString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
