<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Biller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class BillerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $billers = Biller::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('code')
            ->get([
                'id',
                'code',
                'name',
                'company',
                'email',
                'phone',
                'location',
                'status',
                'avatar_url',
                'created_at',
                'updated_at',
            ]);

        return response()->json([
            'message' => 'Billers retrieved.',
            'billers' => $billers,
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
            'company' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('billers', 'email')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'phone' => [
                'required',
                'string',
                'max:64',
                Rule::unique('billers', 'phone')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
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
            $path = $file->store('billers/avatars', 'public');
            $avatarUrl = $path ? Storage::disk('public')->url($path) : $avatarUrl;
        }

        $code = $this->nextBillerCode($tenant->id);

        $biller = Biller::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => $validated['name'],
            'company' => $validated['company'],
            'email' => $email,
            'phone' => $validated['phone'],
            'location' => $location,
            'status' => $validated['status'],
            'avatar_url' => $avatarUrl,
        ]);

        return response()->json([
            'message' => 'Biller created.',
            'biller' => $biller->only([
                'id',
                'code',
                'name',
                'company',
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

    public function show(Request $request, string $biller): JsonResponse
    {
        $model = $this->resolveBiller($request, $biller);

        return response()->json([
            'message' => 'Biller retrieved.',
            'biller' => $model->only([
                'id',
                'code',
                'name',
                'company',
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

    public function update(Request $request, string $biller): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveBiller($request, $biller);

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'company' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('billers', 'email')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'phone' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('billers', 'phone')
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
            $path = $file->store('billers/avatars', 'public');
            if ($path) {
                $validated['avatar_url'] = Storage::disk('public')->url($path);
            }
        }

        unset($validated['avatar']);

        $model->fill($validated);
        $model->save();

        return response()->json([
            'message' => 'Biller updated.',
            'biller' => $model->only([
                'id',
                'code',
                'name',
                'company',
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

    public function destroy(Request $request, string $biller): JsonResponse
    {
        $model = $this->resolveBiller($request, $biller);
        $model->delete();

        return response()->json([
            'message' => 'Biller deleted.',
        ]);
    }

    private function resolveBiller(Request $request, string $billerId): Biller
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Biller::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($billerId)
            ->firstOrFail();
    }

    private function nextBillerCode(int $tenantId): string
    {
        $codes = Biller::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('code');

        $max = 0;
        foreach ($codes as $code) {
            if (preg_match('/^BI(\d+)$/i', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'BI'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
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
