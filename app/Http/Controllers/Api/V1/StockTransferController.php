<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferLine;
use App\Models\Tenant;
use App\Services\Inventory\ProductStoreStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StockTransferController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $rows = StockTransfer::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'lines.product:id,name,sku,category_id',
                'lines.product.category:id,name',
            ])
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();

        return response()->json([
            'message' => 'Stock transfers retrieved.',
            'transfers' => $rows->map(fn (StockTransfer $t) => $this->serializeTransfer($t)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'from_store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'to_store_id' => [
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'ref_number' => ['required', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        if ((int) $validated['from_store_id'] === (int) $validated['to_store_id']) {
            return response()->json([
                'message' => 'Source and destination stores must differ.',
            ], 422);
        }

        $service = app(ProductStoreStockService::class);

        /** @var StockTransfer $transfer */
        $transfer = DB::transaction(function () use ($tenant, $validated, $service): StockTransfer {
            $from = (int) $validated['from_store_id'];
            $to = (int) $validated['to_store_id'];

            $transfer = StockTransfer::query()->create([
                'tenant_id' => $tenant->id,
                'from_store_id' => $from,
                'to_store_id' => $to,
                'ref_number' => $this->normalizeRef($validated['ref_number']),
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($validated['lines'] as $line) {
                $product = Product::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->whereKey((int) $line['product_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                $service->moveQuantity($product, $from, $to, (int) $line['qty']);

                StockTransferLine::query()->create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => (int) $line['product_id'],
                    'qty' => (int) $line['qty'],
                ]);
            }

            return $transfer->load([
                'lines.product:id,name,sku,category_id',
                'lines.product.category:id,name',
            ]);
        });

        return response()->json([
            'message' => 'Stock transfer created.',
            'transfer' => $this->serializeTransfer($transfer),
        ], 201);
    }

    public function update(Request $request, string $stockTransfer): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveTransfer($request, $stockTransfer);

        $validated = $request->validate([
            'from_store_id' => [
                'sometimes',
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'to_store_id' => [
                'sometimes',
                'required',
                'integer',
                Rule::exists('store_managers', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'ref_number' => ['sometimes', 'required', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['sometimes', 'required', 'array', 'min:1'],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $from = (int) ($validated['from_store_id'] ?? $model->from_store_id);
        $to = (int) ($validated['to_store_id'] ?? $model->to_store_id);
        if ($from === $to) {
            return response()->json([
                'message' => 'Source and destination stores must differ.',
            ], 422);
        }

        $touchesInventory = isset($validated['lines'])
            || array_key_exists('from_store_id', $validated)
            || array_key_exists('to_store_id', $validated);

        $service = app(ProductStoreStockService::class);

        DB::transaction(function () use ($model, $validated, $tenant, $service, $from, $to, $touchesInventory): void {
            $model->load('lines');

            if ($touchesInventory) {
                foreach ($model->lines as $oldLine) {
                    $product = Product::query()
                        ->where('tenant_id', $tenant->id)
                        ->whereNull('deleted_at')
                        ->whereKey($oldLine->product_id)
                        ->lockForUpdate()
                        ->firstOrFail();
                    $service->moveQuantity($product, (int) $model->to_store_id, (int) $model->from_store_id, (int) $oldLine->qty);
                }

                $linePayload = $validated['lines'] ?? $model->lines->map(fn ($l) => [
                    'product_id' => (int) $l->product_id,
                    'qty' => (int) $l->qty,
                ])->all();

                $model->from_store_id = $from;
                $model->to_store_id = $to;
                if (array_key_exists('ref_number', $validated)) {
                    $model->ref_number = $this->normalizeRef($validated['ref_number']);
                }
                if (array_key_exists('notes', $validated)) {
                    $model->notes = $validated['notes'];
                }
                $model->save();

                $model->lines()->delete();

                foreach ($linePayload as $line) {
                    $product = Product::query()
                        ->where('tenant_id', $tenant->id)
                        ->whereNull('deleted_at')
                        ->whereKey((int) $line['product_id'])
                        ->lockForUpdate()
                        ->firstOrFail();
                    $service->moveQuantity($product, $from, $to, (int) $line['qty']);

                    StockTransferLine::query()->create([
                        'stock_transfer_id' => $model->id,
                        'product_id' => (int) $line['product_id'],
                        'qty' => (int) $line['qty'],
                    ]);
                }
            } else {
                if (array_key_exists('ref_number', $validated)) {
                    $model->ref_number = $this->normalizeRef($validated['ref_number']);
                }
                if (array_key_exists('notes', $validated)) {
                    $model->notes = $validated['notes'];
                }
                $model->save();
            }
        });

        $model->refresh()->load([
            'lines.product:id,name,sku,category_id',
            'lines.product.category:id,name',
        ]);

        return response()->json([
            'message' => 'Stock transfer updated.',
            'transfer' => $this->serializeTransfer($model),
        ]);
    }

    public function destroy(Request $request, string $stockTransfer): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveTransfer($request, $stockTransfer);
        $service = app(ProductStoreStockService::class);

        DB::transaction(function () use ($model, $tenant, $service): void {
            $model->load('lines');
            foreach ($model->lines as $line) {
                $product = Product::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->whereKey($line->product_id)
                    ->lockForUpdate()
                    ->firstOrFail();
                $service->moveQuantity($product, (int) $model->to_store_id, (int) $model->from_store_id, (int) $line->qty);
            }
            $model->delete();
        });

        return response()->json([
            'message' => 'Stock transfer deleted.',
        ]);
    }

    private function resolveTransfer(Request $request, string $id): StockTransfer
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return StockTransfer::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();
    }

    private function normalizeRef(string $ref): string
    {
        $t = trim($ref);

        return str_starts_with($t, '#') ? $t : '#'.$t;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTransfer(StockTransfer $t): array
    {
        $lines = $t->lines->map(function (StockTransferLine $line): array {
            /** @var Product|null $p */
            $p = $line->product;

            return [
                'line_id' => 'ln-'.$line->id,
                'product_id' => $line->product_id,
                'name' => $p?->name ?? '—',
                'sku' => $p?->sku ?? '—',
                'category' => $p?->category?->name ?? '—',
                'qty' => (int) $line->qty,
            ];
        });

        $qtySum = (int) $t->lines->sum('qty');

        return [
            'id' => $t->id,
            'from_store_id' => $t->from_store_id,
            'to_store_id' => $t->to_store_id,
            'ref_number' => $t->ref_number,
            'notes' => $t->notes,
            'no_of_products' => $t->lines->count(),
            'quantity_transferred' => $qtySum,
            'date' => $t->created_at?->format('j M Y'),
            'created_at' => $t->created_at?->toIso8601String(),
            'lines' => $lines->values(),
        ];
    }
}
