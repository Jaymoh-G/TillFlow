<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StoreManager;
use App\Models\Tenant;
use App\Services\Billing\PlanEntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StoreManagerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $stores = StoreManager::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('store_name')
            ->get();

        $totals = $this->qtyTotalsByStoreIds($tenant, $stores->pluck('id')->map(fn ($id) => (int) $id)->all());

        return response()->json([
            'message' => 'Stores retrieved.',
            'stores' => $stores
                ->map(fn (StoreManager $s): array => $this->serializeStore($s, (int) ($totals[(int) $s->id] ?? 0)))
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        app(PlanEntitlementService::class)->assertCanAddStore($tenant);

        $storeName = trim((string) ($request->input('store_name') ?: $request->input('name') ?: ''));
        if ($storeName === '') {
            throw ValidationException::withMessages([
                'name' => ['The name field is required.'],
            ]);
        }

        $validated = $request->validate([
            'code' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('store_managers', 'code')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'location' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'username' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('store_managers', 'username')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
        ]);

        $username = $validated['username'] ?? $this->generateUniqueUsername($tenant, $storeName, $validated['code'] ?? null);

        /** @var StoreManager $store */
        $store = StoreManager::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $validated['code'] ?? null,
            'store_name' => $storeName,
            'username' => $username,
            'password' => Hash::make($validated['password'] ?? Str::random(32)),
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'location' => $validated['location'] ?? null,
            'status' => $validated['status'] ?? 'Active',
        ]);

        $fresh = $store->fresh();

        return response()->json([
            'message' => 'Store created.',
            'store' => $this->serializeStore($fresh, $this->totalQtyForStore($tenant, (int) $fresh->id)),
        ], 201);
    }

    public function show(Request $request, StoreManager $storeManager): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $this->assertSameTenant($tenant->id, $storeManager);

        return response()->json([
            'message' => 'Store retrieved.',
            'store' => $this->serializeStore($storeManager, $this->totalQtyForStore($tenant, (int) $storeManager->id)),
        ]);
    }

    public function update(Request $request, StoreManager $storeManager): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $this->assertSameTenant($tenant->id, $storeManager);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'store_name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('store_managers', 'code')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->ignore($storeManager->id),
            ],
            'location' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'username' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('store_managers', 'username')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->ignore($storeManager->id),
            ],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
        ]);

        if ($request->has('name') || $request->has('store_name')) {
            $storeName = trim((string) ($request->input('store_name') ?: $request->input('name') ?: ''));
            if ($storeName === '') {
                throw ValidationException::withMessages([
                    'name' => ['The name field is required.'],
                ]);
            }
            $storeManager->store_name = $storeName;
        }

        foreach (['code', 'location', 'status', 'email', 'phone', 'username'] as $field) {
            if (array_key_exists($field, $validated)) {
                $storeManager->{$field} = $validated[$field];
            }
        }

        if (! empty($validated['password'] ?? null)) {
            $storeManager->password = Hash::make($validated['password']);
        }

        $storeManager->save();

        $fresh = $storeManager->fresh();

        return response()->json([
            'message' => 'Store updated.',
            'store' => $this->serializeStore($fresh, $this->totalQtyForStore($tenant, (int) $fresh->id)),
        ]);
    }

    public function destroy(Request $request, StoreManager $storeManager): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $this->assertSameTenant($tenant->id, $storeManager);

        $storeManager->delete();

        return response()->json([
            'message' => 'Store deleted.',
        ]);
    }

    private function assertSameTenant(int $tenantId, StoreManager $storeManager): void
    {
        if ((int) $storeManager->tenant_id !== $tenantId) {
            abort(404);
        }
    }

    /**
     * Sum of on-hand quantities in `product_quantities` for this tenant’s products, per store.
     *
     * @param  list<int>  $storeIds
     * @return array<int, int>
     */
    private function qtyTotalsByStoreIds(Tenant $tenant, array $storeIds): array
    {
        if ($storeIds === []) {
            return [];
        }

        $rows = DB::table('product_quantities as pq')
            ->join('products as p', 'p.id', '=', 'pq.product_id')
            ->where('p.tenant_id', $tenant->id)
            ->whereNull('p.deleted_at')
            ->whereIn('pq.store_id', $storeIds)
            ->groupBy('pq.store_id')
            ->selectRaw('pq.store_id as store_id, SUM(pq.qty) as total_qty')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $out[(int) $r->store_id] = (int) $r->total_qty;
        }

        return $out;
    }

    private function totalQtyForStore(Tenant $tenant, int $storeId): int
    {
        return (int) DB::table('product_quantities as pq')
            ->join('products as p', 'p.id', '=', 'pq.product_id')
            ->where('p.tenant_id', $tenant->id)
            ->whereNull('p.deleted_at')
            ->where('pq.store_id', $storeId)
            ->sum(DB::raw('pq.qty'));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStore(StoreManager $s, int $totalQty = 0): array
    {
        return [
            'id' => $s->id,
            'name' => $s->store_name,
            'store_name' => $s->store_name,
            'code' => $s->code,
            'username' => $s->username,
            'email' => $s->email,
            'phone' => $s->phone,
            'location' => $s->location,
            'status' => $s->status,
            'total_qty' => $totalQty,
            'created_at' => $s->created_at?->format(\DATE_ATOM),
            'updated_at' => $s->updated_at?->format(\DATE_ATOM),
        ];
    }

    private function generateUniqueUsername(Tenant $tenant, string $storeName, ?string $code): string
    {
        $base = Str::slug($code ?: $storeName) ?: 'store';
        $candidate = $base;
        $n = 0;

        while (
            StoreManager::query()
                ->where('tenant_id', $tenant->id)
                ->where('username', $candidate)
                ->exists()
        ) {
            $n++;
            $candidate = $base.'-'.$n;
        }

        return $candidate;
    }
}
