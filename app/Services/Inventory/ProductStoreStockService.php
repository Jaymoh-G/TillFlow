<?php

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\ProductQuantity;
use App\Models\StoreManager;
use Illuminate\Validation\ValidationException;

class ProductStoreStockService
{
    public function syncProductTotalFromBuckets(Product $product): void
    {
        $sum = (int) ProductQuantity::query()
            ->where('product_id', $product->id)
            ->sum('qty');
        $product->qty = $sum;
        $product->save();
    }

    public function getOrCreateBucket(int $tenantId, int $productId, int $storeId): ProductQuantity
    {
        $row = ProductQuantity::query()
            ->where('product_id', $productId)
            ->where('store_id', $storeId)
            ->first();

        if ($row) {
            return $row;
        }

        return ProductQuantity::query()->create([
            'tenant_id' => $tenantId,
            'product_id' => $productId,
            'store_id' => $storeId,
            'qty' => 0,
        ]);
    }

    public function getBucket(Product $product, int $storeId): ?ProductQuantity
    {
        return ProductQuantity::query()
            ->where('product_id', $product->id)
            ->where('store_id', $storeId)
            ->first();
    }

    /**
     * @return array{0: int, 1: int} before and after bucket qty
     */
    public function adjustBucket(Product $product, int $storeId, int $delta): array
    {
        $bucket = $this->getOrCreateBucket((int) $product->tenant_id, (int) $product->id, $storeId);
        $before = (int) $bucket->qty;
        $after = $before + $delta;
        if ($after < 0) {
            throw ValidationException::withMessages([
                'quantity' => ['Insufficient quantity at this store.'],
            ]);
        }
        $bucket->qty = $after;
        $bucket->save();

        return [$before, $after];
    }

    public function moveQuantity(Product $product, int $fromStoreId, int $toStoreId, int $qty): void
    {
        if ($qty < 1 || $fromStoreId === $toStoreId) {
            return;
        }
        $src = $this->getBucket($product, $fromStoreId);
        $available = $src ? (int) $src->qty : 0;
        if ($available < $qty) {
            throw ValidationException::withMessages([
                'lines' => ['Insufficient quantity at source store for product ID '.$product->id.'.'],
            ]);
        }
        $this->adjustBucket($product, $fromStoreId, -$qty);
        $this->adjustBucket($product, $toStoreId, $qty);
        $this->syncProductTotalFromBuckets($product->fresh());
    }

    /**
     * When PATCH sets a new total: one bucket gets full amount; multiple buckets scale proportionally.
     */
    public function setTotalQuantity(Product $product, int $newTotal, ?int $preferredStoreId = null): void
    {
        $newTotal = max(0, $newTotal);
        $buckets = ProductQuantity::query()
            ->where('product_id', $product->id)
            ->orderBy('store_id')
            ->get();

        if ($buckets->isEmpty()) {
            $storeId = $preferredStoreId ?? $product->store_id;
            if ($storeId === null) {
                $storeId = StoreManager::query()
                    ->where('tenant_id', $product->tenant_id)
                    ->whereNull('deleted_at')
                    ->orderBy('id')
                    ->value('id');
            }
            if ($storeId !== null) {
                $b = $this->getOrCreateBucket((int) $product->tenant_id, (int) $product->id, (int) $storeId);
                $b->qty = $newTotal;
                $b->save();
            }
            $this->syncProductTotalFromBuckets($product->fresh());

            return;
        }

        if ($buckets->count() === 1) {
            $buckets->first()->update(['qty' => $newTotal]);
            $this->syncProductTotalFromBuckets($product->fresh());

            return;
        }

        $sum = (int) $buckets->sum('qty');
        if ($sum <= 0) {
            $first = $buckets->first();
            foreach ($buckets as $b) {
                $b->qty = ($b->id === $first->id) ? $newTotal : 0;
                $b->save();
            }
        } else {
            $allocated = 0;
            $n = $buckets->count();
            foreach ($buckets as $i => $b) {
                if ($i === $n - 1) {
                    $b->qty = max(0, $newTotal - $allocated);
                } else {
                    $part = (int) floor($newTotal * ((int) $b->qty / $sum));
                    $b->qty = $part;
                    $allocated += $part;
                }
                $b->save();
            }
        }

        $this->syncProductTotalFromBuckets($product->fresh());
    }
}
